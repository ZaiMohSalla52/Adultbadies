import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { getConversation, getMatchList, sendConversationMessage } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { ConversationSafetyActions } from '@/components/matches/conversation-safety-actions';
import { MatchesListPanel } from '@/components/matches/matches-list-panel';
import { MessageComposer } from './message-composer';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export default async function MatchConversationPage({ params }: { params: Promise<{ matchId: string }> }) {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const { matchId } = await params;
  const [conversation, matches] = await Promise.all([
    getConversation(auth.accessToken, auth.user.id, matchId),
    getMatchList(auth.accessToken, auth.user.id),
  ]);

  if (!conversation) {
    notFound();
  }

  const sendMessageAction = async (_state: { error: string | null }, formData: FormData) => {
    'use server';

    const actionAuth = await getAuthenticatedUser();

    if (!actionAuth.user || !actionAuth.accessToken) {
      return { error: 'You must be signed in to send messages.' };
    }

    const message = String(formData.get('body') ?? '');

    try {
      await sendConversationMessage(actionAuth.accessToken, actionAuth.user.id, matchId, message);
      revalidatePath('/matches');
      revalidatePath(`/matches/${matchId}`);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to send message.' };
    }
  };

  return (
    <div className="app-page-stack chat-layout-shell">
      <MatchesListPanel matches={matches} activeMatchId={matchId} />

      <section className="chat-conversation-panel">
        <Card className="chat-conversation-header">
          <div className="chat-title-wrap">
            <Avatar
              name={conversation.otherUser.display_name ?? 'Unnamed user'}
              imageUrl={conversation.otherUser.avatar_url}
              size="lg"
              ring
              isActive
            />
            <div>
              <p className="chat-label">Conversation</p>
              <h1 className="my-0">{conversation.otherUser.display_name ?? 'Unnamed user'}</h1>
              <p className="my-0 text-sm text-muted">Private and encrypted conversation thread.</p>
            </div>
          </div>
          <Link className="ui-button ui-button-ghost chat-mobile-back" href="/matches">
            Back
          </Link>
        </Card>

        <Card className="chat-messages-panel">
          {conversation.messages.length === 0 ? (
            <div className="chat-thread-empty">
              <p className="my-0">No messages yet.</p>
              <p className="my-0 text-sm text-muted">Say hello and kick off the conversation.</p>
            </div>
          ) : (
            <div className="chat-thread">
              {conversation.messages.map((message) => {
                const isOwn = message.sender_id === auth.user.id;

                return (
                  <div key={message.id} className={`chat-bubble-row ${isOwn ? 'chat-bubble-row-own' : ''}`}>
                    <div className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}>
                      <p className="my-0">{message.body}</p>
                      <p className="my-0 chat-bubble-meta">
                        {isOwn ? 'You' : conversation.otherUser.display_name ?? 'Match'} · {formatDateTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <MessageComposer sendMessageAction={sendMessageAction} />
        </Card>

        <Card>
          <ConversationSafetyActions otherUserId={conversation.otherUser.id} matchId={conversation.match.id} />
        </Card>
      </section>
    </div>
  );
}
