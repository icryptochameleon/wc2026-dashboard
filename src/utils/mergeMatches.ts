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

/** グループステージの試合がこれより早く正規に終わることはない (45+HT15+45=105分) */
const MIN_FULL_TIME_MS = 105 * 60 * 1000;

/**
 * 1 試合分の最終形を組み立てる。優先順位:
 *   1. この端末の手動上書き (完全勝ち)
 *   2. 正準データの source:'override' (オーナー上書き — そのまま)
 *   3. 正準データ + ESPN フィールドパッチ
 *      - 正準が FINISHED なら ESPN は触らない
 *      - ステータスは前進のみ (正準 IN_PLAY を ESPN の TIMED で巻き戻さない)
 *      - ESPN の FINISHED は原則 espnFinal フラグ止まり (IN_PLAY にキャップ) だが、
 *        キックオフから 105 分以上経過していれば本物の FINISHED に昇格する
 *        (正準フィードの更新が遅延してもポイントが確定するように。
 *         espnFinal フラグは「速報確定」バッジとして残し、後で正準 FINISHED が来たら消える)
 */
export function mergeMatch(
  canonical: MatchResult,
  espn: EspnPatch | undefined,
  manual: ManualOverride | undefined,
): MatchResult {
  let m = canonical;

  if (espn && m.status !== 'FINISHED' && m.source !== 'override') {
    const espnIsFinal = espn.status === 'FINISHED';
    const kickoff = Date.parse(m.utcDate);
    const fullTimePlausible =
      Number.isFinite(kickoff) && Date.now() - kickoff >= MIN_FULL_TIME_MS;
    // ESPN の試合終了報は、時間的に妥当なら確定として採用 (正準待ちでポイントを止めない)
    const promoteFinal = espnIsFinal && fullTimePlausible;
    const cappedStatus: MatchStatus = promoteFinal
      ? 'FINISHED'
      : espnIsFinal
        ? 'IN_PLAY'
        : espn.status;
    const nextStatus = rank(cappedStatus) > rank(m.status) ? cappedStatus : m.status;
    m = {
      ...m,
      status: nextStatus,
      minute: nextStatus === 'FINISHED' ? null : (espn.minute ?? m.minute),
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
