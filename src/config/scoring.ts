export const SCORING = {
  GROUP_WIN: 3000,
  GROUP_DRAW: 0,
  GROUP_LOSS: 0,
  ROUND_OF_32: 10000,
  ROUND_OF_16: 20000,
  QUARTER_FINAL: 30000,
  SEMI_FINAL: 50000,
  THIRD_PLACE: 60000,
  RUNNER_UP: 75000,
  CHAMPION: 100000,
} as const;

export const STAGE_LABEL_JA: Record<string, string> = {
  GROUP_STAGE: 'グループ',
  LAST_32: 'ベスト32',
  LAST_16: 'ベスト16',
  QUARTER_FINALS: 'ベスト8',
  SEMI_FINALS: 'ベスト4',
  THIRD_PLACE: '3位決定戦',
  FINAL: '決勝',
  CHAMPION: '優勝',
  RUNNER_UP: '準優勝',
  THIRD: '3位',
  ELIMINATED: '敗退',
};

export const STAGE_ORDER = [
  'GROUP_STAGE',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
] as const;

export function stageRank(stage: string): number {
  return STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
}
