import { Card } from '@/components/ui/card';
import { getModerationQueueSnapshot } from '@/lib/moderation/data';

export default async function AdminOverviewPage() {
  const snapshot = await getModerationQueueSnapshot();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="my-0 text-lg font-semibold">Admin overview</h1>
        <p className="text-sm text-muted">Moderation foundation snapshot for upcoming tooling.</p>
      </Card>

      <Card>
        <p className="my-0 font-medium">Open/reviewing reports: {snapshot.reports.length}</p>
        <p className="text-sm text-muted">Recent moderation logs: {snapshot.logs.length}</p>
      </Card>
    </div>
  );
}
