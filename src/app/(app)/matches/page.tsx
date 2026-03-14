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
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="my-0 text-lg font-semibold">Matches</h1>
        <p className="text-sm text-muted">Your active matches and latest message activity.</p>
      </Card>

      {matches.length === 0 ? (
        <Card>
          <p className="my-0">No matches yet.</p>
          <p className="text-sm text-muted">Keep swiping in discovery to start conversations.</p>
          <Link className="text-sm" href="/discovery">
            Go to discovery
          </Link>
        </Card>
      ) : (
        matches.map((match) => (
          <Card key={match.matchId}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="my-0 font-semibold">{match.otherUserName}</p>
                <p className="my-0 text-sm text-muted">
                  {match.lastMessageBody ? match.lastMessageBody : 'No messages yet'}
                </p>
                <p className="my-0 text-sm text-muted">{formatDate(match.lastMessageAt)}</p>
              </div>
              <Link className="text-sm" href={`/matches/${match.matchId}`}>
                Open chat
              </Link>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
