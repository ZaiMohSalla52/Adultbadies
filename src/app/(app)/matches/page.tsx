import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { MatchesListPanel } from '@/components/matches/matches-list-panel';
import { getMatchList } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function MatchesPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const matches = await getMatchList(auth.accessToken, auth.user.id);

  return (
    <div className="app-page-stack chat-layout-shell">
      <MatchesListPanel matches={matches} />

      <section className="chat-conversation-panel">
        <Card className="chat-empty-intro">
          <p className="chat-label">Matches</p>
          <h2 className="my-0">Choose someone to open your conversation.</h2>
          <p className="my-0 text-muted">This space is focused on match management. Your full inbox lives in Chats.</p>
        </Card>
      </section>
    </div>
  );
}
