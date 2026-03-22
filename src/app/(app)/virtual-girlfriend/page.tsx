import { redirect } from 'next/navigation';
import { VirtualGirlfriendRosterHub } from '@/components/virtual-girlfriend/roster-hub';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import {
  getVirtualGirlfriendCompanionImagesBatch,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';
import { resolveCompanionImageState } from '@/lib/virtual-girlfriend/generation-state';

export default async function VirtualGirlfriendIndexPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [companions, entitlements] = await Promise.all([
    listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
  ]);

  if (companions.length === 0) {
    redirect('/virtual-girlfriend/setup');
  }

  const uniqueCompanions = Array.from(new Map(companions.map((companion) => [companion.id, companion])).values());
  const activeCompanion = companions.find((c) => c.is_active) ?? null;

  const imageMap = await getVirtualGirlfriendCompanionImagesBatch(
    auth.accessToken,
    auth.user.id,
    uniqueCompanions.map((c) => c.id),
  );

  const cards = uniqueCompanions.map((companion) => {
    const images = imageMap.get(companion.id) ?? [];
    const curated = curateVirtualGirlfriendImages(images);
    const status = resolveCompanionImageState({ companion, images, visualProfile: null });
    return { companion, image: curated.canonical, status };
  });

  return <VirtualGirlfriendRosterHub items={cards} activeCompanionId={activeCompanion?.id ?? null} entitlements={entitlements} />;
}
