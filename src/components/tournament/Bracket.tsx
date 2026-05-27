import { useGame } from '../../context/GameContext';
import type { MatchStage } from '../../types';
import { BracketMatch } from './BracketMatch';

const STAGES: { key: MatchStage; label: string; slots: number }[] = [
  { key: 'LAST_32', label: 'ベスト32', slots: 16 },
  { key: 'LAST_16', label: 'ベスト16', slots: 8 },
  { key: 'QUARTER_FINALS', label: 'ベスト8', slots: 4 },
  { key: 'SEMI_FINALS', label: 'ベスト4', slots: 2 },
  { key: 'FINAL', label: '決勝', slots: 1 },
];

export function Bracket() {
  const { matches } = useGame();

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-heading text-lg text-slate-300">🏆 ノックアウトラウンド</h2>
        <span className="text-[10px] text-slate-500">→ 横スクロール可</span>
      </div>
      <div className="scroll-x">
        <div className="flex gap-4 min-w-max pb-4">
          {STAGES.map((stage) => {
            const stageMatches = matches.filter((m) => m.stage === stage.key);
            const slots = Math.max(stage.slots, stageMatches.length);
            return (
              <div key={stage.key} className="flex flex-col gap-3 shrink-0">
                <div className="text-xs font-bold text-gold-500 sticky top-0 bg-navy-900/60 backdrop-blur px-2 py-1 rounded">
                  {stage.label}
                </div>
                <div className="flex flex-col gap-3" style={{ minHeight: `${slots * 90}px` }}>
                  {Array.from({ length: slots }).map((_, i) => (
                    <BracketMatch key={i} match={stageMatches[i]} />
                  ))}
                </div>
              </div>
            );
          })}
          {/* 3位決定戦 (横並びの最後尾) */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="text-xs font-bold text-amber-500 sticky top-0 bg-navy-900/60 backdrop-blur px-2 py-1 rounded">
              3位決定戦
            </div>
            <BracketMatch match={matches.find((m) => m.stage === 'THIRD_PLACE')} />
          </div>
        </div>
      </div>
    </section>
  );
}
