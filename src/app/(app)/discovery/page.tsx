import { redirect } from 'next/navigation';
import { ExploreLibrary } from '@/components/discovery/explore-library';
import type { CompanionGridCard } from '@/components/virtual-girlfriend/companion-grid';
import { getDiscoverableVirtualGirlfriends } from '@/lib/discovery/data';
import type { ExploreTab } from '@/lib/discovery/types';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getVirtualGirlfriendCompanionThumbnailBatch,
  listVirtualGirlfriendCompanionsForGrid,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import { resolveCompanionImageState } from '@/lib/virtual-girlfriend/generation-state';

const CHAT_READY = ['ready', 'partial_success'] as const;

const parseTab = (value: string | string[] | undefined): ExploreTab => {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  if (raw === 'boyfriends' || raw === 'boyfriend') return 'boyfriends';
  if (raw === 'anime') return 'anime';
  if (raw === 'my' || raw === 'my-characters' || raw === 'mine') return 'my';
  return 'girlfriends';
};

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!snapshot.profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  const params = await searchParams;
  const initialTab = parseTab(params.tab);

  const [discoverable, companions] = await Promise.all([
    getDiscoverableVirtualGirlfriends(auth.accessToken, auth.user.id),
    listVirtualGirlfriendCompanionsForGrid(auth.accessToken, auth.user.id),
  ]);

  const girlfriends = discoverable.filter((c) => c.gender !== 'male');
  const boyfriends = discoverable.filter((c) => c.gender === 'male');
  const anime = discoverable.filter((c) => (c.styleVibe ?? '').toLowerCase().includes('anime'));

  const uniqueCompanions = Array.from(new Map(companions.map((c) => [c.id, c])).values());
  const activeId = companions.find((c) => c.is_active)?.id ?? null;
  const imageMap = await getVirtualGirlfriendCompanionThumbnailBatch(
    auth.accessToken,
    auth.user.id,
    uniqueCompanions.map((c) => c.id),
  );

  const myCharacters: CompanionGridCard[] = uniqueCompanions.map((companion) => {
    const images = imageMap.get(companion.id) ?? [];
    const { canonical } = curateVirtualGirlfriendImages(images);
    const status = resolveCompanionImageState({ companion, images, visualProfile: null });
    const chatReady = (CHAT_READY as readonly string[]).includes(status);
    return {
      companion,
      imageUrl: canonical?.delivery_url ?? null,
      status,
      isActive: companion.id === activeId,
      chatReady,
      href: chatReady
        ? `/virtual-girlfriend/chat?companionId=${companion.id}`
        : `/virtual-girlfriend/profile?companionId=${companion.id}`,
    };
  });

  return (
    <ExploreLibrary
      initialTab={initialTab}
      girlfriends={girlfriends}
      boyfriends={boyfriends}
      anime={anime}
      myCharacters={myCharacters}
    />
  );
}