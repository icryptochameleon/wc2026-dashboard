import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { GROUPS, getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { computeThirdPlaceRace } from '../../utils/scoreCalculator';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';

function statusChip(status: 'confirmed' | 'zone' | 'out') {
  if (status === 'confirmed')
    return { label: '突破確定', cls: 'bg-green-500/30 text-green-300 border-green-400/40' };
  if (status === 'zone')
    return { label: '圏内', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  return { label: '圏外', cls: 'bg-slate-600/20 text-slate-400 border-white/10' };
}

export function WildcardRace() {
  const { matches } = useGame();
  const race = useMemo(() => computeThirdPlaceRace(matches, GROUPS), [matches]);

  // まだ 1 試合も終わっていなければ表示しない
  if (race.every((e) => e.played === 0)) return null;

  return (
    <section className="card mt-4">
      <header className="card-header">
        <h3 className="font-heading text-base flex items-center gap-2">
          🥉 <span>3位ワイルドカード当落</span>
        </h3>
        <span className="text-[10px] text-slate-400">上位8チームがベスト32進出</span>
      </header>
      <ul className="divide-y divide-white/5">
        {race.map((e, i) => {
          const pid = getPlayerOfTeam(e.team);
          const color = pid ? PLAYERS[pid].color : '#666';
          const chip = statusChip(e.status);
          const rowCls = e.inZone ? '' : 'opacity-50';
          return (
            <li key={e.team}>
              {i === 8 && (
                <div className="text-[9px] text-center text-red-400/70 py-0.5 border-y border-dashed border-red-500/20">
                  ─── ここまで突破 (8位) ───
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-2 text-sm ${rowCls}`}>
                <span className="font-mono text-xs w-5 text-center text-slate-400">{e.rank}</span>
                <span className="badge-dot shrink-0" style={{ backgroundColor: color }} />
                <span className="flex-1 min-w-0 truncate">
                  {getFlag(e.team)} {getTeamNameJa(e.team)}
                  <span className="text-[10px] text-slate-500 ml-1">G{e.group}</span>
                  {!e.complete && <span className="text-[10px] text-slate-500 ml-1">(消化中)</span>}
                </span>
                <span className="text-xs tabular-nums text-slate-300 w-12 text-right">
                  {e.points}pt
                </span>
                <span className="text-[10px] tabular-nums text-slate-500 w-8 text-right">
                  {e.goalDifference >= 0 ? `+${e.goalDifference}` : e.goalDifference}
                </span>
                <span className={`pill border text-[9px] shrink-0 ${chip.cls}`}>{chip.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="px-3 py-2 text-[10px] text-slate-500 border-t border-white/5">
        各グループ3位を勝点→得失点差→総得点で順位付け。「突破確定」= 他グループの結果に関わらず上位8が確定したチーム。(消化中) のグループは3位チーム・勝点が変わる可能性があります。
      </p>
    </section>
  );
}
