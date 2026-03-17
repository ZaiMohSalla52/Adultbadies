import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { getModerationQueueSnapshot } from '@/lib/moderation/data';
import { requireAdminReviewer } from '@/lib/auth/admin';
import {
  listPendingCanonicalReviewVisualProfiles,
  setCanonicalReviewDecisionForVisualProfile,
} from '@/lib/virtual-girlfriend/data';

export default async function AdminOverviewPage() {
  const admin = await requireAdminReviewer();
  const snapshot = await getModerationQueueSnapshot();
  const pendingCanonicals = await listPendingCanonicalReviewVisualProfiles(admin.accessToken);

  const submitCanonicalReview = async (formData: FormData) => {
    'use server';

    const reviewer = await requireAdminReviewer();
    const visualProfileId = String(formData.get('visualProfileId') ?? '').trim();
    const decision = String(formData.get('decision') ?? '').trim();
    const reviewNotes = String(formData.get('reviewNotes') ?? '').trim();

    if (!visualProfileId || (decision !== 'approved' && decision !== 'rejected')) {
      return;
    }

    await setCanonicalReviewDecisionForVisualProfile(reviewer.accessToken, {
      visualProfileId,
      decision,
      reviewedBy: reviewer.user.id,
      reviewNotes,
    });

    revalidatePath('/overview');
  };

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

      <Card>
        <h2 className="my-0 text-base font-semibold">Canonical portrait review queue</h2>
        <p className="mt-1 text-sm text-muted">Pending canonical portraits: {pendingCanonicals.length}</p>

        <div className="mt-3 flex flex-col gap-3">
          {pendingCanonicals.length === 0 ? (
            <p className="text-sm text-muted">No pending canonical portraits.</p>
          ) : (
            pendingCanonicals.map((profile) => (
              <form key={profile.id} action={submitCanonicalReview} className="rounded-lg border border-border p-3">
                <input type="hidden" name="visualProfileId" value={profile.id} />
                <p className="my-0 text-sm font-medium">Companion: {profile.companion_id}</p>
                <p className="my-0 text-xs text-muted">Visual profile: {profile.id}</p>
                <p className="my-0 text-xs text-muted">Created: {new Date(profile.created_at).toLocaleString()}</p>
                <textarea
                  name="reviewNotes"
                  placeholder="Optional review notes"
                  className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
                  rows={2}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approved"
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Approve canonical
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="rejected"
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Reject canonical
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
