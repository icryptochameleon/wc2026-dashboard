import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { buildScoreTimeline } from '../../utils/scoreCalculator';
import { PLAYERS } from '../../config/teams';

export function ScoreChart() {
  const { matches, settings } = useGame();
  const data = useMemo(() => buildScoreTimeline(matches), [matches]);

  if (data.length === 0) {
    return (
      <section className="card">
        <header className="card-header">
          <h2 className="font-heading text-base flex items-center gap-2">
            📈 <span>得点推移</span>
          </h2>
        </header>
        <div className="card-body text-sm text-slate-400">
          試合が終わると得点推移グラフが表示されます。
        </div>
      </section>
    );
  }

  // ラベル付け替え (Hammer => 設定上の名前)
  const lines = (['A', 'B', 'C', 'D'] as const).map((id) => ({
    id,
    key: PLAYERS[id].name, // dataKey
    label: settings.playerNames[id],
    color: PLAYERS[id].color,
  }));

  return (
    <section className="card">
      <header className="card-header">
        <h2 className="font-heading text-base flex items-center gap-2">
          📈 <span>得点推移</span>
        </h2>
      </header>
      <div className="card-body">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip
                contentStyle={{
                  background: '#0f1b3d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => {
                  const line = lines.find((l) => l.key === name);
                  return [`${v.toLocaleString()} pt`, line?.label ?? name];
                }}
              />
              <Legend
                formatter={(v: string) => lines.find((l) => l.key === v)?.label ?? v}
                wrapperStyle={{ fontSize: 12 }}
              />
              {lines.map((l) => (
                <Line
                  key={l.id}
                  type="monotone"
                  dataKey={l.key}
                  stroke={l.color}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
