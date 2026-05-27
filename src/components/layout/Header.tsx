import { useGame } from '../../context/GameContext';
import { formatRelativeJa } from '../../utils/dateUtils';

export function Header() {
  const { lastFetch, loading, refresh, settings } = useGame();

  return (
    <header className="sticky top-0 z-30 bg-navy-900/95 backdrop-blur border-b border-white/5 safe-top">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <div>
            <h1 className="font-heading text-lg sm:text-xl text-gold-500 leading-tight">
              WC2026 DRAFT
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 leading-tight">
              4人ドラフト・ライブダッシュボード
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {lastFetch && (
            <span className="hidden sm:inline">
              更新: {formatRelativeJa(lastFetch)}
            </span>
          )}
          {settings.apiKey && (
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="btn-ghost text-xs px-2 py-1"
              title="再取得"
            >
              {loading ? '⟳' : '⟳ 更新'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
