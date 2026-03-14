import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { getConversation, sendConversationMessage } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { ConversationSafetyActions } from '@/components/matches/conversation-safety-actions';
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
  const conversation = await getConversation(auth.accessToken, auth.user.id, matchId);

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
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>Chat with {conversation.otherUser.full_name ?? 'Unnamed user'}</h1>
            <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>Private and encrypted conversation thread.</p>
          </div>
          <Link className="ui-button ui-button-ghost" href="/matches">Back</Link>
        </div>
      </Card>

      <Card style={{ display: 'grid', gap: '0.6rem' }}>
        {conversation.messages.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No messages yet. Say hello to start the conversation.</p>
        ) : (
          conversation.messages.map((message) => {
            const isOwn = message.sender_id === auth.user.id;

            return (
              <div
                key={message.id}
                style={{
                  borderRadius: '16px',
                  padding: '0.7rem 0.85rem',
                  marginLeft: isOwn ? '1.2rem' : 0,
                  marginRight: isOwn ? 0 : '1.2rem',
                  background: isOwn ? 'linear-gradient(130deg, #8b5cf6, #ec4899)' : 'rgba(19,31,58,0.8)',
                }}
              >
                <p style={{ margin: 0 }}>{message.body}</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', opacity: 0.84 }}>
                  {isOwn ? 'You' : conversation.otherUser.full_name ?? 'Match'} · {formatDateTime(message.created_at)}
                </p>
              </div>
            );
          })
        )}
      </Card>

      <Card>
        <MessageComposer sendMessageAction={sendMessageAction} />
      </Card>

      <Card>
        <ConversationSafetyActions otherUserId={conversation.otherUser.id} matchId={conversation.match.id} />
      </Card>
    </div>
  );
}
