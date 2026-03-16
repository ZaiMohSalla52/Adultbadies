import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getActiveVirtualGirlfriend,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionImages,
  setActiveVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendProfileView } from '@/components/virtual-girlfriend/profile-view';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';

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

  const explicitStatus = companion.generation_status;
  const hasImages = images.length > 0;
  const ageMs = Date.now() - new Date(companion.updated_at).getTime();
  const staleWithoutImages = ageMs > 2 * 60 * 1000;
  const fallbackStatus: VirtualGirlfriendCompanionStatus = !companion.setup_completed
    ? 'generating'
    : hasImages
      ? 'ready'
      : staleWithoutImages
        ? 'failed'
        : 'generating';
  const status: VirtualGirlfriendCompanionStatus = explicitStatus ?? fallbackStatus;

  return <VirtualGirlfriendProfileView companion={companion} visualProfile={visualProfile} images={images} status={status} />;
}
