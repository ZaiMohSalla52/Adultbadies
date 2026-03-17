import Image from 'next/image';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { requireAdminReviewer } from '@/lib/auth/admin';
import { getModerationQueueSnapshot } from '@/lib/moderation/data';
import {
  getVisualProfileById,
  listCanonicalReviewVisualProfilesByStatus,
  listVirtualGirlfriendCompanionImagesByIds,
  listVirtualGirlfriendCompanionsByIds,
  setCanonicalReviewDecisionForVisualProfile,
} from '@/lib/virtual-girlfriend/data';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';
import {
  regenerateCanonicalForVisualProfile,
  VirtualGirlfriendCanonicalRegenerateError,
} from '@/lib/virtual-girlfriend/visual-identity';

type CanonicalReviewMetadata = {
  lastRegeneratedAt?: string;
  regeneratedBy?: string;
  previousCanonicalReferenceImageId?: string;
  previousReview?: {
    status?: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
  };
};

const statusTone: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const toReviewMetadata = (profile: VirtualGirlfriendVisualProfileRecord): CanonicalReviewMetadata => {
  const raw = profile.canonical_reference_metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as CanonicalReviewMetadata;
};

const summarizeIdentity = (profile: VirtualGirlfriendVisualProfileRecord) => {
  const anchors = profile.identity_pack?.continuityAnchors ?? [];
  if (!anchors.length) return 'No continuity anchors available';
  return anchors.slice(0, 3).join(' · ');
};

const resolveVibe = (companion: VirtualGirlfriendCompanionRecord | undefined) => {
  const tags = companion?.profile_tags?.filter(Boolean) ?? [];
  if (tags.length) return tags.slice(0, 3).join(' · ');
  return companion?.visual_aesthetic ?? 'No vibe tags';
};

const sectionSubtitle = (status: 'pending' | 'rejected' | 'approved', count: number) => {
  if (status === 'pending') return `Ready for decision: ${count}`;
  if (status === 'rejected') return `Needs regeneration or reconsideration: ${count}`;
  return `Recently approved canonicals: ${count}`;
};

