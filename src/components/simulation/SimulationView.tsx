import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { PLAYER_IDS, PLAYERS, getPlayerOfTeam } from '../../config/teams';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import { buildR32Field, simulateTournament, type SimOutcome } from '../../utils/simulation';
import type { PlayerId } from '../../types';

const NF = new Intl.NumberFormat('ja-JP');

/** 平均との差を符号付きで整形 (+12,000 / -8,000 / ±0) */
function signed(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '±0';
  return `${r > 0 ? '+' : '−'}${NF.format(Math.abs(r))}`;
}
function devColor(n: number): string {
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-slate-400';
}

interface PlayerLine {
  id: PlayerId;
  name: string;
  color: string;
  base: number; // 現在の確定ポイント (予選等)
  koGain: number; // シミュレーションで増える KO ポイント
  total: number;
  dev: number; // 平均 (総得点÷4) との差 = 上振れ/下振れ
  teams: { team: string; stage: string; points: number }[]; // 出場チームの結果
}

function buildPlayerLines(
  outcome: SimOutcome,
  field: string[],
  baseByPlayer: Record<PlayerId, number>,
  names: Record<PlayerId, string>,
): PlayerLine[] {
  const lines: Record<PlayerId, PlayerLine> = {} as Record<PlayerId, PlayerLine>;
  for (const id of PLAYER_IDS) {
    lines[id] = {
      id,
      name: names[id],
      color: PLAYERS[id].color,
      base: baseByPlayer[id],
      koGain: 0,
      total: baseByPlayer[id],
      dev: 0,
      teams: [],
    };
  }
  for (const team of field) {
    const pid = getPlayerOfTeam(team);
    if (!pid) continue;
    const ko = outcome.ko[team];
    if (!ko) continue;
    lines[pid].koGain += ko.points;
    lines[pid].total += ko.points;
    lines[pid].teams.push({ team, stage: ko.stage, points: ko.points });
  }
  // 平均 (4人の総得点 ÷ 4) からの偏差。合計は毎回一定なので「上振れ」が勝負どころ
  const avg = PLAYER_IDS.reduce((s, id) => s + lines[id].total, 0) / PLAYER_IDS.length;
  for (const id of PLAYER_IDS) {
    lines[id].dev = lines[id].total - avg;
    lines[id].teams.sort((a, b) => b.points - a.points);
  }
  return PLAYER_IDS.map((id) => lines[id]).sort((a, b) => b.total - a.total);
}

/** ガウシアンカーネル密度推定。grid 上の密度を返す */
function kdeCurve(samples: number[], grid: number[], h: number): number[] {
  const n = samples.length;
  if (n === 0 || h <= 0) return grid.map(() => 0);
  const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
  return grid.map((x) => {
    let s = 0;
    for (const v of samples) {
      const u = (x - v) / h;
      s += Math.exp(-0.5 * u * u);
    }
    return s * norm;
  });
}

/**
 * 4人の「平均からの偏差 (上振れ/下振れ)」分布図。
 * X軸 = 平均との差 (額)、各回1000サンプルを正規分布風カーブで重ね描き。透明度で重なりを見せる。
 */
