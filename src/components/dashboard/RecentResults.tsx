import { useGame } from '../../context/GameContext';
import { getRecentResults } from '../../utils/scoreCalculator';
import { getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { formatJSTDateLabel, formatJSTTime } from '../../utils/dateUtils';
import { SCORING } from '../../config/scoring';

const NF = new Intl.NumberFormat('ja-JP');

export function RecentResults() {
  const { matches, settings } = useGame();
  const recent = getRecentResults(matches, 8);

  if (recent.length === 0) {
    return (
      <section className="card">
        <header className="card-header">
          <h2 className="font-heading text-base flex items-center gap-2">
            📜 <span>最新結果</span>
          </h2>
        </header>
        <div className="card-body text-sm text-slate-400">
          まだ結果がありません。試合が終わると順次表示されます。
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2 className="font-heading text-base flex items-center gap-2">
          📜 <span>最新結果</span>
        </h2>
      </header>
      <ul className="divide-y divide-white/5">
        {recent.map((m) => {
          const hp = getPlayerOfTeam(m.homeTeam.name);
          const ap = getPlayerOfTeam(m.awayTeam.name);
          const hg = m.score.fullTime.home ?? 0;
          const ag = m.score.fullTime.away ?? 0;
          const winnerSide = hg > ag ? 'home' : hg < ag ? 'away' : 'draw';
          const winnerPlayer = winnerSide === 'home' ? hp : winnerSide === 'away' ? ap : null;
          const ptsAwarded = winnerSide === 'draw'
            ? 0
            : m.stage === 'GROUP_STAGE'
              ? SCORING.GROUP_WIN
              : 0; // ノックアウトの進出ボーナスは別途
          return (
            <li key={m.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>
                  {formatJSTDateLabel(m.utcDate)} {formatJSTTime(m.utcDate)}
                </span>
                <span>{m.group ?? m.stage.replace(/_/g, ' ')}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-right flex items-center justify-end gap-1.5">
                  {hp && (
                    <span
                      className="badge-dot"
                      style={{ backgroundColor: PLAYERS[hp].color }}
                    />
                  )}
                  <span className={winnerSide === 'home' ? 'font-bold' : 'text-slate-400'}>
                    {getFlag(m.homeTeam.name)} {getTeamNameJa(m.homeTeam.name)}
                  </span>
                </div>
                <div className="font-heading text-lg tabular-nums px-2">
                  {hg}<span className="text-slate-500 mx-0.5">-</span>{ag}
                </div>
                <div className="text-left flex items-center gap-1.5">
                  <span className={winnerSide === 'away' ? 'font-bold' : 'text-slate-400'}>
                    {getFlag(m.awayTeam.name)} {getTeamNameJa(m.awayTeam.name)}
                  </span>
                  {ap && (
                    <span
                      className="badge-dot"
                      style={{ backgroundColor: PLAYERS[ap].color }}
                    />
                  )}
                </div>
              </div>
              {winnerPlayer && ptsAwarded > 0 && (
                <div className="mt-1 text-[10px] text-right">
                  <span style={{ color: PLAYERS[winnerPlayer].color }}>
                    {settings.playerNames[winnerPlayer]}
                  </span>
                  <span className="text-slate-400"> +{NF.format(ptsAwarded)}pt</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
