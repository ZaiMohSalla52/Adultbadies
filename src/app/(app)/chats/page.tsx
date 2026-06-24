import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { CompanionChatRows } from '@/components/chats/companion-chat-rows';
import type { VGThreadItem } from '@/components/chats/companion-chat-rows';
import { getHumanChatThreads, getIncomingLikesCount } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getLatestVirtualGirlfriendConversationBatch,
  getLatestVirtualGirlfriendMessage,
  getVirtualGirlfriendCompanionImagesBatch,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import type { ChatThreadItem } from '@/lib/matches/types';

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  if (diffDays < 7) return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export default async function ChatsPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const token = auth.accessToken!;
  const userId = auth.user!.id;

  const [humanThreads, companions, incomingLikesCount] = await Promise.all([
    getHumanChatThreads(token, userId),
    listVirtualGirlfriendCompanions(token, userId),
    getIncomingLikesCount(token, userId),
  ]);

  const setupCompanions = companions.filter((c) => c.setup_completed);
  const setupIds = setupCompanions.map((c) => c.id);

  const [conversationMap, imageMap] = await Promise.all([
    getLatestVirtualGirlfriendConversationBatch(token, userId, setupIds),
    getVirtualGirlfriendCompanionImagesBatch(token, userId, setupIds),
  ]);

  const companionsWithConversation = setupCompanions.filter((c) => conversationMap.has(c.id));
  const latestMessages = await Promise.all(
    companionsWithConversation.map((c) =>
      getLatestVirtualGirlfriendMessage(token, conversationMap.get(c.id)!.id),
    ),
  );

  // Build VG thread items (passed to client component for preview-on-click)
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

  const humanNewMatches = humanThreads.filter((t) => t.isNew);
  const vgNewMatches = vgThreads.filter((t) => t.isNew);
  const humanConversations = humanThreads.filter((t) => !t.isNew);
  const vgConversations = vgThreads.filter((t) => !t.isNew);

  // Sort human conversations by recency
  const sortedHumanConversations = [...humanConversations].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  const hasNewMatches = humanNewMatches.length > 0 || vgNewMatches.length > 0 || incomingLikesCount > 0;
  const hasConversations = sortedHumanConversations.length > 0 || vgConversations.length > 0;
  const isEmpty = !hasNewMatches && !hasConversations;

  return (
    <div className="chats-page chats-page--fullbleed">
      <div className="chats-header">
        <h1 className="my-0">Chats</h1>
      </div>

      {/* ── New matches row ── */}
      {hasNewMatches && (
        <div className="chats-new-matches-section">
          {(humanNewMatches.length + vgNewMatches.length) > 0 && (
            <p className="chats-new-matches-label">
              {humanNewMatches.length + vgNewMatches.length} new match
              {humanNewMatches.length + vgNewMatches.length !== 1 ? 'es' : ''}
            </p>
          )}
          <div className="chats-matches-row">
            {incomingLikesCount > 0 && (
              <Link href="/discovery" className="chats-match-bubble">
                <div className="chats-match-bubble-avatar chats-likes-bubble-avatar">
                  <div className="chats-likes-bubble-inner">
                    <span className="chats-likes-bubble-icon">♥</span>
                    <span className="chats-likes-bubble-count">{incomingLikesCount}</span>
                  </div>
                </div>
                <span className="chats-match-bubble-name">Likes</span>
              </Link>
            )}

            {humanNewMatches.map((thread) => (
              <Link key={thread.id} href={thread.href} className="chats-match-bubble">
                <div className="chats-match-bubble-avatar">
                  {thread.avatarUrl ? (
                    <Image src={thread.avatarUrl} alt={thread.title} fill className="chats-match-bubble-img" unoptimized />
                  ) : (
                    <div className="chats-match-bubble-fallback">{thread.title.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span className="chats-match-bubble-name">{thread.title}</span>
              </Link>
            ))}

            {vgNewMatches.map((thread) => (
              <Link key={thread.id} href={thread.href} className="chats-match-bubble">
                <div className="chats-match-bubble-avatar">
                  {thread.avatarUrl ? (
                    <Image src={thread.avatarUrl} alt={thread.name} fill className="chats-match-bubble-img" unoptimized />
                  ) : (
                    <div className="chats-match-bubble-fallback">{thread.name.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span className="chats-match-bubble-name">{thread.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Conversations ── */}
      {hasConversations && (
        <>
          <div className="chats-section-header">
            <span className="chats-section-title">Most recent</span>
          </div>

          <div className="chats-list">
            {/* Human threads — static server-rendered links */}
            {sortedHumanConversations.map((thread: ChatThreadItem) => {
              const yourMove = thread.lastMessageSenderId !== null && thread.lastMessageSenderId !== userId;
              return (
                <Link key={thread.id} href={thread.href} className="chats-item">
                  <Avatar
                    name={thread.title}
                    imageUrl={thread.avatarUrl}
                    kind="human"
                    size="lg"
                    ring
                  />
                  <div className="chats-item-body">
                    <div className="chats-item-top">
                      <span className="chats-item-name">{thread.title}</span>
                      {yourMove && <span className="chats-your-move-badge">YOUR MOVE</span>}
                      <span className="chats-item-time">{formatDate(thread.lastActivityAt)}</span>
                    </div>
                    <div className="chats-item-bottom">
                      <span className="chats-item-preview">{thread.preview ?? 'No messages yet.'}</span>
                      <span className="chats-item-star">☆</span>
                    </div>
                  </div>
                </Link>
              );
            })}

            <CompanionChatRows items={vgConversations} />
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="chats-empty">
          <p className="my-0">No chats yet.</p>
          <p className="my-0 text-sm text-muted">
            Start swiping to make matches and begin conversations.
          </p>
          <Link href="/discovery" className="ui-button ui-button-primary" style={{ marginTop: '1rem' }}>
            Go to Discovery
          </Link>
        </div>
      )}
    </div>
  );
}
