import type { TeamScore } from '../../types';
import { STAGE_LABEL_JA } from '../../config/scoring';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { getGroupOfTeam } from '../../config/teams';

const NF = new Intl.NumberFormat('ja-JP');

function statusBadge(score: TeamScore): { icon: string; label: string; cls: string } {
  if (score.finalResult === 'CHAMPION')
    return { icon: '🏆', label: '優勝', cls: 'bg-gold-500/20 text-gold-500 border-gold-500/30' };
  if (score.finalResult === 'RUNNER_UP')
    return { icon: '🥈', label: '準優勝', cls: 'bg-slate-300/20 text-slate-300 border-slate-300/30' };
  if (score.finalResult === 'THIRD_PLACE')
    return { icon: '🥉', label: '3位', cls: 'bg-amber-600/20 text-amber-500 border-amber-600/30' };
  if (score.eliminated)
    return { icon: '❌', label: '敗退', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  return { icon: '🟢', label: '進行中', cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
}

export function TeamCard({ score, color }: { score: TeamScore; color: string }) {
  const group = getGroupOfTeam(score.team);
  const badge = statusBadge(score);
  return (
    <div className="card overflow-hidden">
      <div
        className="h-1"
        style={{ background: color }}
      />
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xl sm:text-2xl font-heading flex items-center gap-1.5">
              <span>{getFlag(score.team)}</span>
              <span>{getTeamNameJa(score.team)}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Group {group ?? '?'} · {STAGE_LABEL_JA[score.currentStage]}
            </div>
          </div>
          <span className={`pill border ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
        </div>

        <div className="grid grid-cols-3 text-center bg-navy-900/40 rounded-lg overflow-hidden">
          <div className="py-2">
            <div className="text-[10px] text-slate-400">勝</div>
            <div className="font-heading text-green-400">{score.wins}</div>
          </div>
          <div className="py-2 border-x border-white/5">
            <div className="text-[10px] text-slate-400">分</div>
            <div className="font-heading text-slate-300">{score.draws}</div>
          </div>
          <div className="py-2">
            <div className="text-[10px] text-slate-400">負</div>
            <div className="font-heading text-red-400">{score.losses}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">獲得ポイント</span>
          <span className="font-heading text-2xl tabular-nums" style={{ color }}>
            {NF.format(score.points)}
          </span>
        </div>

        {score.breakdown.length > 0 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-200">
              内訳 ({score.breakdown.length})
            </summary>
            <ul className="mt-2 space-y-1 pl-2">
              {score.breakdown.map((b, i) => (
                <li key={i} className="flex justify-between">
                  <span>{b.label}</span>
                  <span className="text-gold-500 tabular-nums">+{NF.format(b.points)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
