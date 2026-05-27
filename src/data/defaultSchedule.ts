import { GROUPS } from '../config/teams';
import type { MatchResult } from '../types';

/**
 * 静的なフォールバック試合スケジュール。
 * 実日程と完全一致はしないが、UIプレビュー用にすべてのグループ試合を生成する。
 * 実際の試合データは Football-Data.org からの取得を推奨。
 */
export function generateDefaultSchedule(): MatchResult[] {
  const matches: MatchResult[] = [];
  const startDate = new Date('2026-06-11T16:00:00Z'); // JST 6/12 01:00 開幕
  let counter = 0;

  // 各グループ 6 試合: round-robin
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ];

  const groupLetters = Object.keys(GROUPS);

  // 各「matchday round」で、各グループから1試合ずつ。3 ラウンド * 2 試合 = 6 試合
  // ここでは順序ベースに 4 試合/日程度のリズムで割り振る
  const matchesPerDay = 6;
  for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
    const [hi, ai] = pairs[pairIdx];
    for (let gi = 0; gi < groupLetters.length; gi++) {
      const g = groupLetters[gi];
      const teams = GROUPS[g];
      const home = teams[hi];
      const away = teams[ai];
      const minutesFromStart = counter * Math.floor((60 * 24) / matchesPerDay) * 60 * 1000;
      const utc = new Date(startDate.getTime() + minutesFromStart).toISOString();
      matches.push({
        id: `gs-${g}-${pairIdx}`,
        utcDate: utc,
        status: 'SCHEDULED',
        stage: 'GROUP_STAGE',
        group: `Group ${g}`,
        matchday: pairIdx < 2 ? 1 : pairIdx < 4 ? 2 : 3,
        minute: null,
        homeTeam: { name: home },
        awayTeam: { name: away },
        score: { fullTime: { home: null, away: null } },
      });
      counter++;
    }
  }
  return matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}
