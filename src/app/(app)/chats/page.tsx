import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { getHumanChatThreads } from '@/lib/matches/data';
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

  const humanThreads = await getHumanChatThreads(auth.accessToken, auth.user.id);
  const companions = await listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id);

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
    });
  }

  const threads = [...humanThreads, ...virtualThreads].sort((a, b) => (a.lastActivityAt > b.lastActivityAt ? -1 : 1));

  return (
    <div className="chats-page">
      <div className="chats-header">
        <h1 className="my-0">Chats</h1>
        <p className="my-0 text-muted text-sm">
          {threads.length > 0
            ? `${threads.length} active conversation${threads.length !== 1 ? 's' : ''}`
            : 'No conversations yet'}
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="chats-empty">
          <p className="my-0">No chats yet.</p>
          <p className="my-0 text-sm text-muted">
            Start a match conversation or chat with your Virtual Girlfriend to see threads here.
          </p>
        </div>
      ) : (
        <div className="chats-list">
          {threads.map((thread) => (
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
                  <span className="chats-item-time">{formatDate(thread.lastActivityAt)}</span>
                </div>
                <div className="chats-item-bottom">
                  <span className="chats-item-preview">{thread.preview ?? 'No messages yet.'}</span>
                  {thread.kind === 'virtual_girlfriend' && <span className="chat-thread-pill">AI</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
