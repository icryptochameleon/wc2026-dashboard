import { useGame } from '../../context/GameContext';
import { GROUPS, getPlayerOfTeam, PLAYERS } from '../../config/teams';
import {
  calculateGroupStandings,
  computeClinchedTop2,
  computeMatchClinchNotes,
  computeThirdPlaceRace,
  getGroupMatches,
} from '../../utils/scoreCalculator';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { formatJSTDateLabel, formatJSTTime } from '../../utils/dateUtils';
import { useMemo, useState } from 'react';

interface Props {
  letter: string;
}

function rowBg(rank: number, advanced: boolean): string {
  if (advanced) return 'bg-green-500/25';
  if (rank <= 2) return 'bg-green-500/10';
  if (rank === 3) return 'bg-amber-500/10';
  return 'bg-slate-500/5';
}

export function GroupTable({ letter }: Props) {
  const { matches } = useGame();
  const teams = GROUPS[letter];
  const [open, setOpen] = useState(false);

  const standings = useMemo(() => calculateGroupStandings(matches, teams), [matches, teams]);
  const clinched = useMemo(() => computeClinchedTop2(matches, teams), [matches, teams]);
  // 3位ワイルドカードで突破確定したチーム (全グループ横断)
  const wildcardConfirmed = useMemo(() => {
    const s = new Set<string>();
    for (const e of computeThirdPlaceRace(matches, GROUPS)) {
      if (e.status === 'confirmed') s.add(e.team);
    }
    return s;
  }, [matches]);
  const groupMatches = useMemo(() => getGroupMatches(matches, teams), [matches, teams]);
  const clinchNotes = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeMatchClinchNotes>[number]>();
    for (const n of computeMatchClinchNotes(matches, teams)) map.set(n.matchId, n);
    return map;
  }, [matches, teams]);
  const playedCount = groupMatches.filter((m) => m.status === 'FINISHED').length;

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="card-header w-full text-left hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <h3 className="font-heading text-base flex items-center gap-1.5">
          <span className={`text-slate-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Group {letter}
        </h3>
        <span className="text-[10px] text-slate-400">
          {open ? '閉じる' : `試合結果 (${playedCount}/${groupMatches.length})`}
        </span>
      </button>
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
              const isClinched = clinched.has(s.team);
              const isWcConfirmed = !isClinched && wildcardConfirmed.has(s.team);
              const advanced = isClinched || isWcConfirmed;
              return (
                <tr key={s.team} className={`border-t border-white/5 ${rowBg(rank, advanced)}`}>
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
                      {isClinched && (
                        <span
                          className="shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-green-500/30 text-green-300 border border-green-400/40 font-bold"
                          title="2位以内が数学的に確定 (Best32 自動突破)"
                        >
                          突破
                        </span>
                      )}
                      {isWcConfirmed && (
                        <span
                          className="shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-green-500/30 text-green-300 border border-green-400/40 font-bold"
                          title="3位ワイルドカードで Best32 突破が確定"
                        >
                          WC突破
                        </span>
                      )}
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

      {open && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {groupMatches.map((m) => {
            const done = m.status === 'FINISHED';
            const live = ['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status);
            const hg = m.score.fullTime.home;
            const ag = m.score.fullTime.away;
            const homeWin = done && hg != null && ag != null && hg > ag;
            const awayWin = done && hg != null && ag != null && ag > hg;
            const note = !done ? clinchNotes.get(m.id) : undefined;
            const ja = (names: string[]) =>
              names.map((n) => `${getFlag(n)}${getTeamNameJa(n)}`).join('・');
            return (
              <div key={m.id} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>
                    {formatJSTDateLabel(m.utcDate)} {formatJSTTime(m.utcDate)}
                  </span>
                  {live && <span className="text-red-400 font-bold">🔴 LIVE</span>}
                  {!done && !live && <span className="text-slate-500">予定</span>}
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className={`text-right truncate ${homeWin ? 'font-bold text-white' : 'text-slate-300'}`}>
                    {getFlag(m.homeTeam.name)} {getTeamNameJa(m.homeTeam.name)}
                  </span>
                  <span className="font-heading tabular-nums px-1.5">
                    {done || live ? `${hg ?? 0} - ${ag ?? 0}` : 'vs'}
                  </span>
                  <span className={`text-left truncate ${awayWin ? 'font-bold text-white' : 'text-slate-300'}`}>
                    {getTeamNameJa(m.awayTeam.name)} {getFlag(m.awayTeam.name)}
                  </span>
                </div>
                {note && (note.homeWin.length > 0 || note.draw.length > 0 || note.awayWin.length > 0) && (
                  <div className="mt-1.5 space-y-0.5 text-[10px] bg-navy-900/40 rounded px-2 py-1">
                    {note.homeWin.length > 0 && (
                      <div>
                        <span className="text-slate-400">{getTeamNameJa(m.homeTeam.name)}勝利 →</span>{' '}
                        <span className="text-green-300">{ja(note.homeWin)} 突破</span>
                      </div>
                    )}
                    {note.draw.length > 0 && (
                      <div>
                        <span className="text-slate-400">引分 →</span>{' '}
                        <span className="text-green-300">{ja(note.draw)} 突破</span>
                      </div>
                    )}
                    {note.awayWin.length > 0 && (
                      <div>
                        <span className="text-slate-400">{getTeamNameJa(m.awayTeam.name)}勝利 →</span>{' '}
                        <span className="text-green-300">{ja(note.awayWin)} 突破</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
