import { useGame } from '../../context/GameContext';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { getPlayerOfTeam, PLAYERS } from '../../config/teams';
import { STAGE_LABEL_JA } from '../../config/scoring';

const NF = new Intl.NumberFormat('ja-JP');

export function TopContributors() {
  const { playerScores, settings } = useGame();

  const allTeams = playerScores
    .flatMap((p) =>
      Object.values(p.teamScores).map((t) => ({ ...t, playerId: p.id, color: p.color })),
    )
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  if (allTeams.every((t) => t.points === 0)) {
    return (
      <section className="card">
        <header className="card-header">
          <h3 className="font-heading text-base">⭐ 最も貢献したチーム TOP5</h3>
        </header>
        <div className="card-body text-sm text-slate-400">
          試合結果がまだありません。
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base">⭐ 最も貢献したチーム TOP5</h3>
      </header>
      <ol className="divide-y divide-white/5">
        {allTeams.map((t, i) => {
          const pid = getPlayerOfTeam(t.team);
          const owner = pid ? settings.playerNames[pid] : '';
          return (
            <li key={t.team} className="flex items-center gap-3 px-4 py-2.5">
              <span className="font-heading text-lg w-6 text-center text-gold-500">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {getFlag(t.team)} {getTeamNameJa(t.team)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {STAGE_LABEL_JA[t.currentStage]} ·{' '}
                  <span style={{ color: t.color }}>{owner}</span>
                </div>
              </div>
              <div className="font-heading text-base tabular-nums" style={{ color: t.color }}>
                {NF.format(t.points)}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PlayerStageSummary() {
  const { playerScores } = useGame();
  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base">📈 ステージ別 進出チーム数</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left px-3 py-2">プレイヤー</th>
              <th className="px-2 py-2 text-center">🟢 進行中</th>
              <th className="px-2 py-2 text-center">❌ 敗退</th>
              <th className="px-2 py-2 text-center">🏆 ベスト8+</th>
            </tr>
          </thead>
          <tbody>
            {playerScores.map((p) => {
              const teams = Object.values(p.teamScores);
              const alive = teams.filter((t) => !t.eliminated).length;
              const out = teams.filter((t) => t.eliminated).length;
              const elite = teams.filter(
                (t) =>
                  ['QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].includes(t.currentStage),
              ).length;
              return (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="badge-dot" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-heading text-green-400">{alive}</td>
                  <td className="px-2 py-2 text-center font-heading text-red-400">{out}</td>
                  <td className="px-2 py-2 text-center font-heading" style={{ color: p.color }}>{elite}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
