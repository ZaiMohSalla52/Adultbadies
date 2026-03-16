import { redirect } from 'next/navigation';
import { VirtualGirlfriendRosterHub } from '@/components/virtual-girlfriend/roster-hub';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
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

  const cards = await Promise.all(
    companions.map(async (companion) => {
      const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user!.id, companion.id);
      const primary = images.find((image) => image.image_kind === 'canonical') ?? images[0] ?? null;
      return { companion, image: primary };
    }),
  );

  return <VirtualGirlfriendRosterHub items={cards} activeCompanionId={activeCompanion?.id ?? null} entitlements={entitlements} />;
}
