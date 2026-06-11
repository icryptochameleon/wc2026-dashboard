import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';

/** フィード鮮度: 12分以内=緑 / 30分以内=黄 / それ以上=赤 / 未接続=灰 */
function freshness(generatedAt: string | null, feedState: string): {
  color: string;
  label: string;
} {
  if (!generatedAt || feedState === 'synthetic') {
    return { color: '#64748b', label: 'オフライン' };
  }
  const ageMin = (Date.now() - Date.parse(generatedAt)) / 60000;
  const time = new Date(generatedAt).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
  if (ageMin < 12) return { color: '#22c55e', label: time };
  if (ageMin < 30) return { color: '#eab308', label: time };
  return { color: '#ef4444', label: `${time} (停滞中?)` };
}

export function Header() {
  const { generatedAt, feedState, loading, refresh } = useGame();
  const [, forceTick] = useState(0);

  // バッジの経過時間表示を1分毎に再評価
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const f = freshness(generatedAt, feedState);

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
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 btn-ghost px-2 py-1"
          title="結果フィードの最終更新 (タップで再取得)"
        >
          <span
            className={`w-2 h-2 rounded-full ${loading ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: f.color }}
          />
          <span className="tabular-nums">{loading ? '更新中…' : f.label}</span>
        </button>
      </div>
    </header>
  );
}
