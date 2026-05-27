import type { MatchResult } from '../../types';
import { getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { formatJSTDateLabel, formatJSTTime } from '../../utils/dateUtils';

interface Props {
  match?: MatchResult;
  placeholder?: { home: string; away: string };
}

function teamRow(name: string | undefined, isWinner: boolean, isLoser: boolean) {
  if (!name) {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 text-slate-500 text-xs italic">
        — TBD —
      </div>
    );
  }
  const pid = getPlayerOfTeam(name);
  const color = pid ? PLAYERS[pid].color : '#666';
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 text-xs sm:text-sm ${
        isWinner ? 'font-bold text-slate-50' : isLoser ? 'text-slate-500 line-through' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {pid && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
        <span className="truncate">
          {getFlag(name)} {getTeamNameJa(name)}
        </span>
      </div>
    </div>
  );
}

export function BracketMatch({ match, placeholder }: Props) {
  const homeName = match?.homeTeam.name ?? placeholder?.home;
  const awayName = match?.awayTeam.name ?? placeholder?.away;
  const hg = match?.score.fullTime.home ?? null;
  const ag = match?.score.fullTime.away ?? null;
  const finished = match?.status === 'FINISHED';
  const live = match && ['LIVE', 'IN_PLAY', 'PAUSED'].includes(match.status);
  const homeWin = finished && hg !== null && ag !== null && hg > ag;
  const awayWin = finished && hg !== null && ag !== null && ag > hg;

  return (
    <div className="bg-navy-800/80 border border-white/10 rounded-lg w-44 sm:w-52 shadow text-xs">
      <div className="grid grid-cols-[1fr_auto]">
        <div className="border-r border-white/5">
          {teamRow(homeName, homeWin, awayWin)}
          <div className="border-t border-white/5">
            {teamRow(awayName, awayWin, homeWin)}
          </div>
        </div>
        <div className="grid grid-rows-2 text-center font-heading tabular-nums w-9">
          <div className={`flex items-center justify-center ${homeWin ? 'text-gold-500' : 'text-slate-300'}`}>
            {hg ?? '-'}
          </div>
          <div className={`flex items-center justify-center border-t border-white/5 ${awayWin ? 'text-gold-500' : 'text-slate-300'}`}>
            {ag ?? '-'}
          </div>
        </div>
      </div>
      {match && (
        <div className="px-2 py-1 text-[10px] text-slate-500 border-t border-white/5 flex items-center justify-between">
          <span>
            {formatJSTDateLabel(match.utcDate)} {formatJSTTime(match.utcDate)}
          </span>
          {live && <span className="text-red-400 font-bold">LIVE</span>}
        </div>
      )}
    </div>
  );
}
