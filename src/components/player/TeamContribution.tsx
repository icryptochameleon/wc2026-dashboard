import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PlayerScore } from '../../types';
import { getTeamNameJa } from '../../utils/teamUtils';

export function TeamContribution({ score }: { score: PlayerScore }) {
  const data = Object.values(score.teamScores)
    .map((t) => ({ team: getTeamNameJa(t.team), points: t.points }))
    .sort((a, b) => b.points - a.points);

  const hasData = data.some((d) => d.points > 0);
  if (!hasData) {
    return (
      <div className="text-center text-sm text-slate-400 py-8">
        まだ得点が記録されていません
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
          <YAxis dataKey="team" type="category" tick={{ fill: '#cbd5e1', fontSize: 11 }} width={88} />
          <Tooltip
            contentStyle={{
              background: '#0f1b3d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v.toLocaleString()} pt`, '獲得']}
          />
          <Bar dataKey="points" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={score.color} fillOpacity={0.85 - i * 0.05} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
