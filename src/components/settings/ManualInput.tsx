import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { getFlag, getTeamNameJa } from '../../utils/teamUtils';
import type { MatchStage, MatchStatus } from '../../types';
import { formatJSTDateLabel, formatJSTTime } from '../../utils/dateUtils';

const STATUSES: { value: MatchStatus; label: string }[] = [
  { value: 'SCHEDULED', label: '未開始' },
  { value: 'IN_PLAY', label: 'LIVE' },
  { value: 'FINISHED', label: '終了' },
];

export function ManualInput() {
  const { matches, setMatches } = useGame();
  const [filter, setFilter] = useState<'ALL' | MatchStage>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return matches
      .filter((m) => filter === 'ALL' || m.stage === filter)
      .filter((m) => {
        if (!lower) return true;
        return (
          m.homeTeam.name.toLowerCase().includes(lower) ||
          m.awayTeam.name.toLowerCase().includes(lower) ||
          getTeamNameJa(m.homeTeam.name).includes(search) ||
          getTeamNameJa(m.awayTeam.name).includes(search)
        );
      })
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  }, [matches, filter, search]);

  const updateStatus = (id: string, status: MatchStatus) => {
    setMatches(matches.map((m) => (m.id === id ? { ...m, status } : m)));
  };

  const updateScore = (
    id: string,
    side: 'home' | 'away',
    value: string,
  ) => {
    const num = value === '' ? null : Math.max(0, Math.floor(Number(value)));
    setMatches(
      matches.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          score: {
            ...m.score,
            fullTime: {
              ...m.score.fullTime,
              [side]: Number.isNaN(num as number) ? null : num,
            },
          },
        };
      }),
    );
  };

  return (
    <section className="card">
      <header className="card-header">
        <h3 className="font-heading text-base flex items-center gap-2">
          📝 手動スコア入力
        </h3>
        <span className="text-[10px] text-slate-500">
          {filtered.length} / {matches.length} 試合
        </span>
      </header>
      <div className="card-body space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="🔍 チーム名で検索"
            className="input flex-1 min-w-[180px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | MatchStage)}
          >
            <option value="ALL">全ステージ</option>
            <option value="GROUP_STAGE">グループ</option>
            <option value="LAST_32">ベスト32</option>
            <option value="LAST_16">ベスト16</option>
            <option value="QUARTER_FINALS">ベスト8</option>
            <option value="SEMI_FINALS">ベスト4</option>
            <option value="THIRD_PLACE">3位決定戦</option>
            <option value="FINAL">決勝</option>
          </select>
        </div>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 pr-1 space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">該当試合なし</p>
          )}
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-navy-900/40 border border-white/5 rounded-lg p-2.5"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                <span>
                  {formatJSTDateLabel(m.utcDate)} {formatJSTTime(m.utcDate)}
                </span>
                <span>{m.group ?? m.stage.replace(/_/g, ' ')}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-1.5">
                <span className="text-sm text-right truncate">
                  {getFlag(m.homeTeam.name)} {getTeamNameJa(m.homeTeam.name)}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input w-12 text-center px-1"
                  value={m.score.fullTime.home ?? ''}
                  onChange={(e) => updateScore(m.id, 'home', e.target.value)}
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input w-12 text-center px-1"
                  value={m.score.fullTime.away ?? ''}
                  onChange={(e) => updateScore(m.id, 'away', e.target.value)}
                />
                <span className="text-sm truncate">
                  {getFlag(m.awayTeam.name)} {getTeamNameJa(m.awayTeam.name)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateStatus(m.id, s.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      m.status === s.value
                        ? 'bg-gold-500 text-navy-900 border-gold-500 font-bold'
                        : 'border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
