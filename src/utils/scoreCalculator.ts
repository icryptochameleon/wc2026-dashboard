import { GROUPS, PLAYERS, PLAYER_IDS, getGroupOfTeam, getPlayerOfTeam, normalize } from '../config/teams';
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

/** 両チームが同一の設定グループに属する本物の予選試合か (越境誤分類を弾く) */
function isRealGroupMatch(m: MatchResult): boolean {
  const hg = getGroupOfTeam(m.homeTeam.name);
  const ag = getGroupOfTeam(m.awayTeam.name);
  return hg !== null && hg === ag;
}

function teamInMatch(team: string, m: MatchResult): 'home' | 'away' | null {
  const t = normalize(team);
  if (normalize(m.homeTeam.name) === t) return 'home';
  if (normalize(m.awayTeam.name) === t) return 'away';
  return null;
}

/**
 * チームがその試合に勝ったか。score.winner (PK 決着を含む) を最優先し、
 * 無い場合のみ fullTime のスコア差で判定する (予選の引分はここでは false)。
 */
function wonMatch(team: string, m: MatchResult): boolean {
  const side = teamInMatch(team, m);
  if (!side) return false;
  if (m.score.winner === 'HOME') return side === 'home';
  if (m.score.winner === 'AWAY') return side === 'away';
  if (m.score.winner === 'DRAW') return false;
  const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
  const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
  return tg > og;
}

