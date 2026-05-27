import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { PLAYER_IDS, PLAYERS } from '../../config/teams';
import type { PlayerId } from '../../types';
import { TeamCard } from './TeamCard';
import { TeamContribution } from './TeamContribution';
import { stageRank } from '../../config/scoring';

const NF = new Intl.NumberFormat('ja-JP');

export function PlayerDetail() {
  const { playerId: rawId } = useParams();
  const navigate = useNavigate();
  const { playerScores, settings } = useGame();
  const playerId = (PLAYER_IDS.includes(rawId as PlayerId) ? rawId : 'A') as PlayerId;
  const score = playerScores.find((p) => p.id === playerId)!;
  const profile = PLAYERS[playerId];
  const displayName = settings.playerNames[playerId];

  const teamList = Object.values(score.teamScores).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return stageRank(b.currentStage) - stageRank(a.currentStage);
  });

  return (
    <div className="space-y-4">
      {/* Player switcher */}
      <div className="scroll-x">
        <div className="flex gap-2 min-w-max">
          {PLAYER_IDS.map((id) => {
            const p = PLAYERS[id];
            const s = playerScores.find((ps) => ps.id === id)!;
            const isActive = id === playerId;
            return (
              <button
                key={id}
                onClick={() => navigate(`/players/${id}`)}
                className={`px-3 py-2 rounded-xl border transition-all text-left min-w-[140px] ${
                  isActive
                    ? 'border-current ring-2'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={isActive ? { color: p.color, boxShadow: `0 0 0 1px ${p.color}` } : {}}
              >
                <div className="flex items-center gap-1.5">
                  <span className="badge-dot" style={{ backgroundColor: p.color }} />
                  <span className={`text-sm font-semibold ${isActive ? '' : 'text-slate-200'}`}>
                    {settings.playerNames[id]}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 tabular-nums">
                  {NF.format(s.totalPoints)} pt · {s.rank}位
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Player Header */}
      <section
        className="card overflow-hidden"
        style={{ borderColor: `${profile.color}40` }}
      >
        <div className="h-1" style={{ background: profile.color }} />
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: profile.color }}
              />
              <h2 className="font-heading text-2xl sm:text-3xl">{displayName}</h2>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {profile.teams.length} チーム保有 · 第 {score.rank} 位
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">合計ポイント</div>
            <div className="font-heading text-3xl sm:text-4xl tabular-nums" style={{ color: profile.color }}>
              {NF.format(score.totalPoints)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              予選 {NF.format(score.groupPoints)} · T {NF.format(score.knockoutPoints)}
            </div>
          </div>
        </div>
      </section>

      {/* Contribution Chart */}
      <section className="card">
        <header className="card-header">
          <h3 className="font-heading text-base flex items-center gap-2">
            📊 <span>貢献度ランキング</span>
          </h3>
        </header>
        <div className="card-body">
          <TeamContribution score={score} />
        </div>
      </section>

      {/* Team Cards */}
      <section>
        <h3 className="font-heading text-base mb-3 text-slate-300">
          🌍 所有チーム ({profile.teams.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamList.map((t) => (
            <TeamCard key={t.team} score={t} color={profile.color} />
          ))}
        </div>
      </section>
    </div>
  );
}
