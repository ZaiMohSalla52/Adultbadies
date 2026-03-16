import { redirect } from 'next/navigation';
import { VirtualGirlfriendRosterHub } from '@/components/virtual-girlfriend/roster-hub';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';
import {
  getActiveVirtualGirlfriend,
  getVirtualGirlfriendCompanionImages,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';

export default async function VirtualGirlfriendIndexPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [companions, activeCompanion, entitlements] = await Promise.all([
    listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id),
    getActiveVirtualGirlfriend(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
  ]);

  if (companions.length === 0) {
    redirect('/virtual-girlfriend/setup');
  }

  const uniqueCompanions = Array.from(new Map(companions.map((companion) => [companion.id, companion])).values());

  const cards = await Promise.all(
    uniqueCompanions.map(async (companion) => {
      const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user!.id, companion.id);
      const curated = curateVirtualGirlfriendImages(images);
      const hasImages = Boolean(curated.canonical || curated.gallery.length);
      const ageMs = Date.now() - new Date(companion.updated_at).getTime();
      const staleWithoutImages = ageMs > 2 * 60 * 1000;
      const status: VirtualGirlfriendCompanionStatus = !companion.setup_completed
        ? 'generating'
        : hasImages
          ? 'ready'
          : staleWithoutImages
            ? 'failed'
            : 'generating';
      return { companion, image: curated.canonical, status };
    }),
  );

  return <VirtualGirlfriendRosterHub items={cards} activeCompanionId={activeCompanion?.id ?? null} entitlements={entitlements} />;
}
