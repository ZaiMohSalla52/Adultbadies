import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CompanionGrid } from '@/components/virtual-girlfriend/companion-grid';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getVirtualGirlfriendCompanionThumbnailBatch,
  listVirtualGirlfriendCompanionsForGrid,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import { resolveCompanionImageState } from '@/lib/virtual-girlfriend/generation-state';

const CHAT_READY = ['ready', 'partial_success'] as const;

export default async function AIGirlfriendPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [companions, entitlements] = await Promise.all([
    listVirtualGirlfriendCompanionsForGrid(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
  ]);

  if (companions.length === 0) {
    redirect('/virtual-girlfriend/setup');
  }

  const uniqueCompanions = Array.from(
    new Map(companions.map((c) => [c.id, c])).values(),
  );
  const activeId = companions.find((c) => c.is_active)?.id ?? null;

  const imageMap = await getVirtualGirlfriendCompanionThumbnailBatch(
    auth.accessToken,
    auth.user.id,
    uniqueCompanions.map((c) => c.id),
  );

  const cards = uniqueCompanions.map((companion) => {
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
    <div className="app-page-stack">
      <div className="ai-gf-header">
        <div>
          <h1 className="my-0">AI Companions</h1>
          <p className="my-0 text-muted text-sm">
            Girlfriends & boyfriends · {uniqueCompanions.length} companion{uniqueCompanions.length !== 1 ? 's' : ''}
            {entitlements.isPremium ? ' · Premium' : ''}
          </p>
        </div>
        <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-primary">
          + Create New
        </Link>
      </div>

      <CompanionGrid cards={cards} />
    </div>
  );
}
