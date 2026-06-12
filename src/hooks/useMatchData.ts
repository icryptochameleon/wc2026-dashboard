import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RESULTS_FALLBACK_URL, RESULTS_URL } from '../config/api';
import type { MatchResult, ResultsFile } from '../types';

const CACHE_KEY = 'wc2026_matches_v2'; // v2: 旧 wc2026_matches (合成 gs-* id) と非互換のため版上げ
const IDLE_INTERVAL = 5 * 60 * 1000;
const LIVE_INTERVAL = 60 * 1000;

export type FeedState = 'live-feed' | 'cache' | 'baked' | 'synthetic';

interface UseMatchDataOpts {
  fallbackMatches: MatchResult[];
}

interface Held {
  meta: ResultsFile['meta'] | null;
  matches: MatchResult[];
  state: FeedState;
}

function isValidEnvelope(body: unknown): body is ResultsFile {
  const b = body as ResultsFile;
  return (
    !!b &&
    typeof b === 'object' &&
    !!b.meta &&
    typeof b.meta.generatedAt === 'string' &&
    Array.isArray(b.matches) &&
    b.matches.every(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        typeof m.utcDate === 'string' &&
        !!m.homeTeam?.name &&
        !!m.awayTeam?.name &&
        !!m.score?.fullTime,
    )
  );
}

function loadCache(): ResultsFile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResultsFile;
    return isValidEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 正準結果フィード (data ブランチ results.json) のポーリング。
 * - 60 秒 (ライブ窓) / 5 分 (平時)、タブ非表示中は停止し復帰時に即時再取得
 * - meta.generatedAt の単調増加ガード (CDN が古い版を返しても巻き戻さない)
 * - フォールバック: localStorage → デプロイ時スナップショット → 合成スケジュール
 */
export function useMatchData({ fallbackMatches }: UseMatchDataOpts) {
  const [held, setHeld] = useState<Held>(() => {
    const cached = loadCache();
    if (cached) return { meta: cached.meta, matches: cached.matches, state: 'cache' };
    return { meta: null, matches: fallbackMatches, state: 'synthetic' };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heldRef = useRef(held);
  heldRef.current = held;

  // 壁時計ティック: フィード凍結中でもライブ窓判定 (ポーリング間隔) を再評価する
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const accept = useCallback((envelope: ResultsFile, state: FeedState) => {
    const current = heldRef.current;
    // 単調増加ガード: 既保持より古い generatedAt は捨てる
    if (
      current.meta?.generatedAt &&
      Date.parse(envelope.meta.generatedAt) <= Date.parse(current.meta.generatedAt) &&
      current.state !== 'synthetic'
    ) {
      return false;
    }
    setHeld({ meta: envelope.meta, matches: envelope.matches, state });
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const fetchCanonical = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(RESULTS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const body = (await res.json()) as unknown;
      if (!isValidEnvelope(body)) throw new Error('feed: invalid shape');
      accept(body, 'live-feed');
    } catch (e) {
      setError((e as Error).message);
      // 深いフォールバック: 何も保持していない時だけ焼き込みスナップショットを試す
      if (heldRef.current.state === 'synthetic') {
        try {
          const res = await fetch(RESULTS_FALLBACK_URL, { cache: 'no-store' });
          if (res.ok) {
            const body = (await res.json()) as unknown;
            if (isValidEnvelope(body)) accept(body, 'baked');
          }
        } catch {
          /* 合成スケジュールのまま */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [accept]);

  const hasLive = useMemo(() => {
    void tick; // 60秒毎に再評価
    const now = Date.now();
    return held.matches.some((m) => {
      if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status)) return true;
      const t = Date.parse(m.utcDate);
      return (
        Number.isFinite(t) && now >= t - 15 * 60 * 1000 && now <= t + 150 * 60 * 1000 && m.status !== 'FINISHED'
      );
    });
  }, [held.matches, tick]);

  useEffect(() => {
    fetchCanonical();
    const interval = setInterval(() => {
      if (document.hidden) return; // 画面オフ中はポーリング停止
      fetchCanonical();
    }, hasLive ? LIVE_INTERVAL : IDLE_INTERVAL);
    const onVisible = () => {
      if (!document.hidden) fetchCanonical(); // ロック解除・タブ復帰で即時更新
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchCanonical, hasLive]);

  return {
    matches: held.matches,
    meta: held.meta,
    feedState: held.state,
    generatedAt: held.meta?.generatedAt ?? null,
    loading,
    error,
    refresh: fetchCanonical,
  };
}
