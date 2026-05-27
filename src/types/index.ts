export type PlayerId = 'A' | 'B' | 'C' | 'D';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  color: string;
  emoji: string;
  teams: string[];
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'LIVE'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export type MatchStage =
  | 'GROUP_STAGE'
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

export interface MatchResult {
  id: string;
  utcDate: string;
  status: MatchStatus;
  stage: MatchStage;
  group: string | null;
  matchday?: number;
  minute?: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
  scorers?: { player: string; minute: number; team: string }[];
}

export interface TeamStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TeamScore {
  team: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  currentStage: MatchStage;
  furthestStage: MatchStage;
  eliminated: boolean;
  finalResult?: 'CHAMPION' | 'RUNNER_UP' | 'THIRD_PLACE' | null;
  breakdown: ScoreBreakdown[];
}

export interface ScoreBreakdown {
  label: string;
  points: number;
  type:
    | 'GROUP_WIN'
    | 'GROUP_DRAW'
    | 'GROUP_LOSS'
    | 'ROUND_OF_32'
    | 'ROUND_OF_16'
    | 'QUARTER_FINAL'
    | 'SEMI_FINAL'
    | 'THIRD_PLACE'
    | 'RUNNER_UP'
    | 'CHAMPION';
}

export interface PlayerScore {
  id: PlayerId;
  name: string;
  color: string;
  emoji: string;
  totalPoints: number;
  groupPoints: number;
  knockoutPoints: number;
  teamScores: Record<string, TeamScore>;
  rank: number;
  prevRank?: number;
}

export interface MatchOddsEntry {
  matchId: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  updatedAt: string;
}

export interface ChampionOddsEntry {
  team: string;
  probability: number;
}

export interface AppSettings {
  apiKey: string;
  oddsApiKey: string;
  theme: 'dark' | 'light';
  timezone: string;
  playerNames: Record<PlayerId, string>;
  lastUpdated?: string;
  autoRefresh: boolean;
}