function CanonicalReviewCard({
  profile,
  companion,
  canonical,
  previousCanonical,
  onReview,
  onRegenerate,
  showDecisionActions,
}: {
  profile: VirtualGirlfriendVisualProfileRecord;
  companion?: VirtualGirlfriendCompanionRecord;
  canonical?: VirtualGirlfriendCompanionImageRecord;
  previousCanonical?: VirtualGirlfriendCompanionImageRecord;
  onReview: (formData: FormData) => Promise<void>;
  onRegenerate: (formData: FormData) => Promise<void>;
  showDecisionActions: boolean;
}) {
  const metadata = toReviewMetadata(profile);
  const previousReview = metadata.previousReview;
  const isBackfilled = profile.source_setup && Object.keys(profile.source_setup).length === 0;
  const hasRegenerated = Boolean(metadata.lastRegeneratedAt);

  return (
    <form action={onReview} className="rounded-xl border border-border bg-background p-4">
      <input type="hidden" name="visualProfileId" value={profile.id} />

      <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          {canonical?.delivery_url ? (
            <Image src={canonical.delivery_url} alt={`${companion?.name ?? 'Companion'} canonical portrait`} width={560} height={560} className="h-56 w-full object-cover" unoptimized />
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-muted">Canonical preview unavailable</div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="my-0 text-sm font-semibold">{companion?.name ?? `Companion ${profile.companion_id.slice(0, 8)}`}</p>
              <p className="my-0 text-xs text-muted">{companion?.archetype ?? 'Archetype unknown'} · {resolveVibe(companion)}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone[profile.canonical_review_status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {profile.canonical_review_status}
            </span>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-2">
            <p className="my-0 text-[11px] font-semibold uppercase tracking-wide text-muted">Identity summary</p>
            <p className="my-1 text-sm">{summarizeIdentity(profile)}</p>
          </div>

          <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
            <p className="my-0">Created: {formatDateTime(profile.created_at)}</p>
            <p className="my-0">Last updated: {formatDateTime(profile.updated_at)}</p>
            <p className="my-0">Reviewed at: {formatDateTime(profile.reviewed_at)}</p>
            <p className="my-0">Visual profile: {profile.id}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isBackfilled ? <span className="rounded-md border border-sky-200 bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700">Backfilled canonical</span> : null}
            {hasRegenerated ? <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">Regenerated canonical ({formatDateTime(metadata.lastRegeneratedAt)})</span> : null}
            {previousCanonical ? <span className="rounded-md border border-violet-200 bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700">Previous canonical snapshot available</span> : null}
          </div>

          {(profile.review_notes || previousReview?.reviewNotes) ? (
            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
              <p className="my-0 font-semibold">Review context</p>
              {profile.review_notes ? <p className="my-1 text-muted">Current note: {profile.review_notes}</p> : null}
              {previousReview?.reviewNotes ? <p className="my-1 text-muted">Previous note: {previousReview.reviewNotes}</p> : null}
            </div>
          ) : null}

          {showDecisionActions ? (
            <>
              <textarea
                name="reviewNotes"
                placeholder="Optional review notes for this decision"
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                rows={3}
              />

              <div className="grid gap-2 md:grid-cols-[1fr,1fr]">
                <button type="submit" name="decision" value="approved" className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                  Approve canonical
                </button>
                <button type="submit" name="decision" value="rejected" className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
                  Reject canonical
                </button>
              </div>
            </>
          ) : null}

          <div className="rounded-md border border-dashed border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="regenerateGallery" value="yes" className="h-3.5 w-3.5" />
                Regenerate gallery from new canonical
              </label>
              <button formAction={onRegenerate} type="submit" className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">
                Regenerate canonical
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function CanonicalReviewSection({
  title,
  status,
  profiles,
  companionsById,
  imagesById,
  onReview,
  onRegenerate,
}: {
  title: string;
  status: 'pending' | 'rejected' | 'approved';
  profiles: VirtualGirlfriendVisualProfileRecord[];
  companionsById: Map<string, VirtualGirlfriendCompanionRecord>;
  imagesById: Map<string, VirtualGirlfriendCompanionImageRecord>;
  onReview: (formData: FormData) => Promise<void>;
  onRegenerate: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="my-0 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{sectionSubtitle(status, profiles.length)}</p>

      <div className="mt-3 flex flex-col gap-3">
        {profiles.length === 0 ? (
          <p className="text-sm text-muted">No {status} canonical portraits.</p>
        ) : (
          profiles.map((profile) => {
            const metadata = toReviewMetadata(profile);
            const companion = companionsById.get(profile.companion_id);
            const canonical = profile.canonical_reference_image_id
              ? imagesById.get(profile.canonical_reference_image_id)
              : undefined;
            const previousCanonical = metadata.previousCanonicalReferenceImageId
              ? imagesById.get(metadata.previousCanonicalReferenceImageId)
              : undefined;

            return (
              <CanonicalReviewCard
                key={profile.id}
                profile={profile}
                companion={companion}
                canonical={canonical}
                previousCanonical={previousCanonical}
                onReview={onReview}
                onRegenerate={onRegenerate}
                showDecisionActions={status !== 'approved'}
              />
            );
          })
        )}
      </div>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requireAdminReviewer();
  const snapshot = await getModerationQueueSnapshot();
  const pendingCanonicals = await listCanonicalReviewVisualProfilesByStatus(admin.accessToken, 'pending', 50);
  const rejectedCanonicals = await listCanonicalReviewVisualProfilesByStatus(admin.accessToken, 'rejected', 30);
  const approvedCanonicals = await listCanonicalReviewVisualProfilesByStatus(admin.accessToken, 'approved', 12);

  const allProfiles = [...pendingCanonicals, ...rejectedCanonicals, ...approvedCanonicals];
  const companionIds = allProfiles.map((profile) => profile.companion_id);
  const previousCanonicalIds = allProfiles
    .map((profile) => toReviewMetadata(profile).previousCanonicalReferenceImageId)
    .filter((id): id is string => Boolean(id));
  const canonicalIds = allProfiles
    .map((profile) => profile.canonical_reference_image_id)
    .filter((id): id is string => Boolean(id));

  const [companions, images] = await Promise.all([
    listVirtualGirlfriendCompanionsByIds(admin.accessToken, companionIds),
    listVirtualGirlfriendCompanionImagesByIds(admin.accessToken, [...canonicalIds, ...previousCanonicalIds]),
  ]);

  const companionsById = new Map(companions.map((companion) => [companion.id, companion]));
  const imagesById = new Map(images.map((image) => [image.id, image]));

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

  const regenerateCanonical = async (formData: FormData) => {
    'use server';

    const reviewer = await requireAdminReviewer();
    const visualProfileId = String(formData.get('visualProfileId') ?? '').trim();
    const regenerateGallery = String(formData.get('regenerateGallery') ?? '').trim() === 'yes';

    if (!visualProfileId) {
      return;
    }

    const visualProfile = await getVisualProfileById(reviewer.accessToken, visualProfileId);
    if (!visualProfile) {
      console.error('[admin] canonical regenerate failed: visual profile not found', { visualProfileId });
      return;
    }

    try {
      await regenerateCanonicalForVisualProfile({
        token: reviewer.accessToken,
        visualProfile,
        requestedBy: reviewer.user.id,
        regenerateGallery,
      });
    } catch (error) {
      if (error instanceof VirtualGirlfriendCanonicalRegenerateError && error.canonicalImageId) {
        console.warn('[admin] canonical regenerated with gallery refresh warning', {
          visualProfileId,
          canonicalImageId: error.canonicalImageId,
          message: error.message,
        });
      } else {
        console.error('[admin] canonical regenerate failed', { visualProfileId, error });
      }
    }

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

      <CanonicalReviewSection
        title="Pending canonical portrait reviews"
        status="pending"
        profiles={pendingCanonicals}
        companionsById={companionsById}
        imagesById={imagesById}
        onReview={submitCanonicalReview}
        onRegenerate={regenerateCanonical}
      />

      <CanonicalReviewSection
        title="Rejected canonical portraits"
        status="rejected"
        profiles={rejectedCanonicals}
        companionsById={companionsById}
        imagesById={imagesById}
        onReview={submitCanonicalReview}
        onRegenerate={regenerateCanonical}
      />

      <CanonicalReviewSection
        title="Approved canonical portraits"
        status="approved"
        profiles={approvedCanonicals}
        companionsById={companionsById}
        imagesById={imagesById}
        onReview={submitCanonicalReview}
        onRegenerate={regenerateCanonical}
      />
    </div>
  );
}
