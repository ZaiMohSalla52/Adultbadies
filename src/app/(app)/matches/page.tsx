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
          <p className="chat-label">Messages</p>
          <h2 className="my-0">Select a match to start chatting.</h2>
          <p className="my-0 text-muted">On desktop, your matches stay visible here while conversations open. On mobile, tap any match to open a full chat view.</p>
        </Card>
      </section>
    </div>
  );
}
