import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PlayerScore } from '../../types';
import { getTeamNameJa } from '../../utils/teamUtils';

const POS = '#22c55e';
const NEG = '#ef4444';

export function TeamContribution({ score }: { score: PlayerScore }) {
  const teams = Object.values(score.teamScores);
  // 1 試合でも消化したチーム
  const played = teams.filter((t) => t.wins + t.draws + t.losses > 0);
  // 純得点が ±0 でない = 順位に効いているチーム (勝ち越し/負け越し両方)
  const data = played
    .filter((t) => t.points !== 0)
    .map((t) => ({ team: getTeamNameJa(t.team), points: t.points }))
    .sort((a, b) => b.points - a.points);

  if (data.length === 0) {
    return (
      <div className="text-center text-sm text-slate-400 py-8">
        {played.length === 0
          ? 'まだ試合が行われていません'
          : '勝敗が拮抗し、純貢献はまだ ±0 です'}
      </div>
    );
  }

  // 負のバーも入るので高さを件数に合わせる
  const height = Math.max(160, data.length * 28 + 40);

  // 0 を必ず含む軸ドメイン (全チーム同値でも 0 起点で長さが読めるように)
  const lo = Math.min(0, ...data.map((d) => d.points));
  const hi = Math.max(0, ...data.map((d) => d.points));
  const pad = Math.max(1000, (hi - lo) * 0.1);
  const domain: [number, number] = [lo < 0 ? lo - pad : 0, hi > 0 ? hi + pad : 0];

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            domain={domain}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <YAxis dataKey="team" type="category" tick={{ fill: '#cbd5e1', fontSize: 11 }} width={88} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: '#0f1b3d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toLocaleString()} pt`, '純貢献']}
          />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.25)" />
          <Bar dataKey="points" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.points > 0 ? POS : NEG} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
