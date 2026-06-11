import { useGame } from '../../context/GameContext';

const FEED_LABEL: Record<string, { icon: string; text: string }> = {
  'live-feed': { icon: '🟢', text: '自動更新中 (5分毎 / ライブ中は1分毎)' },
  cache: { icon: '🟡', text: '前回取得分を表示中 (再接続待ち)' },
  baked: { icon: '🟠', text: '同梱スナップショット表示中 (フィード未到達)' },
  synthetic: { icon: '⚪', text: '未接続 — 初期スケジュール表示中' },
};

function sourceLabel(v: string | undefined): { icon: string; text: string } {
  if (!v) return { icon: '⚪', text: '不明' };
  if (v === 'ok') return { icon: '🟢', text: '稼働中' };
  if (v === 'missing-token')
    return { icon: '🟡', text: '未設定 (ESPN 速報のみで運用中)' };
  return { icon: '🔴', text: v };
}

export function DataSourceStatus() {
  const {
    feedState,
    feedMeta,
    generatedAt,
    refresh,
    loading,
    error,
    manualOverrides,
    clearAllOverrides,
  } = useGame();

  const feed = FEED_LABEL[feedState] ?? FEED_LABEL.synthetic;
  const fd = sourceLabel(feedMeta?.sources?.footballData);
  const espn = sourceLabel(feedMeta?.sources?.espn);
  const overrideCount = Object.keys(manualOverrides).length;

  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base flex items-center gap-2">📡 データソース</h3>
        <button onClick={() => refresh()} disabled={loading} className="btn-ghost text-xs px-2 py-1">
          {loading ? '更新中…' : '⟳ 今すぐ更新'}
        </button>
      </header>
      <div className="card-body space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 text-xs">結果フィード</span>
          <span className="text-xs">
            {feed.icon} {feed.text}
          </span>
        </div>
        {generatedAt && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs">最終生成</span>
            <span className="text-xs tabular-nums">
              {new Date(generatedAt).toLocaleString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Tokyo',
              })}{' '}
              JST
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 text-xs">公式データ (football-data.org)</span>
          <span className="text-xs">
            {fd.icon} {fd.text}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 text-xs">ESPN 速報レイヤー</span>
          <span className="text-xs">
            {espn.icon} {espn.text}
          </span>
        </div>
        {error && (
          <div className="text-[10px] text-amber-400">直近の取得エラー: {error}</div>
        )}
        {feedMeta?.errors && feedMeta.errors.length > 0 && (
          <div className="text-[10px] text-slate-500">
            サーバー側メモ: {feedMeta.errors.slice(0, 3).join(' / ')}
          </div>
        )}
        <div className="border-t border-white/5 pt-2 flex items-center justify-between gap-2">
          <span className="text-slate-400 text-xs">
            この端末の手動上書き: <b>{overrideCount}</b> 件
          </span>
          {overrideCount > 0 && (
            <button
              onClick={() => {
                if (confirm(`この端末の手動上書き ${overrideCount} 件をすべて削除しますか?`)) {
                  clearAllOverrides();
                }
              }}
              className="btn-ghost text-xs px-2 py-1 text-amber-300"
            >
              全クリア
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          結果は GitHub Actions が公式 API (キーは Secret 保管) と ESPN から5分毎に取得して配信。
          オッズは Polymarket からブラウザが直接取得 (キー不要)。
        </p>
      </div>
    </section>
  );
}
