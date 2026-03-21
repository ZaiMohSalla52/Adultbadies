import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { getHumanChatThreads, getIncomingLikesCount } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getLatestVirtualGirlfriendConversation,
  getVirtualGirlfriendCompanionImages,
  getVirtualGirlfriendMessages,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import type { ChatThreadItem } from '@/lib/matches/types';

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  if (diffDays < 7) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export default async function ChatsPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [humanThreads, companions, incomingLikesCount] = await Promise.all([
    getHumanChatThreads(auth.accessToken, auth.user.id),
    listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id),
    getIncomingLikesCount(auth.accessToken, auth.user.id),
  ]);

  const virtualThreads: ChatThreadItem[] = [];

  for (const companion of companions) {
    if (!companion.setup_completed) continue;

    const conversation = await getLatestVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);
    if (!conversation) continue;

    const [messages, companionImages] = await Promise.all([
      getVirtualGirlfriendMessages(auth.accessToken, conversation.id),
      getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
    ]);

    const curated = curateVirtualGirlfriendImages(companionImages);
    const latestMessage = messages.at(-1) ?? null;

    virtualThreads.push({
      id: conversation.id,
      href: `/virtual-girlfriend/chat?companionId=${companion.id}`,
      title: companion.name,
      kind: 'virtual_girlfriend',
      lastActivityAt: latestMessage?.created_at ?? conversation.last_message_at ?? conversation.updated_at,
      preview: latestMessage?.content ?? null,
      avatarUrl: curated.canonical?.delivery_url ?? null,
      lastMessageSenderId: latestMessage?.role === 'user' ? auth.user.id : null,
      isNew: !latestMessage,
    });
  }

  const allThreads = [...humanThreads, ...virtualThreads].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  // Split into new matches (no messages) and active conversations (has messages)
  const newMatches = allThreads.filter((t) => t.isNew);
  const conversations = allThreads.filter((t) => !t.isNew);

  return (
    <div className="chats-page">
      <div className="chats-header">
        <h1 className="my-0">Chats</h1>
      </div>

      {/* ── New matches row ── */}
      {(newMatches.length > 0 || incomingLikesCount > 0) && (
        <div className="chats-new-matches-section">
          {newMatches.length > 0 && (
            <p className="chats-new-matches-label">
              {newMatches.length} new match{newMatches.length !== 1 ? 'es' : ''}
            </p>
          )}
          <div className="chats-matches-row">
            {/* Incoming likes bubble */}
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

            {/* New match bubbles (no messages yet) */}
            {newMatches.map((thread) => (
              <Link key={`${thread.kind}-${thread.id}`} href={thread.href} className="chats-match-bubble">
                <div className="chats-match-bubble-avatar">
                  {thread.avatarUrl ? (
                    <Image
                      src={thread.avatarUrl}
                      alt={thread.title}
                      fill
                      className="chats-match-bubble-img"
                      unoptimized
                    />
                  ) : (
                    <div className="chats-match-bubble-fallback">
                      {thread.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="chats-match-bubble-name">{thread.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Most recent conversations ── */}
      {conversations.length > 0 && (
        <>
          <div className="chats-section-header">
            <span className="chats-section-title">Most recent</span>
            <span className="chats-section-filter">⊞</span>
          </div>

          <div className="chats-list">
            {conversations.map((thread) => {
              const yourMove =
                thread.lastMessageSenderId !== null &&
                thread.lastMessageSenderId !== auth.user!.id;

              return (
                <Link key={`${thread.kind}-${thread.id}`} href={thread.href} className="chats-item">
                  <Avatar
                    name={thread.title}
                    imageUrl={thread.avatarUrl}
                    kind={thread.kind === 'virtual_girlfriend' ? 'ai' : 'human'}
                    size="lg"
                    ring
                    isActive={thread.kind === 'virtual_girlfriend'}
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
          </div>
        </>
      )}

      {allThreads.length === 0 && incomingLikesCount === 0 && (
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
