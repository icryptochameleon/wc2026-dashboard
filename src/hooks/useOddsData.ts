import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLOB_BASE,
  GAMMA_BASE,
  MATCH_SERIES_ID,
  WINNER_SLUG,
  canonicalTeam,
} from '../config/odds';
import { normalize } from '../config/teams';
import type { ChampionOddsMap, MatchResult, PolyMatchOdds } from '../types';

const CACHE_KEY = 'wc2026_odds_cache';
const WINNER_INTERVAL = 10 * 60 * 1000; // Gamma はエッジキャッシュ 5 分なので 10 分で十分
const MATCH_LIST_INTERVAL = 30 * 60 * 1000;
const LIVE_INTERVAL = 30 * 1000; // CLOB はキャッシュなし → ライブ中 30 秒

interface OddsCache {
  champion: ChampionOddsMap;
  matchOdds: PolyMatchOdds[];
  updatedAt: string | null;
}

/** Gamma /events は配列、/events/keyset は {data:[...]} を返す — 両対応 */
async function fetchGammaEvents(query: string): Promise<unknown[]> {
  const tryUrls = [
    `${GAMMA_BASE}/events?${query}`,
    `${GAMMA_BASE}/events/keyset?${query}`,
  ];
  let lastErr: Error | null = null;
  for (const url of tryUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`gamma ${res.status}`);
      const body = (await res.json()) as unknown;
      if (Array.isArray(body)) return body;
      if (body && Array.isArray((body as { data?: unknown[] }).data)) {
        return (body as { data: unknown[] }).data;
      }
      throw new Error('gamma: unexpected shape');
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error('gamma fetch failed');
}

interface RawGammaMarket {
  groupItemTitle?: string;
  question?: string;
  outcomePrices?: string | null;
  clobTokenIds?: string | null;
  closed?: boolean;
  sportsMarketType?: string;
}

interface RawGammaEvent {
  slug?: string;
  title?: string;
  startTime?: string;
  endDate?: string;
  markets?: RawGammaMarket[];
}

