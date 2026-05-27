import { useGame } from '../../context/GameContext';
import { GROUPS, getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { calculateGroupStandings } from '../../utils/scoreCalculator';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { useMemo } from 'react';

interface Props {
  letter: string;
}

function rowBg(rank: number): string {
  if (rank <= 2) return 'bg-green-500/10';
  if (rank === 3) return 'bg-amber-500/10';
  return 'bg-slate-500/5';
}

export function GroupTable({ letter }: Props) {
  const { matches } = useGame();
  const teams = GROUPS[letter];
  const standings = useMemo(() => calculateGroupStandings(matches, teams), [matches, teams]);

  return (
    <div className="card">
      <header className="card-header">
        <h3 className="font-heading text-base">
          Group {letter}
        </h3>
        <span className="text-[10px] text-slate-400">
          上位2位 自動突破 · 3位はワイルドカード
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="text-[10px] text-slate-500 bg-navy-900/40">
            <tr>
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-1 py-1.5 text-left">チーム</th>
              <th className="px-1 py-1.5 text-right">試</th>
              <th className="px-1 py-1.5 text-right">勝</th>
              <th className="px-1 py-1.5 text-right">分</th>
              <th className="px-1 py-1.5 text-right">負</th>
              <th className="px-1 py-1.5 text-right hidden sm:table-cell">得</th>
              <th className="px-1 py-1.5 text-right hidden sm:table-cell">失</th>
              <th className="px-1 py-1.5 text-right">差</th>
              <th className="px-2 py-1.5 text-right">勝点</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const rank = i + 1;
              const pid = getPlayerOfTeam(s.team);
              const color = pid ? PLAYERS[pid].color : '#666';
              return (
                <tr key={s.team} className={`border-t border-white/5 ${rowBg(rank)}`}>
                  <td className="px-2 py-1.5 font-mono text-slate-400">{rank}</td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        title={pid ? PLAYERS[pid].name : ''}
                      />
                      <span className="truncate">
                        {getFlag(s.team)} {getTeamNameJa(s.team)}
                      </span>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{s.played}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{s.won}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{s.drawn}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{s.lost}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums hidden sm:table-cell">{s.goalsFor}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums hidden sm:table-cell">{s.goalsAgainst}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                  <td className="px-2 py-1.5 text-right font-heading tabular-nums">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
