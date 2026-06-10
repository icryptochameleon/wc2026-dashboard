import { BattleNow } from '../components/dashboard/BattleNow';
import { NextBattle } from '../components/dashboard/NextBattle';
import { OddsPortfolio } from '../components/dashboard/OddsPortfolio';
import { RecentResults } from '../components/dashboard/RecentResults';
import { Scoreboard } from '../components/dashboard/Scoreboard';
import { ScoreChart } from '../components/dashboard/ScoreChart';
import { useGame } from '../context/GameContext';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { settings } = useGame();
  return (
    <div className="space-y-4">
      {!settings.apiKey && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="px-4 py-3 text-sm text-amber-200 flex items-center justify-between gap-3 flex-wrap">
            <span>
              ⚠️ API キー未設定 — 試合結果は手動入力モードです
            </span>
            <Link to="/settings" className="btn-primary text-xs px-3 py-1">
              設定へ →
            </Link>
          </div>
        </div>
      )}
      <BattleNow />
      <Scoreboard />
      <OddsPortfolio />
      <div className="grid gap-4 lg:grid-cols-2">
        <NextBattle />
        <RecentResults />
      </div>
      <ScoreChart />
    </div>
  );
}
