import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { CompanionChatRows } from '@/components/chats/companion-chat-rows';
import type { VGThreadItem } from '@/components/chats/companion-chat-rows';
import { getHumanChatThreads } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getLatestVirtualGirlfriendConversationBatch,
  getLatestVirtualGirlfriendMessage,
  getVirtualGirlfriendCompanionThumbnailBatch,
  listVirtualGirlfriendCompanionsForGrid,
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

  const [humanThreads, companions] = await Promise.all([
    getHumanChatThreads(token, userId),
    listVirtualGirlfriendCompanionsForGrid(token, userId),
  ]);

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

  const humanNewChats = humanThreads.filter((t) => t.isNew);
  const vgNewChats = vgThreads.filter((t) => t.isNew);
  const humanConversations = humanThreads.filter((t) => !t.isNew);
  const vgConversations = vgThreads.filter((t) => !t.isNew);

  const sortedHumanConversations = [...humanConversations].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  const sortedVgConversations = [...vgConversations].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  const hasNewChats = humanNewChats.length > 0 || vgNewChats.length > 0;
  const hasConversations = sortedHumanConversations.length > 0 || sortedVgConversations.length > 0;
  const isEmpty = !hasNewChats && !hasConversations;

  return (
    <div className="chats-page">
      <div className="chats-frame">
        <div className="chats-header">
          <h1 className="my-0">Chats</h1>
          <p className="chats-header-sub">Your conversations with AI companions.</p>
        </div>

        {hasNewChats && (
          <div className="chats-new-matches-section">
            <p className="chats-new-matches-label">New</p>
            <div className="chats-matches-row">
              {humanNewChats.map((thread) => (
                <Link key={thread.id} href={thread.href} className="chats-match-bubble">
                  <div className="chats-match-bubble-avatar">
                    {thread.avatarUrl ? (
                      <Image src={thread.avatarUrl} alt={thread.title} fill sizes="58px" className="chats-match-bubble-img" />
                    ) : (
                      <div className="chats-match-bubble-fallback">{thread.title.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <span className="chats-match-bubble-name">{thread.title}</span>
                </Link>
              ))}

              {vgNewChats.map((thread) => (
                <Link key={thread.id} href={thread.href} className="chats-match-bubble">
                  <div className="chats-match-bubble-avatar">
                    {thread.avatarUrl ? (
                      <Image src={thread.avatarUrl} alt={thread.name} fill sizes="58px" className="chats-match-bubble-img" />
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

        {hasConversations && (
          <>
            <div className="chats-section-header">
              <span className="chats-section-title">Most recent</span>
            </div>

            <div className="chats-list">
              <CompanionChatRows items={sortedVgConversations} />

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
            </div>
          </>
        )}

        {isEmpty && (
          <div className="chats-empty">
            <p className="my-0">No chats yet.</p>
            <p className="my-0 text-sm text-muted">
              Browse the library and start a conversation with an AI companion.
            </p>
            <Link href="/discovery" className="ui-button ui-button-primary" style={{ marginTop: '1rem' }}>
              Explore companions
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}