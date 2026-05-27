import { GROUP_LETTERS } from '../../config/teams';
import { GroupTable } from './GroupTable';

export function GroupStage() {
  return (
    <section>
      <h2 className="font-heading text-lg mb-3 text-slate-300">📋 グループステージ</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {GROUP_LETTERS.map((g) => (
          <GroupTable key={g} letter={g} />
        ))}
      </div>
    </section>
  );
}
