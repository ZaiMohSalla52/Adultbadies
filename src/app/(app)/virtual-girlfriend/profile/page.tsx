import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getActiveVirtualGirlfriend,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionImages,
  setActiveVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import { resolveCompanionImageState } from '@/lib/virtual-girlfriend/generation-state';
import { VirtualGirlfriendProfileView } from '@/components/virtual-girlfriend/profile-view';
import { GenerationPoller } from '@/components/virtual-girlfriend/generation-poller';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { claimPointStipend, getPointBalance, getUnlockedImageIds } from '@/lib/points/data';
import { POINTS } from '@/lib/points/constants';

export default async function VirtualGirlfriendProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ companionId?: string }>;
}) {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const requestedCompanionId = params.companionId;

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (!companion?.setup_completed) {
    redirect('/virtual-girlfriend/setup');
  }

  if (requestedCompanionId && companion.id !== requestedCompanionId) {
    redirect('/virtual-girlfriend');
  }

  if (!companion.is_active) {
    await setActiveVirtualGirlfriend(auth.accessToken, auth.user.id, companion.id);
  }

  const [visualProfile, images] = await Promise.all([
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id),
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
  ]);

  const status = resolveCompanionImageState({ companion, images, visualProfile });

  const entitlements = await getUserEntitlements(auth.accessToken, auth.user.id);
  // Premium members receive their monthly points stipend (idempotent per period).
  if (entitlements.isPremium) {
    await claimPointStipend(auth.accessToken);
  }
  const [pointBalance, unlockedImageIds] = await Promise.all([
    getPointBalance(auth.accessToken, auth.user.id),
    getUnlockedImageIds(auth.accessToken, auth.user.id, companion.id),
  ]);

  return (
    <>
      <GenerationPoller companionId={companion.id} status={status} />
      <VirtualGirlfriendProfileView
        companion={companion}
        visualProfile={visualProfile}
        images={images}
        status={status}
        pointBalance={pointBalance}
        unlockedImageIds={unlockedImageIds}
        unblurCost={POINTS.unblurCost}
        isPremium={entitlements.isPremium}
      />
    </>
  );
}
