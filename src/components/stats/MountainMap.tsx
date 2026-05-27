import { useGame } from '../../context/GameContext';
import { GROUPS, GROUP_LETTERS, getPlayerOfTeam, PLAYERS, PLAYER_IDS } from '../../config/teams';

/**
 * 各プレイヤーが各グループに何チーム持っているかを格子で可視化。
 */
export function MountainMap() {
  const { settings } = useGame();

  // playerId × groupLetter -> count
  const counts: Record<string, Record<string, number>> = {};
  for (const id of PLAYER_IDS) {
    counts[id] = {};
    for (const g of GROUP_LETTERS) counts[id][g] = 0;
  }
  for (const g of GROUP_LETTERS) {
    for (const team of GROUPS[g]) {
      const pid = getPlayerOfTeam(team);
      if (pid) counts[pid][g]++;
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base flex items-center gap-2">⛰️ グループ分布</h3>
        <span className="text-[10px] text-slate-400">各プレイヤーが各グループに何チーム持っているか</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left px-3 py-2">プレイヤー</th>
              {GROUP_LETTERS.map((g) => (
                <th key={g} className="px-1.5 py-2 text-center font-mono">{g}</th>
              ))}
              <th className="px-2 py-2 text-center">計</th>
            </tr>
          </thead>
          <tbody>
            {PLAYER_IDS.map((id) => {
              const p = PLAYERS[id];
              const total = GROUP_LETTERS.reduce((sum, g) => sum + counts[id][g], 0);
              return (
                <tr key={id} className="border-t border-white/5">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="badge-dot" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold">{settings.playerNames[id]}</span>
                    </div>
                  </td>
                  {GROUP_LETTERS.map((g) => {
                    const c = counts[id][g];
                    return (
                      <td key={g} className="px-1.5 py-2 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded font-bold"
                          style={{
                            background: c > 0 ? `${p.color}25` : 'transparent',
                            color: c > 0 ? p.color : '#475569',
                          }}
                        >
                          {c || '·'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-heading">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
