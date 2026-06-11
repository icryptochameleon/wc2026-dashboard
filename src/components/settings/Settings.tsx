import { useGame } from '../../context/GameContext';
import { PLAYER_IDS, PLAYERS } from '../../config/teams';
import type { PlayerId } from '../../types';
import { DataSourceStatus } from './DataSourceStatus';
import { ManualInput } from './ManualInput';

export function Settings() {
  const { settings, setSettings, clearAllOverrides, refresh } = useGame();

  const resetLocalData = () => {
    if (
      confirm(
        'この端末の手動上書きとキャッシュをすべて消去し、最新の結果フィードを取り直しますか?\n(全員共有のデータには影響しません)',
      )
    ) {
      clearAllOverrides();
      try {
        localStorage.removeItem('wc2026_matches_v2');
        localStorage.removeItem('wc2026_odds_cache');
      } catch {
        /* ignore */
      }
      refresh();
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <header className="card-header">
          <h3 className="font-heading text-base flex items-center gap-2">👥 プレイヤー名</h3>
        </header>
        <div className="card-body grid sm:grid-cols-2 gap-3">
          {PLAYER_IDS.map((id) => {
            const p = PLAYERS[id];
            return (
              <label key={id} className="block">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <span className="badge-dot" style={{ backgroundColor: p.color }} />
                  Player {id} (default: {p.name})
                </div>
                <input
                  className="input"
                  value={settings.playerNames[id]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      playerNames: { ...settings.playerNames, [id as PlayerId]: e.target.value },
                    })
                  }
                />
              </label>
            );
          })}
        </div>
      </section>

      <DataSourceStatus />

      <ManualInput />

      <section className="card">
        <header className="card-header">
          <h3 className="font-heading text-base flex items-center gap-2">⚙️ その他</h3>
        </header>
        <div className="card-body space-y-3">
          <button onClick={resetLocalData} className="btn-ghost text-sm">
            🔄 この端末のデータをリセット
          </button>
          <p className="text-[10px] text-slate-500">
            タイムゾーン: Asia/Tokyo (JST) で固定。テーマ: ダークモード。
          </p>
        </div>
      </section>
    </div>
  );
}
