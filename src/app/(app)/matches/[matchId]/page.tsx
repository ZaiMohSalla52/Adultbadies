import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Card } from '@/components/ui/card';
import { getConversation, sendConversationMessage } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
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
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="my-0 text-lg font-semibold">Chat with {conversation.otherUser.full_name ?? 'Unnamed user'}</h1>
            <p className="my-0 text-sm text-muted">Messages are visible only to conversation participants.</p>
          </div>
          <Link className="text-sm" href="/matches">
            Back to matches
          </Link>
        </div>
      </Card>

      <Card>
        {conversation.messages.length === 0 ? (
          <p className="my-0 text-sm text-muted">No messages yet. Say hello to start the conversation.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {conversation.messages.map((message) => {
              const isOwn = message.sender_id === auth.user.id;

              return (
                <div
                  key={message.id}
                  className="rounded-md border border-border px-3 py-3"
                  style={{ background: isOwn ? 'var(--surface-3)' : 'var(--surface-2)' }}
                >
                  <p className="my-0 text-sm">{message.body}</p>
                  <p className="my-0 text-sm text-muted">{isOwn ? 'You' : conversation.otherUser.full_name ?? 'Match'} · {formatDateTime(message.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <MessageComposer sendMessageAction={sendMessageAction} />
      </Card>
    </div>
  );
}
