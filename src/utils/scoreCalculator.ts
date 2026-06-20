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
      let groupTeamPoints = 0;
      let knockoutTeamPoints = 0;
      let furthestStage: MatchStage = 'GROUP_STAGE';
      let finalResult: TeamScore['finalResult'] = null;

      // ───────── 予選リーグ (1試合ごと加算: 勝 +3000 / 分 0 / 負 -3000) ─────────
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
          groupTeamPoints += SCORING.GROUP_WIN;
          breakdown.push({
            label: `グループ勝利 vs ${opp}`,
            points: SCORING.GROUP_WIN,
            type: 'GROUP_WIN',
          });
        } else if (tg === og) {
          draws++;
          // 引き分けは ±0 (内訳には記録しない)
        } else {
          losses++;
          groupTeamPoints += SCORING.GROUP_LOSS;
          breakdown.push({
            label: `グループ敗戦 vs ${opp}`,
            points: SCORING.GROUP_LOSS,
            type: 'GROUP_LOSS',
          });
        }
      }

      // ───────── トーナメント (排他式: 最終到達ステージのポイントのみ) ─────────
      // チームが出場したノックアウトステージを最も奥のものから判定する。
      const stagesByRank: MatchStage[] = [
        'FINAL',
        'THIRD_PLACE',
        'SEMI_FINALS',
        'QUARTER_FINALS',
        'LAST_16',
        'LAST_32',
      ];
      let knockoutAward: { label: string; points: number; type: ScoreBreakdown['type'] } | null = null;

      for (const stage of stagesByRank) {
        const m = matches.find((x) => x.stage === stage && teamInMatch(team, x) !== null);
        if (!m) continue;
        furthestStage = stage;

        if (stage === 'FINAL') {
          if (isFinished(m)) {
            const side = teamInMatch(team, m)!;
            const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
            const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
            if (tg > og) {
              finalResult = 'CHAMPION';
              knockoutAward = { label: '🏆 優勝', points: SCORING.CHAMPION, type: 'CHAMPION' };
            } else {
              finalResult = 'RUNNER_UP';
              knockoutAward = { label: '🥈 準優勝', points: SCORING.RUNNER_UP, type: 'RUNNER_UP' };
            }
          } else {
            // 決勝進出済み・未終了 → 最低でも準優勝確定
            knockoutAward = { label: '🏟 決勝進出 (暫定: 準優勝扱い)', points: SCORING.RUNNER_UP, type: 'RUNNER_UP' };
          }
        } else if (stage === 'THIRD_PLACE') {
          if (isFinished(m)) {
            const side = teamInMatch(team, m)!;
            const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
            const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
            if (tg > og) {
              finalResult = 'THIRD_PLACE';
              knockoutAward = { label: '🥉 3位', points: SCORING.THIRD_PLACE, type: 'THIRD_PLACE' };
            } else {
              // 4位 = SF 敗退と同じ 50,000
              knockoutAward = { label: '4位 (SF敗退と同点)', points: SCORING.SEMI_FINAL, type: 'SEMI_FINAL' };
            }
          } else {
            // 3位決定戦 未消化 → SF 敗退分だけ暫定確定
            knockoutAward = { label: '🏟 3位決定戦進出 (暫定: SF敗退分)', points: SCORING.SEMI_FINAL, type: 'SEMI_FINAL' };
          }
        } else if (stage === 'SEMI_FINALS') {
          knockoutAward = { label: 'ベスト4 到達', points: SCORING.SEMI_FINAL, type: 'SEMI_FINAL' };
        } else if (stage === 'QUARTER_FINALS') {
          knockoutAward = { label: 'ベスト8 到達', points: SCORING.QUARTER_FINAL, type: 'QUARTER_FINAL' };
        } else if (stage === 'LAST_16') {
          knockoutAward = { label: 'ベスト16 到達', points: SCORING.ROUND_OF_16, type: 'ROUND_OF_16' };
        } else if (stage === 'LAST_32') {
          knockoutAward = { label: 'ベスト32 到達', points: SCORING.ROUND_OF_32, type: 'ROUND_OF_32' };
        }
        break; // 最も奥のステージで打ち切り (排他)
      }

      if (knockoutAward) {
        knockoutTeamPoints = knockoutAward.points;
        breakdown.push(knockoutAward);
      }

      const teamPoints = groupTeamPoints + knockoutTeamPoints;
      groupPts += groupTeamPoints;
      knockoutPts += knockoutTeamPoints;

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

/**
 * グループ内で「2位以内 (Best32 自動突破) を数学的に確定」したチームを返す。
 *
 * 残り全試合 (未終了 = SCHEDULED/TIMED/IN_PLAY/...) の勝/分/負を総当たりで列挙し、
 * どの結果になっても X より勝点が同点以上のチームが 1 つ以下なら、X は最悪でも 2 位。
 * 直接対戦 (例: 3位4位候補同士が潰し合う) も列挙に含まれるため正しく確定できる。
 * 得点差は仮想試合では不定なので「同点以上 = 上位になり得る」と安全側に数える。
 */
export function computeClinchedTop2(
  matches: MatchResult[],
  teams: string[],
): Set<string> {
  const base: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (const t of teams) {
    base[t] = 0;
    played[t] = 0;
  }
  const inGroup = new Map(teams.map((t) => [normalize(t), t]));

  const remaining: Array<[string, string]> = [];
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue;
    const home = inGroup.get(normalize(m.homeTeam.name));
    const away = inGroup.get(normalize(m.awayTeam.name));
    if (!home || !away) continue;
    if (isFinished(m) && m.score.fullTime.home !== null && m.score.fullTime.away !== null) {
      const hg = m.score.fullTime.home;
      const ag = m.score.fullTime.away;
      played[home]++;
      played[away]++;
      if (hg > ag) base[home] += 3;
      else if (hg < ag) base[away] += 3;
      else {
        base[home]++;
        base[away]++;
      }
    } else {
      remaining.push([home, away]);
    }
  }

  const clinched = new Set<string>();
  const total = 3 ** remaining.length;
  for (const x of teams) {
    if (played[x] === 0) continue; // 未消化チームは確定し得ない
    let safe = true;
    for (let combo = 0; combo < total && safe; combo++) {
      const pts = { ...base };
      let c = combo;
      for (const [h, a] of remaining) {
        const o = c % 3;
        c = (c - o) / 3;
        if (o === 0) pts[h] += 3;
        else if (o === 1) pts[a] += 3;
        else {
          pts[h]++;
          pts[a]++;
        }
      }
      let atOrAbove = 0;
      for (const y of teams) {
        if (y !== x && pts[y] >= pts[x]) atOrAbove++;
      }
      if (atOrAbove > 1) safe = false; // 2 チーム以上に抜かれ得る → 未確定
    }
    if (safe) clinched.add(x);
  }
  return clinched;
}

/** 指定グループの全試合を日時順で返す (順位表の展開表示用) */
export function getGroupMatches(matches: MatchResult[], teams: string[]): MatchResult[] {
  const set = new Set(teams.map(normalize));
  return matches
    .filter(
      (m) =>
        m.stage === 'GROUP_STAGE' &&
        set.has(normalize(m.homeTeam.name)) &&
        set.has(normalize(m.awayTeam.name)),
    )
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
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
