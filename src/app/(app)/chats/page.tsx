import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getHumanChatThreads } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getActiveVirtualGirlfriend,
  getLatestVirtualGirlfriendConversation,
  getVirtualGirlfriendMessages,
} from '@/lib/virtual-girlfriend/data';
import type { ChatThreadItem } from '@/lib/matches/types';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export default async function ChatsPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const humanThreads = await getHumanChatThreads(auth.accessToken, auth.user.id);
  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  let virtualThread: ChatThreadItem | null = null;

  if (companion?.setup_completed) {
    const conversation = await getLatestVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);

    if (conversation) {
      const messages = await getVirtualGirlfriendMessages(auth.accessToken, conversation.id);
      const latestMessage = messages.at(-1) ?? null;

      virtualThread = {
        id: conversation.id,
        href: '/virtual-girlfriend/chat',
        title: companion.name,
        kind: 'virtual_girlfriend',
        lastActivityAt: latestMessage?.created_at ?? conversation.last_message_at ?? conversation.updated_at,
        preview: latestMessage?.content ?? null,
      };
    }
  }

  const threads = [...humanThreads, ...(virtualThread ? [virtualThread] : [])].sort((a, b) =>
    a.lastActivityAt > b.lastActivityAt ? -1 : 1,
  );

  return (
    <div className="app-page-stack">
      <Card className="app-page-header">
        <p className="chat-label">Chats</p>
        <h1 className="my-0">Conversation history</h1>
        <p className="my-0 text-muted">All active conversation threads in one place, sorted by latest activity.</p>
      </Card>

      <Card className="matches-list-shell">
        {threads.length === 0 ? (
          <div className="matches-empty-state">
            <p className="my-0">No chat history yet.</p>
            <p className="my-0 text-sm text-muted">Start a match conversation or chat with your Virtual Girlfriend to see threads here.</p>
          </div>
        ) : (
          <div className="matches-list-items" role="list" aria-label="Chats">
            {threads.map((thread) => (
              <Link key={`${thread.kind}-${thread.id}`} href={thread.href} className="matches-list-item" role="listitem">
                <div className="matches-list-item-top">
                  <p className="my-0 matches-list-name">
                    {thread.title}
                    {thread.kind === 'virtual_girlfriend' ? <span className="chat-thread-pill">Virtual Girlfriend</span> : null}
                  </p>
                  <span className="matches-list-time">{formatDate(thread.lastActivityAt)}</span>
                </div>
                <p className="my-0 matches-list-preview">{thread.preview ?? 'No messages yet.'}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
