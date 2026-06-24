import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getVirtualGirlfriendCompanionImagesBatch,
  listVirtualGirlfriendCompanions,
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
    listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
  ]);

  if (companions.length === 0) {
    redirect('/virtual-girlfriend/setup');
  }

  const uniqueCompanions = Array.from(
    new Map(companions.map((c) => [c.id, c])).values(),
  );
  const activeId = companions.find((c) => c.is_active)?.id ?? null;

  const imageMap = await getVirtualGirlfriendCompanionImagesBatch(
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
          <h1 className="my-0">AI Girlfriend</h1>
          <p className="my-0 text-muted text-sm">
            {uniqueCompanions.length} companion{uniqueCompanions.length !== 1 ? 's' : ''}
            {entitlements.isPremium ? ' · Premium' : ''}
          </p>
        </div>
        <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-primary">
          + Create New
        </Link>
      </div>

      <div className="ai-gf-grid">
        {cards.map(({ companion, imageUrl, status, isActive, chatReady, href }) => (
          <Link key={companion.id} href={href} className="ai-gf-card">
            <div className="ai-gf-card-img">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={companion.name}
                  fill
                  unoptimized
                  className="ai-gf-card-photo"
                />
              ) : (
                <div className="ai-gf-card-fallback">
                  {companion.name.charAt(0).toUpperCase()}
                </div>
              )}
              {isActive && <span className="ai-gf-badge ai-gf-badge--active">Active</span>}
              {(status === 'generating' || status === 'review_pending') && (
                <span className="ai-gf-badge ai-gf-badge--generating">Generating…</span>
              )}
              {status === 'failed' && (
                <span className="ai-gf-badge ai-gf-badge--failed">Needs setup</span>
              )}
            </div>
            <div className="ai-gf-card-body">
              <strong className="ai-gf-card-name">{companion.name}</strong>
              <p className="ai-gf-card-bio">
                {companion.display_bio || companion.archetype || 'AI Companion'}
              </p>
              <span className="ai-gf-card-cta">
                {chatReady ? 'Chat Now →' : 'View Profile →'}
              </span>
            </div>
          </Link>
        ))}

        <Link href="/virtual-girlfriend/setup?new=1" className="ai-gf-create">
          <span className="ai-gf-create-icon">✨</span>
          <span className="ai-gf-create-label">Create New</span>
          <span className="ai-gf-create-sub">AI Companion</span>
        </Link>
      </div>
    </div>
  );
}
