import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getUpcomingMatches } from '../../utils/scoreCalculator';
import { getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { countdownTo, formatJSTDateLabel, formatJSTTime } from '../../utils/dateUtils';

const DEFAULT_LIMIT = 5;

export function NextBattle() {
  const { matches, settings } = useGame();
  const [expanded, setExpanded] = useState(false);
  const upcoming = useMemo(() => {
    const all = getUpcomingMatches(matches, 200);
    return expanded ? all : all.slice(0, DEFAULT_LIMIT);
  }, [matches, expanded]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const m of upcoming) {
      const key = formatJSTDateLabel(m.utcDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <section className="card">
        <header className="card-header">
          <h2 className="font-heading text-base flex items-center gap-2">
            ⏭️ <span>次の試合</span>
          </h2>
        </header>
        <div className="card-body text-sm text-slate-400">
          直近の予定試合はありません。
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2 className="font-heading text-base flex items-center gap-2">
          ⏭️ <span>次の試合 (JST)</span>
        </h2>
        <span className="text-xs text-slate-400">{upcoming.length} 件</span>
      </header>
      <div className="card-body space-y-4">
        {grouped.map(([dateLabel, group]) => (
          <div key={dateLabel}>
            <div className="text-xs font-bold text-gold-500 mb-2">
              📅 {dateLabel}
            </div>
            <div className="space-y-2">
              {group.map((m) => {
                const homeP = getPlayerOfTeam(m.homeTeam.name);
                const awayP = getPlayerOfTeam(m.awayTeam.name);
                const sameOwner = homeP && awayP && homeP === awayP;
                const homeColor = homeP ? PLAYERS[homeP].color : '#666';
                const awayColor = awayP ? PLAYERS[awayP].color : '#666';
                const homeName = homeP ? settings.playerNames[homeP] : '—';
                const awayName = awayP ? settings.playerNames[awayP] : '—';
                const cd = countdownTo(m.utcDate);
                return (
                  <div
                    key={m.id}
                    className="bg-navy-900/40 rounded-xl p-3 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <span className="font-mono text-gold-500">
                        🕐 {formatJSTTime(m.utcDate)}
                      </span>
                      <span className="text-slate-400">
                        {m.group ?? m.stage.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {homeP && (
                          <span
                            className="badge-dot shrink-0"
                            style={{ backgroundColor: homeColor }}
                          />
                        )}
                        <span className="text-sm sm:text-base font-semibold truncate">
                          {getFlag(m.homeTeam.name)} {getTeamNameJa(m.homeTeam.name)}
                        </span>
                      </div>
                      <span className="text-slate-500 px-2">vs</span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="text-sm sm:text-base font-semibold truncate text-right">
                          {getFlag(m.awayTeam.name)} {getTeamNameJa(m.awayTeam.name)}
                        </span>
                        {awayP && (
                          <span
                            className="badge-dot shrink-0"
                            style={{ backgroundColor: awayColor }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        🎯
                        <span style={{ color: homeColor }}>{homeName}</span>
                        <span className="text-slate-500">vs</span>
                        <span style={{ color: awayColor }}>{awayName}</span>
                      </div>
                      {cd && (
                        <span className="text-slate-400 text-[10px]">
                          {cd}
                        </span>
                      )}
                    </div>
                    {sameOwner && (
                      <div className="mt-2 text-xs bg-amber-500/15 text-amber-300 rounded px-2 py-1">
                        ⚠️ 同オーナー対決 — どちらが勝っても所属チームの一方が脱落
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-ghost w-full text-xs"
        >
          {expanded ? '折りたたむ ↑' : 'もっと見る →'}
        </button>
      </div>
    </section>
  );
}
