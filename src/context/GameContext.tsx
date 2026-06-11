import { createContext, useCallback, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMatchData, type FeedState } from '../hooks/useMatchData';
import { useEspnLive } from '../hooks/useEspnLive';
import { useOddsData, type MatchOddsView } from '../hooks/useOddsData';
import { calculatePlayerScores } from '../utils/scoreCalculator';
import { mergeMatches } from '../utils/mergeMatches';
import { generateDefaultSchedule } from '../data/defaultSchedule';
import type {
  AppSettings,
  ChampionOddsMap,
  ManualOverride,
  MatchResult,
  PlayerId,
  PlayerScore,
  ResultsFile,
} from '../types';
import { PLAYERS } from '../config/teams';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '', // 旧フィールド (現在は未使用 — キーは GitHub Actions Secret に移行)
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
  /** マージ済みの最終形 (手動上書き > オーナー上書き > 正準 + ESPN速報) */
  matches: MatchResult[];
  playerScores: PlayerScore[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void> | void;
  prevRanks: Record<PlayerId, number>;
  /** この端末の手動上書きを書き込む (試合丸ごと渡すと差分を記録) */
  updateMatch: (updated: MatchResult) => void;
  clearOverride: (matchId: string) => void;
  clearAllOverrides: () => void;
  manualOverrides: Record<string, ManualOverride>;
  /** フィード状態 */
  feedState: FeedState;
  feedMeta: ResultsFile['meta'] | null;
  generatedAt: string | null;
  /** Polymarket オッズ */
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
  const [manualOverrides, setManualOverrides] = useLocalStorage<Record<string, ManualOverride>>(
    'wc2026_manual_overrides_v1',
    {},
  );

  const fallback = useMemo(() => generateDefaultSchedule(), []);
  const {
    matches: canonical,
    meta: feedMeta,
    feedState,
    generatedAt,
    loading,
    error,
    refresh,
  } = useMatchData({ fallbackMatches: fallback });

  // ESPN ライブ速報 (正準にフィールドパッチとして重なる)
  const espnPatches = useEspnLive(canonical);

  const matches = useMemo(
    () => mergeMatches(canonical, espnPatches, manualOverrides),
    [canonical, espnPatches, manualOverrides],
  );

  const { championOdds, oddsUpdatedAt, getMatchOdds } = useOddsData(matches);

  const playerScores = useMemo(() => {
    const base = calculatePlayerScores(matches);
    return base.map((p) => ({ ...p, prevRank: prevRanks[p.id] }));
  }, [matches, prevRanks]);

  // 前回順位を更新（playerScores が動いたタイミングで保存）
  useEffect(() => {
    const next: Record<PlayerId, number> = { A: 1, B: 1, C: 1, D: 1 };
    for (const p of playerScores) next[p.id] = p.rank;
    const same = (Object.keys(next) as PlayerId[]).every((k) => next[k] === prevRanks[k]);
    if (!same) {
      const t = setTimeout(() => setPrevRanks(next), 5000);
      return () => clearTimeout(t);
    }
  }, [playerScores, prevRanks, setPrevRanks]);

  /** 手動上書き: 渡された試合と正準の差分をこの端末に記録 (リフレッシュでも消えない) */
  const updateMatch = useCallback(
    (updated: MatchResult) => {
      setManualOverrides((prev) => ({
        ...prev,
        [updated.id]: {
          status: updated.status,
          home: updated.score.fullTime.home,
          away: updated.score.fullTime.away,
        },
      }));
    },
    [setManualOverrides],
  );

  const clearOverride = useCallback(
    (matchId: string) => {
      setManualOverrides((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    },
    [setManualOverrides],
  );

  const clearAllOverrides = useCallback(() => setManualOverrides({}), [setManualOverrides]);

  const value: GameContextValue = {
    settings,
    setSettings,
    matches,
    playerScores,
    loading,
    error,
    refresh,
    prevRanks,
    updateMatch,
    clearOverride,
    clearAllOverrides,
    manualOverrides,
    feedState,
    feedMeta,
    generatedAt,
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
