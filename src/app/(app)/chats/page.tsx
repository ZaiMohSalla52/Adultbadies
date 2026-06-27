import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CompanionChatRows } from '@/components/chats/companion-chat-rows';
import type { VGThreadItem } from '@/components/chats/companion-chat-rows';
import { POINTS } from '@/lib/points/constants';
import { claimPointStipend, getPointBalance } from '@/lib/points/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getLatestVirtualGirlfriendConversationBatch,
  getLatestVirtualGirlfriendMessage,
  getVirtualGirlfriendCompanionThumbnailBatch,
  listVirtualGirlfriendCompanionsForGrid,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';

export default async function ChatsPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const token = auth.accessToken!;
  const userId = auth.user!.id;

  const [entitlements, companions] = await Promise.all([
    getUserEntitlements(token, userId),
    listVirtualGirlfriendCompanionsForGrid(token, userId),
  ]);

  if (entitlements.isPremium) {
    await claimPointStipend(token);
  }
  const pointBalance = await getPointBalance(token, userId);

  const setupCompanions = companions.filter((c) => c.setup_completed);
  const setupIds = setupCompanions.map((c) => c.id);

  const [conversationMap, imageMap] = await Promise.all([
    getLatestVirtualGirlfriendConversationBatch(token, userId, setupIds),
    getVirtualGirlfriendCompanionThumbnailBatch(token, userId, setupIds),
  ]);

  const companionsWithConversation = setupCompanions.filter((c) => conversationMap.has(c.id));
  const latestMessages = await Promise.all(
    companionsWithConversation.map((c) =>
      getLatestVirtualGirlfriendMessage(token, conversationMap.get(c.id)!.id),
    ),
  );

  const vgThreads: VGThreadItem[] = companionsWithConversation.map((companion, i) => {
    const conversation = conversationMap.get(companion.id)!;
    const latestMessage = latestMessages[i];
    const images = imageMap.get(companion.id) ?? [];
    const { canonical } = curateVirtualGirlfriendImages(images);
    return {
      id: conversation.id,
      companionId: companion.id,
      name: companion.name,
      bio: companion.display_bio || companion.archetype || '',
      avatarUrl: canonical?.delivery_url ?? null,
      href: `/virtual-girlfriend/chat?companionId=${companion.id}`,
      preview: latestMessage?.content ?? null,
      lastActivityAt: latestMessage?.created_at ?? conversation.last_message_at ?? conversation.updated_at,
      lastMessageSenderId: latestMessage?.role === 'user' ? userId : null,
      userId,
      isNew: !latestMessage,
    };
  });

  const sortedThreads = [...vgThreads].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  const isEmpty = sortedThreads.length === 0;

  return (
    <div className="chats-page">
      <div className="chats-frame">
        <div className="chats-premium-banner">
          <div className="chats-premium-copy">
            <p className="chats-premium-title">
              {entitlements.isPremium ? (
                <>Your <span>Premium</span> points</>
              ) : (
                <>Earn more with <span>Premium</span></>
              )}
            </p>
            <ul className="chats-premium-list">
              <li>💜 {POINTS.messageCost} point per message</li>
              <li>🔓 Unblur photos for {POINTS.unblurCost} points each</li>
              <li>👑 Premium: {POINTS.premiumMonthlyStipend} points/month</li>
            </ul>
            <p className="chats-premium-balance">Your balance: {pointBalance} points</p>
          </div>
          {!entitlements.isPremium ? (
            <Link href="/premium" className="chats-premium-cta">
              Join Premium
            </Link>
          ) : null}
        </div>

        <div className="chats-header">
          <h1 className="my-0">AI Adult Chat</h1>
          <p className="chats-header-sub">Your companion conversations.</p>
        </div>

        {isEmpty ? (
          <div className="chats-empty">
            <p className="my-0">No chats yet.</p>
            <p className="my-0 text-sm text-muted">
              Browse the library and start a conversation with an AI companion.
            </p>
            <Link href="/discovery" className="ui-button ui-button-primary" style={{ marginTop: '1rem' }}>
              Explore companions
            </Link>
          </div>
        ) : (
          <div className="chats-list">
            <CompanionChatRows items={sortedThreads} />
          </div>
        )}
      </div>
    </div>
  );
}