function parsePriceYes(m: RawGammaMarket): number | null {
  if (!m.outcomePrices) return null;
  try {
    const arr = JSON.parse(m.outcomePrices) as string[];
    const p = parseFloat(arr[0]);
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

function parseYesTokenId(m: RawGammaMarket): string | undefined {
  if (!m.clobTokenIds) return undefined;
  try {
    const arr = JSON.parse(m.clobTokenIds) as string[];
    return arr[0];
  } catch {
    return undefined;
  }
}

/** 優勝マーケット → チーム正準名ごとの確率 */
async function fetchChampionOdds(): Promise<ChampionOddsMap> {
  const events = (await fetchGammaEvents(`slug=${WINNER_SLUG}`)) as RawGammaEvent[];
  const ev = events[0];
  if (!ev?.markets) throw new Error('winner market not found');
  const map: ChampionOddsMap = {};
  for (const m of ev.markets) {
    const title = m.groupItemTitle ?? '';
    if (!title || title === 'Other' || /^Team\s+[A-Z]+$/i.test(title)) continue;
    if (m.closed) continue;
    const p = parsePriceYes(m);
    if (p === null || p <= 0) continue;
    const team = canonicalTeam(title);
    if (!team) continue; // Italy / Peru など未出場国は無視
    map[team] = p;
  }
  return map;
}

/** 直近 72 時間の試合別マーケット (suffix なし slug = ベースの 1X2 イベントのみ) */
async function fetchMatchOddsList(): Promise<PolyMatchOdds[]> {
  const min = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // 進行中試合も拾う
  const max = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const events = (await fetchGammaEvents(
    `series_id=${MATCH_SERIES_ID}&closed=false&end_date_min=${encodeURIComponent(min)}&end_date_max=${encodeURIComponent(max)}&limit=100`,
  )) as RawGammaEvent[];

  const out: PolyMatchOdds[] = [];
  const now = new Date().toISOString();
  for (const ev of events) {
    // ベースの試合イベントのみ (-halftime-result 等の派生は除外)
    if (!ev.slug || !/^fifwc-[a-z0-9]+-[a-z0-9]+-\d{4}-\d{2}-\d{2}$/.test(ev.slug)) continue;
    const title = ev.title ?? '';
    const [homeRaw, awayRaw] = title.split(/\s+vs\.?\s+/i);
    if (!homeRaw || !awayRaw) continue;
    const homeTeam = canonicalTeam(homeRaw);
    const awayTeam = canonicalTeam(awayRaw);
    if (!homeTeam || !awayTeam) continue;

    const moneyline = (ev.markets ?? []).filter(
      (m) => (m.sportsMarketType ?? 'moneyline') === 'moneyline',
    );
    let home: number | null = null;
    let draw: number | null = null;
    let away: number | null = null;
    const tokenIds: PolyMatchOdds['tokenIds'] = {};
    for (const m of moneyline) {
      const gi = m.groupItemTitle ?? m.question ?? '';
      const p = parsePriceYes(m);
      if (p === null) continue;
      if (/^draw\b/i.test(gi) || /end in a draw/i.test(m.question ?? '')) {
        draw = p;
        tokenIds.draw = parseYesTokenId(m);
      } else {
        const c = canonicalTeam(gi);
        if (c === homeTeam) {
          home = p;
          tokenIds.home = parseYesTokenId(m);
        } else if (c === awayTeam) {
          away = p;
          tokenIds.away = parseYesTokenId(m);
        }
      }
    }
    if (home === null || draw === null || away === null) continue;
    out.push({
      homeTeam,
      awayTeam,
      startTime: ev.startTime ?? ev.endDate ?? now,
      home,
      draw,
      away,
      tokenIds,
      live: false,
      updatedAt: now,
    });
  }
  return out;
}

/** CLOB ミッドポイント (リアルタイム) */
async function fetchMidpoint(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/midpoint?token_id=${tokenId}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { mid?: string };
    const p = parseFloat(body.mid ?? '');
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

function pairKey(a: string, b: string): string {
  return [normalize(a), normalize(b)].sort().join('|');
}

function loadCache(): OddsCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as OddsCache;
  } catch {
    /* ignore */
  }
  return { champion: {}, matchOdds: [], updatedAt: null };
}

export interface MatchOddsView {
  home: number;
  draw: number;
  away: number;
  live: boolean;
}

export function useOddsData(matches: MatchResult[]) {
  const [cache, setCache] = useState<OddsCache>(loadCache);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const persist = useCallback((next: OddsCache) => {
    setCache(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  // 優勝オッズ: 起動時 + 10 分ごと
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const champion = await fetchChampionOdds();
        if (!alive || Object.keys(champion).length === 0) return;
        persist({ ...cacheRef.current, champion, updatedAt: new Date().toISOString() });
      } catch {
        /* オッズは飾り — 失敗しても本体に影響させない */
      }
    };
    run();
    const t = setInterval(run, WINNER_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [persist]);

  // 試合オッズ一覧: 起動時 + 30 分ごと
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const matchOdds = await fetchMatchOddsList();
        if (!alive || matchOdds.length === 0) return;
        // ライブ更新済みの値は保持しつつ差し替え
        persist({ ...cacheRef.current, matchOdds, updatedAt: new Date().toISOString() });
      } catch {
        /* ignore */
      }
    };
    run();
    const t = setInterval(run, MATCH_LIST_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [persist]);

  // ライブ中の試合は CLOB で 30 秒ごとに実勢更新
  const liveKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of matches) {
      if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status)) {
        keys.add(pairKey(m.homeTeam.name, m.awayTeam.name));
      }
    }
    return keys;
  }, [matches]);

  useEffect(() => {
    if (liveKeys.size === 0) return;
    let alive = true;
    const run = async () => {
      const current = cacheRef.current;
      const targets = current.matchOdds.filter((o) =>
        liveKeys.has(pairKey(o.homeTeam, o.awayTeam)),
      );
      if (targets.length === 0) return;
      const updated = [...current.matchOdds];
      let changed = false;
      for (const o of targets) {
        const [h, d, a] = await Promise.all([
          o.tokenIds.home ? fetchMidpoint(o.tokenIds.home) : Promise.resolve(null),
          o.tokenIds.draw ? fetchMidpoint(o.tokenIds.draw) : Promise.resolve(null),
          o.tokenIds.away ? fetchMidpoint(o.tokenIds.away) : Promise.resolve(null),
        ]);
        if (h === null && d === null && a === null) continue;
        const idx = updated.findIndex(
          (x) => pairKey(x.homeTeam, x.awayTeam) === pairKey(o.homeTeam, o.awayTeam),
        );
        if (idx < 0) continue;
        updated[idx] = {
          ...updated[idx],
          home: h ?? updated[idx].home,
          draw: d ?? updated[idx].draw,
          away: a ?? updated[idx].away,
          live: true,
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
      if (alive && changed) {
        persist({ ...cacheRef.current, matchOdds: updated });
      }
    };
    run();
    const t = setInterval(run, LIVE_INTERVAL);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [liveKeys, persist]);

  // 試合 → オッズの索引 (チームペアで引く。home/away の向きも吸収)
  const oddsIndex = useMemo(() => {
    const map = new Map<string, PolyMatchOdds>();
    for (const o of cache.matchOdds) {
      const key = pairKey(o.homeTeam, o.awayTeam);
      const prev = map.get(key);
      // 同一カードが複数あれば (理論上 GS と KO の再戦) 直近の startTime を優先
      if (!prev || Math.abs(Date.parse(o.startTime) - Date.now()) < Math.abs(Date.parse(prev.startTime) - Date.now())) {
        map.set(key, o);
      }
    }
    return map;
  }, [cache.matchOdds]);

  const getMatchOdds = useCallback(
    (m: MatchResult): MatchOddsView | null => {
      const o = oddsIndex.get(pairKey(m.homeTeam.name, m.awayTeam.name));
      if (!o) return null;
      // Polymarket 側の試合日時とアプリ側がかけ離れていたら別カードとみなす
      const dt = Math.abs(Date.parse(o.startTime) - Date.parse(m.utcDate));
      if (Number.isFinite(dt) && dt > 12 * 3600 * 1000) return null;
      const flipped = normalize(o.homeTeam) !== normalize(m.homeTeam.name);
      return {
        home: flipped ? o.away : o.home,
        draw: o.draw,
        away: flipped ? o.home : o.away,
        live: o.live,
      };
    },
    [oddsIndex],
  );

  return {
    championOdds: cache.champion,
    oddsUpdatedAt: cache.updatedAt,
    getMatchOdds,
  };
}
