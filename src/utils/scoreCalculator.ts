import { PLAYERS, PLAYER_IDS, getPlayerOfTeam, normalize } from '../config/teams';
import { SCORING, stageRank } from '../config/scoring';
import type {
  MatchResult,
  PlayerId,
  PlayerScore,
  ScoreBreakdown,
  TeamScore,
  TeamStanding,
  MatchStage,
} from '../types';

function isFinished(m: MatchResult): boolean {
  return m.status === 'FINISHED';
}

function teamInMatch(team: string, m: MatchResult): 'home' | 'away' | null {
  const t = normalize(team);
  if (normalize(m.homeTeam.name) === t) return 'home';
  if (normalize(m.awayTeam.name) === t) return 'away';
  return null;
}

export function calculatePlayerScores(matches: MatchResult[]): PlayerScore[] {
  const scores: PlayerScore[] = PLAYER_IDS.map((id) => {
    const profile = PLAYERS[id];
    const teamScores: Record<string, TeamScore> = {};
    let total = 0;
    let groupPts = 0;
    let knockoutPts = 0;

    for (const team of profile.teams) {
      const breakdown: ScoreBreakdown[] = [];
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      let teamPoints = 0;
      let furthestStage: MatchStage = 'GROUP_STAGE';
      let finalResult: TeamScore['finalResult'] = null;

      // グループステージ
      const groupMatches = matches.filter(
        (m) =>
          m.stage === 'GROUP_STAGE' &&
          isFinished(m) &&
          teamInMatch(team, m) !== null,
      );
      for (const m of groupMatches) {
        const side = teamInMatch(team, m)!;
        const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
        const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
        goalsFor += tg;
        goalsAgainst += og;
        const opp = side === 'home' ? m.awayTeam.name : m.homeTeam.name;
        if (tg > og) {
          wins++;
          teamPoints += SCORING.GROUP_WIN;
          groupPts += SCORING.GROUP_WIN;
          breakdown.push({
            label: `グループ勝利 vs ${opp}`,
            points: SCORING.GROUP_WIN,
            type: 'GROUP_WIN',
          });
        } else if (tg === og) {
          draws++;
        } else {
          losses++;
        }
      }

      // ノックアウト：チームがそのステージに「出現」したら、進出ボーナス加算
      const stageBonus: Partial<Record<MatchStage, number>> = {
        LAST_32: SCORING.ROUND_OF_32,
        LAST_16: SCORING.ROUND_OF_16,
        QUARTER_FINALS: SCORING.QUARTER_FINAL,
        SEMI_FINALS: SCORING.SEMI_FINAL,
      };
      const stagesToCheck: MatchStage[] = [
        'LAST_32',
        'LAST_16',
        'QUARTER_FINALS',
        'SEMI_FINALS',
        'THIRD_PLACE',
        'FINAL',
      ];

      for (const stage of stagesToCheck) {
        const m = matches.find(
          (m) => m.stage === stage && teamInMatch(team, m) !== null,
        );
        if (!m) continue;

        const bonus = stageBonus[stage];
        if (bonus) {
          teamPoints += bonus;
          knockoutPts += bonus;
          breakdown.push({
            label: `${stageLabel(stage)} 進出`,
            points: bonus,
            type: stageToType(stage),
          });
        }
        if (stageRank(stage) > stageRank(furthestStage)) furthestStage = stage;

        // 最終ボーナス
        if (stage === 'FINAL' && isFinished(m)) {
          const side = teamInMatch(team, m)!;
          const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
          const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
          if (tg > og) {
            teamPoints += SCORING.CHAMPION;
            knockoutPts += SCORING.CHAMPION;
            finalResult = 'CHAMPION';
            breakdown.push({ label: '🏆 優勝', points: SCORING.CHAMPION, type: 'CHAMPION' });
          } else if (tg < og) {
            teamPoints += SCORING.RUNNER_UP;
            knockoutPts += SCORING.RUNNER_UP;
            finalResult = 'RUNNER_UP';
            breakdown.push({ label: '🥈 準優勝', points: SCORING.RUNNER_UP, type: 'RUNNER_UP' });
          }
        }
        if (stage === 'THIRD_PLACE' && isFinished(m)) {
          const side = teamInMatch(team, m)!;
          const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
          const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
          if (tg > og) {
            teamPoints += SCORING.THIRD_PLACE;
            knockoutPts += SCORING.THIRD_PLACE;
            finalResult = 'THIRD_PLACE';
            breakdown.push({ label: '🥉 3位', points: SCORING.THIRD_PLACE, type: 'THIRD_PLACE' });
          }
        }
      }

      // 敗退判定: 出場した最終ステージで負けていれば eliminated
      const eliminated = isEliminated(team, matches);
      const currentStage = furthestStage;

      teamScores[team] = {
        team,
        points: teamPoints,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        currentStage,
        furthestStage,
        eliminated,
        finalResult,
        breakdown,
      };
      total += teamPoints;
    }

    return {
      id,
      name: profile.name,
      color: profile.color,
      emoji: profile.emoji,
      totalPoints: total,
      groupPoints: groupPts,
      knockoutPoints: knockoutPts,
      teamScores,
      rank: 0,
    } as PlayerScore;
  });

  scores.sort((a, b) => b.totalPoints - a.totalPoints);
  let rank = 1;
  for (let i = 0; i < scores.length; i++) {
    if (i > 0 && scores[i].totalPoints === scores[i - 1].totalPoints) {
      scores[i].rank = scores[i - 1].rank;
    } else {
      scores[i].rank = rank;
    }
    rank++;
  }
  return scores;
}

