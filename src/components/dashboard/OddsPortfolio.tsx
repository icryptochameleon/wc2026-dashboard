import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { PLAYER_IDS, PLAYERS } from '../../config/teams';
import { getFlag } from '../../utils/teamUtils';

/**
 * 4 選手の「優勝確率ポートフォリオ」。
 * 持ち 12 チームの Polymarket 優勝確率の合計で、編成の強さを比べる。
 */
export function OddsPortfolio() {
  const { championOdds, oddsUpdatedAt, settings } = useGame();

  const rows = useMemo(() => {
    const list = PLAYER_IDS.map((id) => {
      const p = PLAYERS[id];
      const teams = p.teams
        .map((t) => ({ team: t, prob: championOdds[t] ?? 0 }))
        .sort((a, b) => b.prob - a.prob);
      const sum = teams.reduce((acc, t) => acc + t.prob, 0);
      return { id, color: p.color, name: settings.playerNames[id], sum, top: teams.slice(0, 3) };
    });
    return list.sort((a, b) => b.sum - a.sum);
  }, [championOdds, settings.playerNames]);

  const hasData = rows.some((r) => r.sum > 0);
  if (!hasData) return null; // オッズ未取得時は何も出さない (飾り機能)

  const maxSum = Math.max(...rows.map((r) => r.sum), 0.0001);

  return (
    <section className="card">
      <header className="card-header">
        <h2 className="font-heading text-base flex items-center gap-2">
          👑 <span>優勝確率ポートフォリオ</span>
        </h2>
        <span className="text-[10px] text-slate-500">
          Polymarket 実勢
          {oddsUpdatedAt &&
            ` · ${new Date(oddsUpdatedAt).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Tokyo',
            })} 更新`}
        </span>
      </header>
      <div className="card-body space-y-3">
        {rows.map((r, i) => (
          <div key={r.id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-heading text-gold-500 w-4">{i + 1}</span>
                <span className="badge-dot shrink-0" style={{ backgroundColor: r.color }} />
                <span className="font-semibold truncate">{r.name}</span>
              </div>
              <span className="font-heading text-lg tabular-nums" style={{ color: r.color }}>
                {(r.sum * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-navy-900/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(r.sum / maxSum) * 100}%`, backgroundColor: r.color }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400 truncate">
              {r.top
                .filter((t) => t.prob > 0)
                .map((t) => `${getFlag(t.team)} ${(t.prob * 100).toFixed(1)}%`)
                .join(' · ')}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-slate-600">
          各チームの優勝マーケット価格の合計。市場スプレッドの分、4人の合計は 100% を僅かに超えます。
        </p>
      </div>
    </section>
  );
}
