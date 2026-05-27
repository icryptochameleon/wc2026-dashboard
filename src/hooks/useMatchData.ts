import { useCallback, useEffect, useMemo, useState } from 'react';
import { FOOTBALL_DATA_BASE, FOOTBALL_DATA_COMPETITION } from '../config/api';
import type { MatchResult, MatchStage, MatchStatus } from '../types';

const CACHE_KEY = 'wc2026_matches';
const LAST_FETCH_KEY = 'wc2026_last_fetch';
const REFRESH_INTERVAL = 5 * 60 * 1000;
const LIVE_REFRESH_INTERVAL = 60 * 1000;

interface UseMatchDataOpts {
  apiKey: string;
  autoRefresh: boolean;
  fallbackMatches: MatchResult[];
}

function mapStage(s: string): MatchStage {
  const u = s?.toUpperCase?.() ?? 'GROUP_STAGE';
  if (u.includes('FINAL') && !u.includes('SEMI') && !u.includes('QUARTER') && !u.includes('THIRD'))
    return 'FINAL';
  if (u.includes('THIRD')) return 'THIRD_PLACE';
  if (u.includes('SEMI')) return 'SEMI_FINALS';
  if (u.includes('QUARTER')) return 'QUARTER_FINALS';
  if (u.includes('LAST_16') || u.includes('ROUND_OF_16')) return 'LAST_16';
  if (u.includes('LAST_32') || u.includes('ROUND_OF_32')) return 'LAST_32';
  return 'GROUP_STAGE';
}

function mapStatus(s: string): MatchStatus {
  const u = (s ?? 'SCHEDULED').toUpperCase();
  if (['SCHEDULED', 'TIMED', 'LIVE', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED'].includes(u))
    return u as MatchStatus;
  return 'SCHEDULED';
}

interface RawApiMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group?: string | null;
  matchday?: number;
  minute?: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
}

function fromApi(m: RawApiMatch): MatchResult {
  return {
    id: String(m.id),
    utcDate: m.utcDate,
    status: mapStatus(m.status),
    stage: mapStage(m.stage),
    group: m.group ?? null,
    matchday: m.matchday,
    minute: m.minute ?? null,
    homeTeam: { name: m.homeTeam?.name ?? '' },
    awayTeam: { name: m.awayTeam?.name ?? '' },
    score: {
      fullTime: m.score?.fullTime ?? { home: null, away: null },
      halfTime: m.score?.halfTime,
    },
  };
}

export function useMatchData({ apiKey, autoRefresh, fallbackMatches }: UseMatchDataOpts) {
  const [matches, setMatches] = useState<MatchResult[]>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw) as MatchResult[];
    } catch {
      /* ignore */
    }
    return fallbackMatches;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(() => localStorage.getItem(LAST_FETCH_KEY));

  const fetchMatches = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${FOOTBALL_DATA_BASE}/competitions/${FOOTBALL_DATA_COMPETITION}/matches`,
        { headers: { 'X-Auth-Token': apiKey } },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as { matches?: RawApiMatch[] };
      const list = (data.matches ?? []).map(fromApi);
      setMatches(list);
      const now = new Date().toISOString();
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      localStorage.setItem(LAST_FETCH_KEY, now);
      setLastFetch(now);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const hasLive = useMemo(
    () => matches.some((m) => ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status)),
    [matches],
  );

  useEffect(() => {
    if (!apiKey || !autoRefresh) return;
    fetchMatches();
    const interval = setInterval(
      fetchMatches,
      hasLive ? LIVE_REFRESH_INTERVAL : REFRESH_INTERVAL,
    );
    return () => clearInterval(interval);
  }, [apiKey, autoRefresh, hasLive, fetchMatches]);

  // 手動上書きを受け付ける
  const setAndCache = useCallback((next: MatchResult[]) => {
    setMatches(next);
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  }, []);

  return {
    matches,
    loading,
    error,
    lastFetch,
    refresh: fetchMatches,
    setMatches: setAndCache,
  };
}
