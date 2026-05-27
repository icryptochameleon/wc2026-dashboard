import { useGame } from '../../context/GameContext';

const NUMBER_FORMAT = new Intl.NumberFormat('ja-JP');

function rankIcon(rank: number, prevRank?: number): string {
  if (prevRank == null || prevRank === rank) return '→';
  if (prevRank > rank) return '▲';
  return '▼';
}

function rankColor(rank: number): string {
  switch (rank) {
    case 1:
      return 'text-gold-500';
    case 2:
      return 'text-slate-300';
    case 3:
      return 'text-amber-600';
    default:
      return 'text-slate-500';
  }
}

export function Scoreboard() {
  const { playerScores, settings } = useGame();

  return (
    <section className="card">
      <header className="card-header">
        <h2 className="font-heading text-base tracking-wide flex items-center gap-2">
          🏆 <span>スコアボード</span>
        </h2>
        <span className="text-[10px] text-slate-400">
          最終更新 {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400">
            <tr className="border-b border-white/5">
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left py-2">プレイヤー</th>
              <th className="text-right py-2">合計</th>
              <th className="text-right py-2 hidden sm:table-cell">予選</th>
              <th className="text-right py-2 hidden sm:table-cell">T</th>
              <th className="text-center py-2 pr-3">前回</th>
            </tr>
          </thead>
          <tbody>
            {playerScores.map((p) => {
              const customName = settings.playerNames[p.id];
              const moved =
                p.prevRank != null && p.prevRank !== p.rank
                  ? 'animate-highlight'
                  : '';
              return (
                <tr
                  key={p.id}
                  className={`border-b border-white/5 last:border-b-0 ${moved}`}
                >
                  <td className={`px-3 py-3 font-heading text-lg ${rankColor(p.rank)}`}>
                    {p.rank}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="badge-dot"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-semibold">{customName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right font-heading text-base sm:text-lg">
                    {NUMBER_FORMAT.format(p.totalPoints)}
                  </td>
                  <td className="py-3 text-right text-slate-400 hidden sm:table-cell">
                    {NUMBER_FORMAT.format(p.groupPoints)}
                  </td>
                  <td className="py-3 text-right text-slate-400 hidden sm:table-cell">
                    {NUMBER_FORMAT.format(p.knockoutPoints)}
                  </td>
                  <td className="py-3 pr-3 text-center text-xs">
                    <span className={rankIcon(p.rank, p.prevRank) === '▲' ? 'text-green-400' : rankIcon(p.rank, p.prevRank) === '▼' ? 'text-red-400' : 'text-slate-500'}>
                      {rankIcon(p.rank, p.prevRank)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-white/5 hidden sm:block">
        予選 = グループステージで獲得したポイント · T = トーナメント進出ボーナス + 最終順位
      </div>
    </section>
  );
}
