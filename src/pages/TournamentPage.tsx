import { GroupStage } from '../components/tournament/GroupStage';
import { Bracket } from '../components/tournament/Bracket';

export default function TournamentPage() {
  return (
    <div className="space-y-8">
      <GroupStage />
      <Bracket />
    </div>
  );
}
