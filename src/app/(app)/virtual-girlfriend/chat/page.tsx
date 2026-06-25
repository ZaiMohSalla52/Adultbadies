import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendConversation,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionById,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionImages,
  getVirtualGirlfriendMessages,
  getVirtualGirlfriendUserMessageCountForToday,
} from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendChatClient } from '@/components/virtual-girlfriend/chat-client';
import { processDueVirtualGirlfriendProactiveEvents } from '@/lib/virtual-girlfriend/proactive';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import { claimPointStipend, getPointBalance, getUnlockedImageIds } from '@/lib/points/data';
import { POINTS } from '@/lib/points/constants';

export const dynamic = 'force-dynamic';

const resolvePortraitPreviewUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export default async function VirtualGirlfriendChatPage({
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

  // Fire-and-forget — do not block page render
  void processDueVirtualGirlfriendProactiveEvents({
    token: auth.accessToken,
    userId: auth.user.id,
    companion,
  });

  const [conversation, entitlements, usedToday, styleProfile, companionImages, visualProfile] = await Promise.all([
    getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
    getVirtualGirlfriendUserMessageCountForToday(auth.accessToken, auth.user.id),
    getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id),
  ]);

  const messages = await getVirtualGirlfriendMessages(auth.accessToken, conversation.id);
  const curated = curateVirtualGirlfriendImages(companionImages, {
    lockedCanonicalImageId: visualProfile?.canonical_reference_image_id ?? null,
  });

  if (entitlements.isPremium) {
    await claimPointStipend(auth.accessToken);
  }
  const [pointBalance, unlockedImageIds] = await Promise.all([
    getPointBalance(auth.accessToken, auth.user.id),
    getUnlockedImageIds(auth.accessToken, auth.user.id, companion.id),
  ]);

  const portraitPreviewUrl = resolvePortraitPreviewUrl(companion.structured_profile?.selectedPortraitImage);
  const canonicalUrl = curated.canonical?.delivery_url ?? null;

  return (
    <div className="chat-page-frame">
    <VirtualGirlfriendChatClient
      companionId={companion.id}
      companionName={companion.name}
      companionAvatarUrl={canonicalUrl}
      portraitBackdropUrl={canonicalUrl ?? portraitPreviewUrl}
      portraitPreviewUrl={portraitPreviewUrl}
      initialMessages={messages}
      entitlements={entitlements}
      usedToday={usedToday}
      initialStyleProfile={styleProfile}
      isPremium={entitlements.isPremium}
      companionGenerationStatus={companion.generation_status}
      companionBio={companion.display_bio ?? companion.archetype ?? null}
      occupation={companion.structured_profile?.occupation ?? null}
      personality={companion.structured_profile?.personality ?? null}
      sexuality={companion.structured_profile?.sexuality ?? null}
      companionSex={companion.structured_profile?.sex ?? null}
      galleryImages={curated.gallery.map((image) => ({ id: image.id, url: image.delivery_url }))}
      unlockedImageIds={unlockedImageIds}
      pointBalance={pointBalance}
      unblurCost={POINTS.unblurCost}
    />
    </div>
  );
}