function stageToType(stage: MatchStage): ScoreBreakdown['type'] {
  switch (stage) {
    case 'LAST_32':
      return 'ROUND_OF_32';
    case 'LAST_16':
      return 'ROUND_OF_16';
    case 'QUARTER_FINALS':
      return 'QUARTER_FINAL';
    case 'SEMI_FINALS':
      return 'SEMI_FINAL';
    case 'THIRD_PLACE':
      return 'THIRD_PLACE';
    case 'FINAL':
      return 'CHAMPION';
    default:
      return 'GROUP_WIN';
  }
}

function stageLabel(stage: MatchStage): string {
  return {
    GROUP_STAGE: 'グループ',
    LAST_32: 'ベスト32',
    LAST_16: 'ベスト16',
    QUARTER_FINALS: 'ベスト8',
    SEMI_FINALS: 'ベスト4',
    THIRD_PLACE: '3位決定戦',
    FINAL: '決勝',
  }[stage];
}

function isEliminated(team: string, matches: MatchResult[]): boolean {
  // 出場した最も新しいステージで完了試合があり、敗退している場合 true
  const involved = matches
    .filter((m) => teamInMatch(team, m) !== null)
    .sort((a, b) => stageRank(b.stage) - stageRank(a.stage) || new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
  for (const m of involved) {
    if (!isFinished(m)) return false; // 進行中／未開始の試合があるなら継続中
    const side = teamInMatch(team, m)!;
    const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
    const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
    if (m.stage === 'GROUP_STAGE') {
      // グループステージ全試合終了かつトーナメント進出していない場合のみ敗退
      const gMatches = matches.filter((x) => x.stage === 'GROUP_STAGE' && teamInMatch(team, x));
      const allDone = gMatches.length >= 3 && gMatches.every(isFinished);
      const advanced = matches.some((x) => x.stage !== 'GROUP_STAGE' && teamInMatch(team, x));
      if (allDone && !advanced) return true;
      return false;
    }
    // ノックアウト：敗戦したら脱落
    if (tg < og) return true;
    return false;
  }
  return false;
}

export function calculateGroupStandings(
  matches: MatchResult[],
  teams: string[],
): TeamStanding[] {
  const standings: TeamStanding[] = teams.map((t) => ({
    team: t,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));
  const idx = new Map(standings.map((s, i) => [normalize(s.team), i]));

  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue;
    if (m.status !== 'FINISHED' && m.status !== 'IN_PLAY' && m.status !== 'LIVE' && m.status !== 'PAUSED')
      continue;
    if (m.score.fullTime.home === null || m.score.fullTime.away === null) continue;
    const hi = idx.get(normalize(m.homeTeam.name));
    const ai = idx.get(normalize(m.awayTeam.name));
    if (hi === undefined || ai === undefined) continue;
    if (m.status !== 'FINISHED') continue;
    const h = standings[hi];
    const a = standings[ai];
    const hg = m.score.fullTime.home;
    const ag = m.score.fullTime.away;
    h.played++;
    a.played++;
    h.goalsFor += hg;
    h.goalsAgainst += ag;
    a.goalsFor += ag;
    a.goalsAgainst += hg;
    if (hg > ag) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (hg < ag) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  standings.forEach((s) => (s.goalDifference = s.goalsFor - s.goalsAgainst));
  return standings.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team),
  );
}

export function getRecentResults(matches: MatchResult[], limit = 10): MatchResult[] {
  return matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, limit);
}

export function getLiveMatches(matches: MatchResult[]): MatchResult[] {
  return matches.filter((m) => ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status));
}

export function getUpcomingMatches(matches: MatchResult[], limit = 5): MatchResult[] {
  const now = new Date().getTime();
  return matches
    .filter((m) => ['SCHEDULED', 'TIMED'].includes(m.status) && new Date(m.utcDate).getTime() >= now)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, limit);
}

/**
 * 各日付ごとに累積得点を返す。Recharts 用。
 */
export function buildScoreTimeline(matches: MatchResult[]): Array<Record<string, string | number>> {
  const finished = matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const dayKeys: string[] = [];
  const dayMap = new Map<string, MatchResult[]>();
  for (const m of finished) {
    const day = m.utcDate.slice(0, 10);
    if (!dayMap.has(day)) {
      dayMap.set(day, []);
      dayKeys.push(day);
    }
    dayMap.get(day)!.push(m);
  }
  const result: Array<Record<string, string | number>> = [];
  const cumulative: Record<PlayerId, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const day of dayKeys) {
    const upTo = finished.filter((m) => m.utcDate.slice(0, 10) <= day);
    const score = calculatePlayerScores(upTo);
    for (const s of score) cumulative[s.id] = s.totalPoints;
    result.push({
      date: day,
      Hammer: cumulative.A,
      PEP: cumulative.B,
      Margot: cumulative.C,
      'Cedar Pine': cumulative.D,
    });
  }
  return result;
}

export function getPlayerOfTeamSafe(team: string): PlayerId | null {
  return getPlayerOfTeam(team);
}
