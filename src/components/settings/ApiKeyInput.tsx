import { useGame } from '../../context/GameContext';

export function ApiKeyInput() {
  const { settings, setSettings, refresh, loading, error } = useGame();

  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base flex items-center gap-2">🔑 API 設定</h3>
      </header>
      <div className="card-body space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1" htmlFor="football-key">
            Football-Data.org API キー
          </label>
          <input
            id="football-key"
            type="password"
            placeholder="X-Auth-Token"
            className="input font-mono"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            無料アカウントで月150リクエストまで利用可能。
            <a
              href="https://www.football-data.org/client/register"
              target="_blank"
              rel="noreferrer"
              className="underline ml-1"
            >
              取得方法
            </a>
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1" htmlFor="odds-key">
            The Odds API キー (任意)
          </label>
          <input
            id="odds-key"
            type="password"
            placeholder="未設定でOK"
            className="input font-mono"
            value={settings.oddsApiKey}
            onChange={(e) => setSettings({ ...settings, oddsApiKey: e.target.value })}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            無料枠 月500リクエスト。
            <a href="https://the-odds-api.com/" target="_blank" rel="noreferrer" className="underline ml-1">
              the-odds-api.com
            </a>
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.autoRefresh}
            onChange={(e) => setSettings({ ...settings, autoRefresh: e.target.checked })}
          />
          自動再取得 (5分間隔・LIVE中は1分)
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={!settings.apiKey || loading}
            className="btn-primary text-sm"
          >
            {loading ? '取得中…' : '今すぐ再取得'}
          </button>
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>
      </div>
    </section>
  );
}
