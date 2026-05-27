import { MountainMap } from '../components/stats/MountainMap';
import { TopContributors, PlayerStageSummary } from '../components/stats/Predictions';

export default function StatsPage() {
  return (
    <div className="space-y-4">
      <MountainMap />
      <div className="grid lg:grid-cols-2 gap-4">
        <TopContributors />
        <PlayerStageSummary />
      </div>
    </div>
  );
}
