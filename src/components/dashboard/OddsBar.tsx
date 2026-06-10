import type { MatchOddsView } from '../../hooks/useOddsData';

/**
 * 勝/分/負 の三分割確率バー (Polymarket 実勢)。
 * セグメント色はホーム/アウェイのオーナーカラー。
 */
export function OddsBar({
  odds,
  homeColor,
  awayColor,
  homeLabel,
  awayLabel,
}: {
  odds: MatchOddsView;
  homeColor: string;
  awayColor: string;
  homeLabel: string;
  awayLabel: string;
}) {
  const total = odds.home + odds.draw + odds.away;
  if (total <= 0) return null;
  const hp = (odds.home / total) * 100;
  const dp = (odds.draw / total) * 100;
  const ap = (odds.away / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>
          📊 {odds.live ? (
            <span className="text-red-400 font-bold">LIVE オッズ</span>
          ) : (
            'オッズ'
          )}{' '}
          <span className="text-slate-600">(Polymarket)</span>
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-navy-900/60">
        <div style={{ width: `${hp}%`, backgroundColor: homeColor }} />
        <div style={{ width: `${dp}%` }} className="bg-slate-600/70" />
        <div style={{ width: `${ap}%`, backgroundColor: awayColor }} />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums">
        <span style={{ color: homeColor }}>
          {homeLabel} {hp.toFixed(0)}%
        </span>
        <span className="text-slate-500">分 {dp.toFixed(0)}%</span>
        <span style={{ color: awayColor }}>
          {awayLabel} {ap.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
