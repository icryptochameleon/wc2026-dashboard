import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ESPN_SCOREBOARD_BASE } from '../config/api';
import { canonicalTeam } from '../config/odds';
import { normalize } from '../config/teams';
import type { EspnPatch } from '../utils/mergeMatches';
import type { MatchResult, MatchStatus } from '../types';

const LIVE_POLL_MS = 30 * 1000;
const BREAKER_POLL_MS = 5 * 60 * 1000;
const BREAKER_THRESHOLD = 3;

/**
 * ESPN が報じた試合終了 (FINISHED パッチ) の永続ストア。
 * ライブ窓が閉じるとポーリングのパッチは消えるため、ここに残して
 * 正準フィードが FINISHED を配るまでポイント確定を維持する。
 */
const FINALS_KEY = 'wc2026_espn_finals_v1';
const FINALS_TTL_MS = 7 * 24 * 3600 * 1000;

type FinalsMap = Record<string, EspnPatch & { recordedAt: string }>;

function loadFinals(): FinalsMap {
  try {
    const raw = localStorage.getItem(FINALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FinalsMap;
    // 古いエントリは掃除 (正準が追いつけば不要になる)
    const cutoff = Date.now() - FINALS_TTL_MS;
    const out: FinalsMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Date.parse(v.recordedAt) > cutoff) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

interface RawEspnEvent {
  id?: string | number;
  date?: string;
  status?: { displayClock?: string; type?: { name?: string; state?: string } };
  competitions?: {
    date?: string;
    status?: { displayClock?: string; type?: { name?: string; state?: string } };
    competitors?: {
      homeAway?: string;
      score?: string | number;
      team?: { displayName?: string; name?: string; abbreviation?: string };
    }[];
  }[];
}

function espnStatus(ev: RawEspnEvent): MatchStatus {
  const t = ev.status?.type ?? ev.competitions?.[0]?.status?.type ?? {};
  if (t.state === 'pre') return 'TIMED';
  if (t.state === 'in') return /HALFTIME/i.test(t.name ?? '') ? 'PAUSED' : 'IN_PLAY';
  if (t.state === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

function espnMinute(ev: RawEspnEvent): number | null {
  const disp = ev.status?.displayClock ?? ev.competitions?.[0]?.status?.displayClock ?? '';
  const n = parseInt(String(disp), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ymdUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * ESPN 非公式スコアボードのライブ速報レイヤー。
 * - ライブ窓 (進行中 or キックオフ±[15分前, 150分後]) のときだけ 30 秒ポーリング
 * - JST 深夜跨ぎ対策: 窓内試合の UTC 日付ごとに照会 (最大 2 日分)
 * - espnId クロスワーク優先、なければ チームペア+キックオフ±20分 で照合。不明イベントは捨てる
 * - 3 連続失敗で 5 分間隔に退避 (サーキットブレーカー)。ESPN は飾りレイヤー — 死んでも本体は無傷
 */
export function useEspnLive(matches: MatchResult[]): Record<string, EspnPatch> {
  const [patches, setPatches] = useState<Record<string, EspnPatch>>({});
  const [finals, setFinals] = useState<FinalsMap>(loadFinals);
  const failsRef = useRef(0);

  const recordFinals = useCallback((next: Record<string, EspnPatch>) => {
    const finalEntries = Object.entries(next).filter(([, p]) => p.status === 'FINISHED');
    if (finalEntries.length === 0) return;
    setFinals((prev) => {
      const merged = { ...prev };
      let changed = false;
      for (const [id, p] of finalEntries) {
        const existing = merged[id];
        if (
          !existing ||
          existing.home !== p.home ||
          existing.away !== p.away
        ) {
          merged[id] = { ...p, recordedAt: new Date().toISOString() };
          changed = true;
        }
      }
      if (!changed) return prev;
      try {
        localStorage.setItem(FINALS_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }, []);

  const windowMatches = useMemo(() => {
    const now = Date.now();
    return matches.filter((m) => {
      if (m.status === 'FINISHED') return false;
      if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status)) return true;
      const t = Date.parse(m.utcDate);
      return Number.isFinite(t) && now >= t - 15 * 60 * 1000 && now <= t + 150 * 60 * 1000;
    });
  }, [matches]);

  const active = windowMatches.length > 0;

  useEffect(() => {
    if (!active) {
      setPatches((p) => (Object.keys(p).length ? {} : p));
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const espnIdIndex = new Map<string, string>(); // espnId -> match.id
    const pairIndex = new Map<string, { id: string; utc: number }[]>();
    for (const m of windowMatches) {
      if (m.espnId) espnIdIndex.set(String(m.espnId), m.id);
      const key = [normalize(m.homeTeam.name), normalize(m.awayTeam.name)].sort().join('|');
      const arr = pairIndex.get(key) ?? [];
      arr.push({ id: m.id, utc: Date.parse(m.utcDate) });
      pairIndex.set(key, arr);
    }
    const dates = [...new Set(windowMatches.map((m) => ymdUTC(Date.parse(m.utcDate))))].slice(0, 2);

    const poll = async () => {
      try {
        const seen = new Map<string, RawEspnEvent>();
        for (const d of dates) {
          const res = await fetch(`${ESPN_SCOREBOARD_BASE}?dates=${d}`);
          if (!res.ok) throw new Error(`espn ${res.status}`);
          const body = (await res.json()) as { events?: RawEspnEvent[] };
          for (const ev of body.events ?? []) {
            if (ev?.id != null && !seen.has(String(ev.id))) seen.set(String(ev.id), ev);
          }
        }
        const next: Record<string, EspnPatch> = {};
        for (const ev of seen.values()) {
          const comp = ev.competitions?.[0];
          const competitors = comp?.competitors ?? [];
          if (competitors.length < 2) continue;
          const homeC = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
          const awayC = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
          const home =
            canonicalTeam(homeC.team?.displayName ?? '') ??
            canonicalTeam(homeC.team?.name ?? '') ??
            canonicalTeam(homeC.team?.abbreviation ?? '');
          const away =
            canonicalTeam(awayC.team?.displayName ?? '') ??
            canonicalTeam(awayC.team?.name ?? '') ??
            canonicalTeam(awayC.team?.abbreviation ?? '');

          // クロスワーク: espnId → なければ チームペア + キックオフ±20分
          let matchKey = ev.id != null ? espnIdIndex.get(String(ev.id)) : undefined;
          if (!matchKey && home && away) {
            const key = [normalize(home), normalize(away)].sort().join('|');
            const evTime = Date.parse(ev.date ?? comp?.date ?? '');
            const cands = pairIndex.get(key) ?? [];
            const hit = cands.find(
              (c) => Number.isFinite(evTime) && Math.abs(c.utc - evTime) <= 20 * 60 * 1000,
            );
            matchKey = hit?.id;
          }
          if (!matchKey || !home || !away) continue; // 照合できないイベントは推測しない

          const toScore = (v: unknown) => {
            const n = parseInt(String(v ?? ''), 10);
            return Number.isFinite(n) ? n : null;
          };
          const status = espnStatus(ev);
          if (status === 'TIMED' || status === 'SCHEDULED') continue; // 開始前は何も当てない
          next[matchKey] = {
            home: toScore(homeC.score),
            away: toScore(awayC.score),
            minute: espnMinute(ev),
            status,
          };
        }
        if (alive) {
          failsRef.current = 0;
          setPatches(next);
          recordFinals(next);
        }
      } catch {
        failsRef.current += 1;
      } finally {
        if (alive) {
          const delay = failsRef.current >= BREAKER_THRESHOLD ? BREAKER_POLL_MS : LIVE_POLL_MS;
          timer = setTimeout(poll, delay);
        }
      }
    };

    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [active, windowMatches, recordFinals]);

  // 永続化済みの確定報を土台に、ライブ中のパッチを上に重ねて返す。
  // 正準フィードが FINISHED を配り始めた試合の分は mergeMatch 側で自然に無視される。
  return useMemo(() => {
    const out: Record<string, EspnPatch> = {};
    const canonicalFinished = new Set(
      matches.filter((m) => m.status === 'FINISHED').map((m) => m.id),
    );
    for (const [id, f] of Object.entries(finals)) {
      if (!canonicalFinished.has(id)) {
        out[id] = { home: f.home, away: f.away, minute: null, status: 'FINISHED' };
      }
    }
    return { ...out, ...patches };
  }, [finals, patches, matches]);
}
