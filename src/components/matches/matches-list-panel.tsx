import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { MatchListItem } from '@/lib/matches/types';

type MatchesListPanelProps = {
  matches: MatchListItem[];
  activeMatchId?: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export const MatchesListPanel = ({ matches, activeMatchId }: MatchesListPanelProps) => {
  return (
    <aside className="matches-list-panel">
      <Card className="matches-list-shell">
        <div className="matches-list-header">
          <h1 className="my-0">Messages</h1>
          <p className="my-0 text-sm text-muted">Active matches and recent conversation momentum.</p>
        </div>

        {matches.length === 0 ? (
          <div className="matches-empty-state">
            <p className="my-0">No matches yet.</p>
            <p className="my-0 text-sm text-muted">Keep swiping in discovery to start conversations.</p>
            <Link className="text-brand text-sm" href="/discovery">
              Go to discovery
            </Link>
          </div>
        ) : (
          <div className="matches-list-items" role="list" aria-label="Matches">
            {matches.map((match) => {
              const isActive = match.matchId === activeMatchId;

              return (
                <Link
                  key={match.matchId}
                  href={`/matches/${match.matchId}`}
                  className={`matches-list-item ${isActive ? 'matches-list-item-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  role="listitem"
                >
                  <div className="matches-list-item-top">
                    <p className="my-0 matches-list-name">{match.otherUserName}</p>
                    <span className="matches-list-time">{formatDate(match.lastMessageAt)}</span>
                  </div>
                  <p className="my-0 matches-list-preview">{match.lastMessageBody || 'No messages yet — say hello.'}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </aside>
  );
};