/** チームがその試合に負けたか (PK 敗退を含む)。 */
function lostMatch(team: string, m: MatchResult): boolean {
  const side = teamInMatch(team, m);
  if (!side) return false;
  if (m.score.winner === 'HOME') return side === 'away';
  if (m.score.winner === 'AWAY') return side === 'home';
  if (m.score.winner === 'DRAW') return false;
  const tg = (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
  const og = (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
  return tg < og;
}

export function calculatePlayerScores(matches: MatchResult[]): PlayerScore[] {
  const qualified = computeQualifiedSet(matches); // ベスト32 進出済み (KO 組合せ未確定でも判定)
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
      // 防御: ステージ誤分類 (例: R32 が GROUP_STAGE に化ける) で越境対戦が予選に
      // 混入しても汚染しないよう、同一設定グループ同士の試合のみ採用する。
      const groupMatches = matches.filter(
        (m) =>
          m.stage === 'GROUP_STAGE' &&
          isFinished(m) &&
          teamInMatch(team, m) !== null &&
          isRealGroupMatch(m),
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

      // ───────── トーナメント (排他式・敗退/順位確定時に付与) ─────────
      // LOCKED = 敗退や順位が確定して初めて入る排他ポイント (合計に算入)。
      // SECURED = 生き残り中チームが現時点で確保済みの最低保証 (表示専用・合計外)。
      // チームの「終着試合」= 出場した最も奥の KO 試合。勝てば必ず次ステージの試合が
      // 生成されるので、各チームは自分の終着試合に着地する。付与は出場ではなく勝敗で分岐。
      const stagesByRank: MatchStage[] = [
        'FINAL',
        'THIRD_PLACE',
        'SEMI_FINALS',
        'QUARTER_FINALS',
        'LAST_16',
        'LAST_32',
      ];
      let knockoutAward: { label: string; points: number; type: ScoreBreakdown['type'] } | null = null;
      let securedPoints = 0;
      let inThirdPlaceMatch = false;

      let terminal: MatchResult | null = null;
      let tStage: MatchStage | null = null;
      for (const stage of stagesByRank) {
        const m = matches.find((x) => x.stage === stage && teamInMatch(team, x) !== null);
        if (m) {
          terminal = m;
          tStage = stage;
          break;
        }
      }

      if (terminal && tStage) {
        furthestStage = tStage;
        const fin = isFinished(terminal);
        const won = fin && wonMatch(team, terminal);
        const lost = fin && lostMatch(team, terminal);

        // ルール: ポイントが LOCKED されるのは「次の試合が無くなった時」だけ。
        //   - R32/R16/QF で敗北 = そこで終わり → 加点
        //   - 準決勝は勝敗どちらも次がある (決勝 / 3位決定戦) → 未確定 (0)
        //   - 3位決定戦・決勝で決着 = 終着 → 加点 (3位/4位/準優勝/優勝)
        //   - 勝ち上がり中・試合前 → 未確定 (0)。securedPoints は表示専用の最低保証。
        switch (tStage) {
          case 'FINAL':
            if (!fin) {
              securedPoints = SCORING.RUNNER_UP; // 決勝待ち = 最低準優勝が保証 (LOCKED は 0)
            } else if (won) {
              finalResult = 'CHAMPION';
              knockoutAward = { label: '🏆 優勝', points: SCORING.CHAMPION, type: 'CHAMPION' };
            } else {
              finalResult = 'RUNNER_UP';
              knockoutAward = { label: '🥈 準優勝', points: SCORING.RUNNER_UP, type: 'RUNNER_UP' };
            }
            break;
          case 'THIRD_PLACE':
            if (!fin) {
              securedPoints = SCORING.SEMI_FINAL; // 3位決定戦待ち = 最低 4位 50k (LOCKED は 0)
            } else if (won) {
              finalResult = 'THIRD_PLACE';
              knockoutAward = { label: '🥉 3位', points: SCORING.THIRD_PLACE, type: 'THIRD_PLACE' };
            } else {
              knockoutAward = { label: '4位 (3位決定戦で敗退)', points: SCORING.SEMI_FINAL, type: 'SEMI_FINAL' };
            }
            break;
          case 'SEMI_FINALS':
            // 勝てば決勝、負ければ 3位決定戦 — どちらも次の試合があるので未確定 (LOCKED 0)。
            securedPoints = won ? SCORING.RUNNER_UP : SCORING.SEMI_FINAL;
            inThirdPlaceMatch = lost; // 敗者は 3位決定戦へ (敗退表示にしない)
            break;
          case 'QUARTER_FINALS':
            if (lost) {
              knockoutAward = { label: 'ベスト8で敗退', points: SCORING.QUARTER_FINAL, type: 'QUARTER_FINAL' };
            } else {
              securedPoints = won ? SCORING.SEMI_FINAL : SCORING.QUARTER_FINAL;
            }
            break;
          case 'LAST_16':
            if (lost) {
              knockoutAward = { label: 'ベスト16で敗退', points: SCORING.ROUND_OF_16, type: 'ROUND_OF_16' };
            } else {
              securedPoints = won ? SCORING.QUARTER_FINAL : SCORING.ROUND_OF_16;
            }
            break;
          case 'LAST_32':
            if (lost) {
              knockoutAward = { label: 'ベスト32で敗退', points: SCORING.ROUND_OF_32, type: 'ROUND_OF_32' };
            } else {
              securedPoints = won ? SCORING.ROUND_OF_16 : 0; // 未消化 R32 = 確定 0 (幻ポイント修正の核心)
            }
            break;
        }
      }

      if (knockoutAward) {
        knockoutTeamPoints = knockoutAward.points;
        breakdown.push(knockoutAward);
      }

      const teamPoints = groupTeamPoints + knockoutTeamPoints;
      // SECURED は総合の最低保証 = 予選 + (KO floor と LOCKED の大きい方)
      securedPoints = groupTeamPoints + Math.max(securedPoints, knockoutTeamPoints);
      groupPts += groupTeamPoints;
      knockoutPts += knockoutTeamPoints;

      const eliminated = isEliminated(team, matches, qualified);
      const currentStage = furthestStage;

      teamScores[team] = {
        team,
        points: teamPoints,
        securedPoints,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        currentStage,
        furthestStage,
        eliminated,
        inThirdPlaceMatch,
        finalResult,
        breakdown,
      };
      total += teamPoints; // 合計は LOCKED のみ (securedPoints は算入しない)
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

/**
 * ベスト32 に進出済みのチーム集合。
 * - 全試合終了グループの上位2位 (実順位 = 得失点差込み)
 * - 3位ワイルドカード圏内 (上位8の3位)
 * KO の組み合わせがまだフィードに無くても「突破済み」を正しく判定するために使う。
 */
function computeQualifiedSet(matches: MatchResult[]): Set<string> {
  const qualified = new Set<string>();
  for (const teams of Object.values(GROUPS)) {
    const st = calculateGroupStandings(matches, teams);
    if (st.every((s) => s.played >= 3)) {
      if (st[0]) qualified.add(st[0].team);
      if (st[1]) qualified.add(st[1].team);
    }
  }
  for (const e of computeThirdPlaceRace(matches, GROUPS)) {
    if (e.inZone) qualified.add(e.team);
  }
  return qualified;
}

function isEliminated(team: string, matches: MatchResult[], qualified: Set<string>): boolean {
  // KO に出ているなら、最も奥の KO 試合の結果で判定
  const ko = matches
    .filter((m) => m.stage !== 'GROUP_STAGE' && teamInMatch(team, m) !== null)
    .sort((a, b) => stageRank(b.stage) - stageRank(a.stage));
  if (ko.length > 0) {
    const top = ko[0];
    if (!isFinished(top)) return false; // 試合前/進行中は継続
    if (top.stage === 'SEMI_FINALS') return false; // 準決勝敗者は 3 位決定戦へ (敗退でない)
    // R32/R16/QF 敗戦・決勝で準優勝・3位決定戦の決着 → 敗退。優勝は false (🏆 表示)。
    return lostMatch(team, top);
  }
  // KO 試合がまだ無い: 予選全消化かつ「突破済み」でなければ敗退
  const g = matches.filter(
    (m) => m.stage === 'GROUP_STAGE' && teamInMatch(team, m) !== null && isRealGroupMatch(m),
  );
  if (g.length < 3 || !g.every(isFinished)) return false; // 予選消化中は継続
  return !qualified.has(team); // 突破済みなら敗退ではない (R32 の組み合わせ待ち)
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

  // 全試合終了済みなら、得失点差等のタイブレーク込みの実順位で上位 2 を確定。
  // (勝点同点の 2 位/3 位を「同点以上」で未確定にしてしまうバグを回避)
  if (remaining.length === 0) {
    const finalStandings = calculateGroupStandings(matches, teams);
    for (const s of finalStandings.slice(0, 2)) {
      if (played[s.team] >= 3) clinched.add(s.team);
    }
    return clinched;
  }

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

/** あるグループの「3位チームが取りうる最大勝点」を残り試合の総当たりで求める */
function maxThirdPlacePoints(matches: MatchResult[], teams: string[]): number {
  const base: Record<string, number> = {};
  const inGroup = new Map(teams.map((t) => [normalize(t), t]));
  for (const t of teams) base[t] = 0;
  const remaining: Array<[string, string]> = [];
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue;
    const home = inGroup.get(normalize(m.homeTeam.name));
    const away = inGroup.get(normalize(m.awayTeam.name));
    if (!home || !away) continue;
    if (isFinished(m) && m.score.fullTime.home !== null && m.score.fullTime.away !== null) {
      const hg = m.score.fullTime.home;
      const ag = m.score.fullTime.away;
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
  let best = 0;
  const total = 3 ** remaining.length;
  for (let combo = 0; combo < total; combo++) {
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
    const sorted = teams.map((t) => pts[t]).sort((x, y) => y - x);
    if (sorted[2] > best) best = sorted[2]; // 3 番目に高い勝点
  }
  return best;
}

export interface ThirdPlaceEntry {
  team: string;
  group: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  played: number;
  complete: boolean;
  rank: number; // 1-12 (3位チーム同士の順位)
  inZone: boolean; // 現時点で上位 8 (= 突破圏内)
  status: 'confirmed' | 'zone' | 'out'; // confirmed = 数学的に突破確定
}

/**
 * 12 グループの 3 位チームを勝点・得失点で並べた「ワイルドカード当落」。
 * 上位 8 がベスト32 進出。`confirmed` は全試合終了済みグループの 3 位のうち、
 * 他グループ 3 位が最大化しても上位 8 から外れ得ないチーム (安全側の確定判定)。
 */
export function computeThirdPlaceRace(matches: MatchResult[], groups: Record<string, string[]>): ThirdPlaceEntry[] {
  const entries: Array<Omit<ThirdPlaceEntry, 'rank' | 'inZone' | 'status'> & { letter: string }> = [];
  const maxByGroup: Record<string, number> = {};
  for (const [letter, teams] of Object.entries(groups)) {
    const st = calculateGroupStandings(matches, teams);
    const complete = st.every((s) => s.played >= 3);
    const third = st[2];
    maxByGroup[letter] = maxThirdPlacePoints(matches, teams);
    entries.push({
      team: third.team,
      group: letter,
      points: third.points,
      goalDifference: third.goalDifference,
      goalsFor: third.goalsFor,
      played: third.played,
      complete,
      letter,
    });
  }
  // 3 位同士を勝点→得失点→総得点で並べる
  entries.sort(
    (a, b) =>
      b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.group.localeCompare(b.group),
  );
  return entries.map((e, i) => {
    const inZone = i < 8;
    let status: ThirdPlaceEntry['status'] = inZone ? 'zone' : 'out';
    if (e.complete) {
      // 他グループ 3 位が最大化しても、自分以上になり得る数が 7 以下なら確定
      let canBeAtOrAbove = 0;
      for (const [letter, mx] of Object.entries(maxByGroup)) {
        if (letter === e.letter) continue;
        if (mx >= e.points) canBeAtOrAbove++;
      }
      if (canBeAtOrAbove <= 7) status = 'confirmed';
    }
    const { letter: _letter, ...rest } = e;
    void _letter;
    return { ...rest, rank: i + 1, inZone, status };
  });
}

export interface MatchClinchNote {
  matchId: string;
  /** この試合の各結果で「新たに 2 位以内が確定」するチーム名 (日本語表示はUI側) */
  homeWin: string[];
  draw: string[];
  awayWin: string[];
}

/** 1 試合の結果を仮定したときに 2 位以内が確定するチーム集合 */
function clinchedIfOutcome(
  matches: MatchResult[],
  teams: string[],
  matchId: string,
  outcome: 'HOME' | 'DRAW' | 'AWAY',
): Set<string> {
  const cloned = matches.map((m) => {
    if (m.id !== matchId) return m;
    const fullTime =
      outcome === 'HOME' ? { home: 1, away: 0 } : outcome === 'AWAY' ? { home: 0, away: 1 } : { home: 0, away: 0 };
    return {
      ...m,
      status: 'FINISHED' as const,
      score: { ...m.score, fullTime, winner: outcome === 'DRAW' ? ('DRAW' as const) : outcome },
    };
  });
  return computeClinchedTop2(cloned, teams);
}

/**
 * グループ内の未消化試合について、各結果 (ホーム勝/分/アウェイ勝) で
 * 新たに 2 位以内が確定するチームを算出 (「引分で〇〇突破」注釈用)。
 * 注: 勝利は 1-0 を仮定するため得失点差依存の確定は安全側に控えめになる。
 */
export function computeMatchClinchNotes(matches: MatchResult[], teams: string[]): MatchClinchNote[] {
  const already = computeClinchedTop2(matches, teams);
  const notes: MatchClinchNote[] = [];
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE' || isFinished(m)) continue;
    if (!teams.includes(m.homeTeam.name) || !teams.includes(m.awayTeam.name)) {
      // normalize 経由で所属確認
      const inGroup = (n: string) => teams.some((t) => normalize(t) === normalize(n));
      if (!inGroup(m.homeTeam.name) || !inGroup(m.awayTeam.name)) continue;
    }
    const diff = (oc: 'HOME' | 'DRAW' | 'AWAY') =>
      [...clinchedIfOutcome(matches, teams, m.id, oc)].filter((t) => !already.has(t));
    const homeWin = diff('HOME');
    const draw = diff('DRAW');
    const awayWin = diff('AWAY');
    if (homeWin.length || draw.length || awayWin.length) {
      notes.push({ matchId: m.id, homeWin, draw, awayWin });
    }
  }
  return notes;
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
