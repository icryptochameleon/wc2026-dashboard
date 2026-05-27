import { useGame } from '../../context/GameContext';
import { getLiveMatches } from '../../utils/scoreCalculator';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { SCORING } from '../../config/scoring';

const NF = new Intl.NumberFormat('ja-JP');

export function BattleNow() {
  const { matches, settings } = useGame();
  const live = getLiveMatches(matches);
  if (live.length === 0) return null;

  return (
    <section className="card border-red-500/40 ring-1 ring-red-500/30">
      <header className="card-header">
        <h2 className="font-heading text-base tracking-wide flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-red-400">BATTLE NOW</span>
        </h2>
        <span className="text-xs text-slate-400">{live.length}試合進行中</span>
      </header>
      <div className="divide-y divide-white/5">
        {live.map((m) => {
          const homePlayer = getPlayerOfTeam(m.homeTeam.name);
          const awayPlayer = getPlayerOfTeam(m.awayTeam.name);
          const homeName = homePlayer ? settings.playerNames[homePlayer] : null;
          const awayName = awayPlayer ? settings.playerNames[awayPlayer] : null;
          const homeColor = homePlayer ? PLAYERS[homePlayer].color : '#888';
          const awayColor = awayPlayer ? PLAYERS[awayPlayer].color : '#888';
          return (
            <div key={m.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="text-red-400 font-bold">
                  LIVE {m.minute ? `${m.minute}'` : ''}
                </span>
                <span>{m.group ?? m.stage.replace(/_/g, ' ')}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {homePlayer && (
                      <span className="badge-dot" style={{ backgroundColor: homeColor }} />
                    )}
                    <span className="text-base sm:text-lg font-semibold">
                      {getFlag(m.homeTeam.name)} {getTeamNameJa(m.homeTeam.name)}
                    </span>
                  </div>
                  {homeName && (
                    <div className="text-xs mt-0.5" style={{ color: homeColor }}>
                      {homeName}
                    </div>
                  )}
                </div>
                <div className="text-center px-3">
                  <div className="font-heading text-3xl tabular-nums">
                    {m.score.fullTime.home ?? 0}
                    <span className="text-slate-500 mx-1">-</span>
                    {m.score.fullTime.away ?? 0}
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-semibold">
                      {getFlag(m.awayTeam.name)} {getTeamNameJa(m.awayTeam.name)}
                    </span>
                    {awayPlayer && (
                      <span className="badge-dot" style={{ backgroundColor: awayColor }} />
                    )}
                  </div>
                  {awayName && (
                    <div className="text-xs mt-0.5" style={{ color: awayColor }}>
                      {awayName}
                    </div>
                  )}
                </div>
              </div>
              {(homePlayer || awayPlayer) && (
                <div className="text-xs space-y-1 bg-navy-900/40 rounded-lg p-2">
                  {homePlayer && (
                    <div className="flex items-center gap-2">
                      🎯 <span style={{ color: homeColor }}>{homeName}</span>
                      <span className="text-slate-400">
                        {getTeamNameJa(m.homeTeam.name)} 勝利で +{NF.format(SCORING.GROUP_WIN)}pt
                      </span>
                    </div>
                  )}
                  {awayPlayer && (
                    <div className="flex items-center gap-2">
                      🎯 <span style={{ color: awayColor }}>{awayName}</span>
                      <span className="text-slate-400">
                        {getTeamNameJa(m.awayTeam.name)} 勝利で +{NF.format(SCORING.GROUP_WIN)}pt
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
