import { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMatchData } from '../hooks/useMatchData';
import { useOddsData, type MatchOddsView } from '../hooks/useOddsData';
import { calculatePlayerScores } from '../utils/scoreCalculator';
import { generateDefaultSchedule } from '../data/defaultSchedule';
import type { AppSettings, ChampionOddsMap, MatchResult, PlayerId, PlayerScore } from '../types';
import { PLAYERS } from '../config/teams';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  oddsApiKey: '',
  theme: 'dark',
  timezone: 'Asia/Tokyo',
  playerNames: {
    A: PLAYERS.A.name,
    B: PLAYERS.B.name,
    C: PLAYERS.C.name,
    D: PLAYERS.D.name,
  },
  autoRefresh: true,
};

interface GameContextValue {
  settings: AppSettings;
  setSettings: (next: AppSettings | ((p: AppSettings) => AppSettings)) => void;
  matches: MatchResult[];
  setMatches: (next: MatchResult[]) => void;
  playerScores: PlayerScore[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  refresh: () => Promise<void>;
  prevRanks: Record<PlayerId, number>;
  updateMatch: (updated: MatchResult) => void;
  /** Polymarket 優勝確率 (チーム正準名 → 0-1) */
  championOdds: ChampionOddsMap;
  oddsUpdatedAt: string | null;
  getMatchOdds: (m: MatchResult) => MatchOddsView | null;
}

const Ctx = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<AppSettings>('wc2026_settings', DEFAULT_SETTINGS);
  const [prevRanks, setPrevRanks] = useLocalStorage<Record<PlayerId, number>>('wc2026_prev_ranks', {
    A: 1,
    B: 1,
    C: 1,
    D: 1,
  });

  const fallback = useMemo(() => generateDefaultSchedule(), []);
  const { matches, loading, error, lastFetch, refresh, setMatches } = useMatchData({
    apiKey: settings.apiKey,
    autoRefresh: settings.autoRefresh,
    fallbackMatches: fallback,
  });

  const { championOdds, oddsUpdatedAt, getMatchOdds } = useOddsData(matches);

  const playerScores = useMemo(() => {
    const base = calculatePlayerScores(matches);
    return base.map((p) => ({ ...p, prevRank: prevRanks[p.id] }));
  }, [matches, prevRanks]);

  // 前回順位を更新（playerScores が動いたタイミングで保存）
  useEffect(() => {
    const next: Record<PlayerId, number> = { A: 1, B: 1, C: 1, D: 1 };
    for (const p of playerScores) next[p.id] = p.rank;
    // 比較し、差がある場合のみ保存（無限ループ防止）
    const same = (Object.keys(next) as PlayerId[]).every((k) => next[k] === prevRanks[k]);
    if (!same) {
      // 5秒後に更新（直前の順位を比較に使えるようにバッファ）
      const t = setTimeout(() => setPrevRanks(next), 5000);
      return () => clearTimeout(t);
    }
  }, [playerScores, prevRanks, setPrevRanks]);

  const updateMatch = (updated: MatchResult) => {
    setMatches(matches.map((m) => (m.id === updated.id ? updated : m)));
  };

  const value: GameContextValue = {
    settings,
    setSettings,
    matches,
    setMatches,
    playerScores,
    loading,
    error,
    lastFetch,
    refresh,
    prevRanks,
    updateMatch,
    championOdds,
    oddsUpdatedAt,
    getMatchOdds,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
