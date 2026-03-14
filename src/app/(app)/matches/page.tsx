import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getMatchList } from '@/lib/matches/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export default async function MatchesPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const matches = await getMatchList(auth.accessToken, auth.user.id);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <h1 style={{ margin: 0 }}>Messages</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>Your active matches and recent conversations.</p>
      </Card>

      {matches.length === 0 ? (
        <Card>
          <p style={{ marginTop: 0 }}>No matches yet.</p>
          <p style={{ color: 'var(--text-muted)' }}>Keep swiping in discovery to start conversations.</p>
          <Link className="text-brand" href="/discovery">Go to discovery</Link>
        </Card>
      ) : (
        matches.map((match) => (
          <Card key={match.matchId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{match.otherUserName}</p>
                <p style={{ margin: '0.3rem 0', color: 'var(--text-muted)' }}>{match.lastMessageBody || 'No messages yet'}</p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatDate(match.lastMessageAt)}</p>
              </div>
              <Link className="ui-button ui-button-secondary" href={`/matches/${match.matchId}`}>Open</Link>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
