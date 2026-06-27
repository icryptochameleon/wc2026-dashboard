import { GROUPS } from '../config/teams';
import { calculateGroupStandings, computeThirdPlaceRace } from './scoreCalculator';
import type { ChampionOddsMap, MatchResult } from '../types';

/**
 * ベスト32 シミュレーションの仕組み:
 *   - 出場 32 = 各グループ上位2 (24) + 3位ワイルドカード上位8 (8)
 *   - 各チームの「強さ」= Polymarket 優勝確率 (低い無印チームは floor)
 *   - 1 試合の勝敗は強さ比 w_a/(w_a+w_b) の確率 + 乱数
 *   - 毎回ランダムに組み直して最後まで対戦 → 敗退ステージで排他 KO ポイント付与
 */

export interface SimKo {
  stage: string;
  points: number;
}

export interface SimOutcome {
  ko: Record<string, SimKo>; // team -> 到達/敗退ステージと KO ポイント
  champion: string;
  runnerUp: string;
  third: string;
  fourth: string;
}

const FLOOR = 0.0015;

export function buildR32Field(matches: MatchResult[]): string[] {
  const field: string[] = [];
  for (const teams of Object.values(GROUPS)) {
    const st = calculateGroupStandings(matches, teams);
    if (st[0]) field.push(st[0].team);
    if (st[1]) field.push(st[1].team);
  }
  const thirds = computeThirdPlaceRace(matches, GROUPS)
    .filter((e) => e.inZone)
    .slice(0, 8);
  for (const e of thirds) field.push(e.team);
  return field;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function simulateTournament(
  field: string[],
  odds: ChampionOddsMap,
  rng: () => number = Math.random,
): SimOutcome {
  const ko: Record<string, SimKo> = {};
  const w = (t: string) => Math.max(odds[t] ?? 0, FLOOR);
  /** [winner, loser] */
  const play = (a: string, b: string): [string, string] => {
    const pa = w(a) / (w(a) + w(b));
    return rng() < pa ? [a, b] : [b, a];
  };

  let survivors = shuffle(field, rng);
  // 偶数でなければ末尾を不戦勝で繰り上げ (通常 32 なので発生しない)
  const rounds = [
    { stage: 'ベスト32', points: 10000 },
    { stage: 'ベスト16', points: 20000 },
    { stage: 'ベスト8', points: 30000 },
  ];
  for (const r of rounds) {
    const next: string[] = [];
    for (let i = 0; i < survivors.length; i += 2) {
      if (i + 1 >= survivors.length) {
        next.push(survivors[i]); // bye
        continue;
      }
      const [winner, loser] = play(survivors[i], survivors[i + 1]);
      ko[loser] = { stage: r.stage, points: r.points };
      next.push(winner);
    }
    survivors = shuffle(next, rng);
  }

  // 準決勝 (4 → 2)
  const [f1, sfLoser1] = play(survivors[0], survivors[1]);
  const [f2, sfLoser2] = play(survivors[2], survivors[3]);
  // 3位決定戦
  const [third, fourth] = play(sfLoser1, sfLoser2);
  ko[third] = { stage: '3位', points: 60000 };
  ko[fourth] = { stage: '4位', points: 50000 };
  // 決勝
  const [champion, runnerUp] = play(f1, f2);
  ko[champion] = { stage: '優勝', points: 100000 };
  ko[runnerUp] = { stage: '準優勝', points: 75000 };

  return { ko, champion, runnerUp, third, fourth };
}
