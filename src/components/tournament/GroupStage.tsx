import { GROUP_LETTERS } from '../../config/teams';
import { GroupTable } from './GroupTable';

export function GroupStage() {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-heading text-lg text-slate-300">📋 グループステージ</h2>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="text-[8px] px-1 py-0.5 rounded-full bg-green-500/30 text-green-300 border border-green-400/40 font-bold">突破</span>
            突破確定
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500/10 border border-green-500/30" /> 上位2位
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500/30" /> 3位(WC)
          </span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mb-3">
        グループ名をタップすると全試合結果が開きます。「突破」= 2位以内が数学的に確定したチーム。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {GROUP_LETTERS.map((g) => (
          <GroupTable key={g} letter={g} />
        ))}
      </div>
    </section>
  );
}
