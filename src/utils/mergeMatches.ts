import type { ManualOverride, MatchResult, MatchStatus } from '../types';

/** ESPN ライブレイヤーが当てるフィールドパッチ */
export interface EspnPatch {
  home: number | null;
  away: number | null;
  minute: number | null;
  /** ESPN 上のステータス (FINISHED は espnFinal フラグに落とす) */
  status: MatchStatus;
}

const STATUS_RANK: Record<string, number> = {
  SCHEDULED: 0,
  TIMED: 0,
  POSTPONED: 0,
  CANCELLED: 0,
  LIVE: 1,
  IN_PLAY: 1,
  PAUSED: 1,
  FINISHED: 2,
};

function rank(s: MatchStatus): number {
  return STATUS_RANK[s] ?? 0;
}

/**
 * 1 試合分の最終形を組み立てる。優先順位:
 *   1. この端末の手動上書き (完全勝ち)
 *   2. 正準データの source:'override' (オーナー上書き — そのまま)
 *   3. 正準データ + ESPN フィールドパッチ
 *      - 正準が FINISHED なら ESPN は触らない
 *      - ESPN のステータスは IN_PLAY/PAUSED 止まり (FINISHED は espnFinal フラグのみ)
 *      - ステータスは前進のみ (正準 IN_PLAY を ESPN の TIMED で巻き戻さない)
 *
 * 得点計算 (calculatePlayerScores) は status==='FINISHED' しか数えないため、
 * ポイント確定は常に 正準 FINISHED / オーナー上書き / 手動入力 のどれかで起こる。
 */
export function mergeMatch(
  canonical: MatchResult,
  espn: EspnPatch | undefined,
  manual: ManualOverride | undefined,
): MatchResult {
  let m = canonical;

  if (espn && m.status !== 'FINISHED' && m.source !== 'override') {
    const espnIsFinal = espn.status === 'FINISHED';
    const cappedStatus: MatchStatus = espnIsFinal ? 'IN_PLAY' : espn.status;
    const nextStatus = rank(cappedStatus) > rank(m.status) ? cappedStatus : m.status;
    m = {
      ...m,
      status: nextStatus,
      minute: espn.minute ?? m.minute,
      espnFinal: espnIsFinal || undefined,
      score: {
        ...m.score,
        fullTime: {
          home: espn.home ?? m.score.fullTime.home,
          away: espn.away ?? m.score.fullTime.away,
        },
      },
    };
  }

  if (manual && (manual.status !== undefined || manual.home !== undefined || manual.away !== undefined)) {
    m = {
      ...m,
      status: manual.status ?? m.status,
      espnFinal: undefined,
      source: 'manual',
      score: {
        ...m.score,
        fullTime: {
          home: manual.home !== undefined ? manual.home : m.score.fullTime.home,
          away: manual.away !== undefined ? manual.away : m.score.fullTime.away,
        },
      },
    };
  }

  return m;
}

export function mergeMatches(
  canonical: MatchResult[],
  espnPatches: Record<string, EspnPatch>,
  manualOverrides: Record<string, ManualOverride>,
): MatchResult[] {
  return canonical.map((c) => mergeMatch(c, espnPatches[c.id], manualOverrides[c.id]));
}