function DevDistribution({
  devSamples,
  names,
}: {
  devSamples: Record<PlayerId, number[]>;
  names: Record<PlayerId, string>;
}) {
  const W = 340;
  const H = 168;
  const padL = 6;
  const padR = 6;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const chart = useMemo(() => {
    const all = PLAYER_IDS.flatMap((id) => devSamples[id]);
    if (all.length === 0) return null;
    let M = Math.max(...all.map((v) => Math.abs(v)));
    if (!isFinite(M) || M <= 0) M = 1;
    M *= 1.08; // 端に少し余白
    const GRID = 121;
    const grid = Array.from({ length: GRID }, (_, i) => -M + (2 * M * i) / (GRID - 1));
    const h = (2 * M) / 18; // バンド幅 (見やすさ優先の固定値)
    const curves = PLAYER_IDS.map((id) => ({
      id,
      color: PLAYERS[id].color,
      y: kdeCurve(devSamples[id], grid, h),
    }));
    const maxY = Math.max(1e-9, ...curves.flatMap((c) => c.y));
    return { M, grid, curves, maxY };
  }, [devSamples]);

  if (!chart) return null;
  const { M, grid, curves, maxY } = chart;

  const sx = (x: number) => padL + ((x + M) / (2 * M)) * plotW;
  const sy = (y: number) => padT + plotH - (y / maxY) * plotH;
  const baseY = padT + plotH;

  const areaPath = (ys: number[]) => {
    let d = `M ${sx(grid[0]).toFixed(1)} ${baseY.toFixed(1)}`;
    grid.forEach((x, i) => {
      d += ` L ${sx(x).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
    });
    d += ` L ${sx(grid[grid.length - 1]).toFixed(1)} ${baseY.toFixed(1)} Z`;
    return d;
  };
  const linePath = (ys: number[]) =>
    grid.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(1)} ${sy(ys[i]).toFixed(1)}`).join(' ');

  const ticks = [-M, -M / 2, 0, M / 2, M];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-300">📈 上振れ/下振れの分布</span>
        <span className="text-[10px] text-slate-500">←下振れ ・ 平均 ・ 上振れ→</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        {/* 平均=0 の基準線 */}
        <line x1={sx(0)} y1={padT} x2={sx(0)} y2={baseY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        {/* 各プレイヤーの分布 (塗りは薄く、輪郭はくっきり) */}
        {curves.map((c) => (
          <path key={`a-${c.id}`} d={areaPath(c.y)} fill={c.color} fillOpacity={0.16} stroke="none" />
        ))}
        {curves.map((c) => (
          <path key={`l-${c.id}`} d={linePath(c.y)} fill="none" stroke={c.color} strokeOpacity={0.9} strokeWidth={1.6} />
        ))}
        {/* X軸 */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#475569" strokeWidth={1} />
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={sx(t)} y1={baseY} x2={sx(t)} y2={baseY + 3} stroke="#475569" strokeWidth={1} />
            <text x={sx(t)} y={baseY + 13} textAnchor="middle" className="fill-slate-400" fontSize={8}>
              {Math.abs(t) < 1 ? '平均' : signed(t)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
        {PLAYER_IDS.map((id) => (
          <span key={id} className="flex items-center gap-1 text-[10px]">
            <span className="badge-dot" style={{ backgroundColor: PLAYERS[id].color }} />
            <span className="text-slate-300">{names[id]}</span>
          </span>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        各カーブ = 1000回試行での <b className="text-slate-400">平均との差</b> の出方。山が右ほど上振れしやすく、
        鋭い山ほど安定。重なりは透明度で表示。
      </p>
    </div>
  );
}

const STAGE_COLOR: Record<string, string> = {
  優勝: 'text-gold-500',
  準優勝: 'text-slate-200',
  '3位': 'text-amber-500',
  '4位': 'text-amber-600',
  ベスト8: 'text-green-400',
  ベスト16: 'text-slate-400',
  ベスト32: 'text-slate-500',
};

export function SimulationView() {
  const { matches, playerScores, championOdds, settings } = useGame();

  const field = useMemo(() => buildR32Field(matches), [matches]);
  const baseByPlayer = useMemo(() => {
    const m = {} as Record<PlayerId, number>;
    for (const p of playerScores) m[p.id] = p.totalPoints;
    return m;
  }, [playerScores]);
  const hasOdds = Object.keys(championOdds).length > 0;

  const [outcome, setOutcome] = useState<SimOutcome | null>(null);
  const [runId, setRunId] = useState(0);
  const [agg, setAgg] = useState<{
    wins: Record<PlayerId, number>;
    devSum: Record<PlayerId, number>; // 各回の平均偏差の総和 → ÷runs で期待上振れ
    sfSum: Record<PlayerId, number>; // ベスト4 (準決勝=優勝/準優勝/3位/4位) に残したチーム数の総和
    devSamples: Record<PlayerId, number[]>; // 各回の平均偏差を全部保持 → 分布図用
    runs: number;
  } | null>(null);

  const lines = useMemo(
    () => (outcome ? buildPlayerLines(outcome, field, baseByPlayer, settings.playerNames) : null),
    [outcome, field, baseByPlayer, settings.playerNames],
  );

  const run = () => {
    setAgg(null);
    setOutcome(simulateTournament(field, championOdds));
    setRunId((v) => v + 1);
  };

  const runAggregate = () => {
    const RUNS = 1000;
    const wins = { A: 0, B: 0, C: 0, D: 0 } as Record<PlayerId, number>;
    const devSum = { A: 0, B: 0, C: 0, D: 0 } as Record<PlayerId, number>;
    const sfSum = { A: 0, B: 0, C: 0, D: 0 } as Record<PlayerId, number>;
    const devSamples = { A: [], B: [], C: [], D: [] } as Record<PlayerId, number[]>;
    for (let i = 0; i < RUNS; i++) {
      const o = simulateTournament(field, championOdds);
      const ls = buildPlayerLines(o, field, baseByPlayer, settings.playerNames);
      wins[ls[0].id] += 1; // 最終1位 (同点は先頭勝ち・稀)
      for (const l of ls) {
        devSum[l.id] += l.dev; // 平均偏差を累積
        devSamples[l.id].push(l.dev); // 分布図用に全サンプル保持
      }
      // ベスト4 = 準決勝に進んだ 4 チーム (優勝/準優勝/3位/4位)
      for (const t of [o.champion, o.runnerUp, o.third, o.fourth]) {
        const pid = getPlayerOfTeam(t);
        if (pid) sfSum[pid] += 1;
      }
    }
    setAgg({ wins, devSum, sfSum, devSamples, runs: RUNS });
    setOutcome(null);
  };

  const owner = (team: string) => {
    const pid = getPlayerOfTeam(team);
    return pid ? { name: settings.playerNames[pid], color: PLAYERS[pid].color } : null;
  };

  const medalRow = (icon: string, label: string, team: string) => {
    const o = owner(team);
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-12 text-slate-400 text-xs">{icon} {label}</span>
        <span className="font-semibold">
          {getFlag(team)} {getTeamNameJa(team)}
        </span>
        {o && (
          <span className="text-xs flex items-center gap-1 ml-auto">
            <span className="badge-dot" style={{ backgroundColor: o.color }} />
            <span style={{ color: o.color }}>{o.name}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <header className="card-header">
          <h2 className="font-heading text-base flex items-center gap-2">
            🎲 <span>優勝シミュレーション</span>
          </h2>
          <span className="text-[10px] text-slate-400">Polymarket 優勝確率 × 乱数</span>
        </header>
        <div className="card-body space-y-3">
          <p className="text-xs text-slate-400">
            残っている32チームを Polymarket の優勝確率を強さにして、ノックアウトを最後までランダム抽選。
            ボタンを押すたびに結果が変わります。4人の最終得点はどうなる？
          </p>
          {!hasOdds && (
            <p className="text-xs text-amber-300">優勝確率を取得中です。少し待ってからお試しください。</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={run} disabled={!hasOdds} className="btn-primary text-sm">
              🎲 シミュレーション実行
            </button>
            <button onClick={runAggregate} disabled={!hasOdds} className="btn-ghost text-sm">
              📊 1000回試行で優勝確率
            </button>
          </div>
        </div>
      </section>

      {/* 集計モード */}
      {agg && (
        <section className="card">
          <header className="card-header">
            <h3 className="font-heading text-base">📊 ドラフト優勝確率 ({agg.runs}回試行)</h3>
          </header>
          <div className="card-body space-y-3">
            {PLAYER_IDS.map((id) => ({
              id,
              p: agg.wins[id] / agg.runs,
              avgDev: agg.devSum[id] / agg.runs,
              sfAvg: agg.sfSum[id] / agg.runs,
            }))
              .sort((a, b) => b.p - a.p)
              .map(({ id, p, avgDev, sfAvg }) => (
                <div key={id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className="badge-dot" style={{ backgroundColor: PLAYERS[id].color }} />
                      <span className="font-semibold">{settings.playerNames[id]}</span>
                    </span>
                    <span className="font-heading tabular-nums w-14 text-right" style={{ color: PLAYERS[id].color }}>
                      {(p * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-navy-900/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${p * 100}%`, backgroundColor: PLAYERS[id].color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-0.5">
                    <span className="text-slate-400">🏅 ベスト4 平均 <b className="text-slate-200">{sfAvg.toFixed(1)}</b> 国</span>
                    <span className={`tabular-nums ${devColor(avgDev)}`}>期待上振れ 平均{signed(avgDev)}</span>
                  </div>
                </div>
              ))}
            <p className="text-[10px] text-slate-500">
              <b>%</b> = 最終1位になった割合。<b>ベスト4 平均◯国</b> = 準決勝に残せるチーム数の期待値。
              <b>期待上振れ</b> = 4人平均からの平均差 (プラスほど稼げる編成)。
            </p>
            <DevDistribution devSamples={agg.devSamples} names={settings.playerNames} />
          </div>
        </section>
      )}

      {/* 単発モードの結果 */}
      {outcome && lines && (
        <>
          <section className="card" key={runId}>
            <header className="card-header">
              <h3 className="font-heading text-base">🏆 今回の結果</h3>
            </header>
            <div className="card-body space-y-1.5">
              {medalRow('🏆', '優勝', outcome.champion)}
              {medalRow('🥈', '準優勝', outcome.runnerUp)}
              {medalRow('🥉', '3位', outcome.third)}
              {medalRow('4', '4位', outcome.fourth)}
            </div>
          </section>

          <section className="card">
            <header className="card-header">
              <h3 className="font-heading text-base">最終得点ランキング</h3>
            </header>
            <ul className="divide-y divide-white/5">
              {lines.map((l, i) => (
                <li key={l.id} className={`px-4 py-3 ${i === 0 ? 'bg-gold-500/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-lg w-6 text-center text-gold-500">{i + 1}</span>
                    <span className="badge-dot" style={{ backgroundColor: l.color }} />
                    <span className="font-semibold flex-1">{l.name}</span>
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${devColor(l.dev)}`}>
                          平均{signed(l.dev)}
                        </span>
                        <span className="font-heading text-xl tabular-nums" style={{ color: l.color }}>
                          {NF.format(l.total)}
                        </span>
                      </div>
                      {l.koGain > 0 && (
                        <div className="text-[10px] text-slate-400">KO +{NF.format(l.koGain)}</div>
                      )}
                    </div>
                  </div>
                  {l.teams.length > 0 && (
                    <div className="mt-1.5 pl-9 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                      {l.teams.map((t) => (
                        <span key={t.team}>
                          {getFlag(t.team)} {getTeamNameJa(t.team)}
                          <span className={`ml-1 ${STAGE_COLOR[t.stage] ?? 'text-slate-400'}`}>{t.stage}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-white/5">
              得点は確定ポイント + シミュした KO の合計。4人の総得点は毎回同じなので、
              <b className="text-slate-400">平均±</b>(= 4人平均との差)が勝負どころ。プラスが上振れ・マイナスが下振れ。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
