import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import type { MatchListItem } from '@/lib/matches/types';
import { UnmatchButton } from '@/components/matches/unmatch-button';

type MatchesListPanelProps = {
  matches: MatchListItem[];
  activeMatchId?: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

export const MatchesListPanel = ({ matches, activeMatchId }: MatchesListPanelProps) => {
  return (
    <aside className="matches-list-panel">
      <Card className="matches-list-shell">
        <div className="matches-list-header">
          <h1 className="my-0">Matches</h1>
          <p className="my-0 text-sm text-muted">People you matched with. Open chat or unmatch anytime.</p>
        </div>

        {matches.length === 0 ? (
          <div className="matches-empty-state">
            <p className="my-0">No matches yet.</p>
            <p className="my-0 text-sm text-muted">Keep swiping in discovery to connect with people.</p>
            <Link className="text-brand text-sm" href="/discovery">
              Go to discovery
            </Link>
          </div>
        ) : (
          <div className="matches-list-items" role="list" aria-label="Matches">
            {matches.map((match) => {
              const isActive = match.matchId === activeMatchId;

              return (
                <article key={match.matchId} className={`matches-list-item ${isActive ? 'matches-list-item-active' : ''}`} role="listitem">
                  <div className="matches-list-row">
                    <Avatar name={match.otherUserName} imageUrl={match.avatarUrl} size="lg" ring isActive={isActive} />
                    <div className="matches-list-main">
                  <div className="matches-list-item-top">
                    <p className="my-0 matches-list-name">{match.otherUserName}</p>
                    <span className="matches-list-time">Matched {formatDate(match.matchCreatedAt)}</span>
                  </div>
                  <div className="matches-list-actions">
                    <Link href={`/matches/${match.matchId}`} className="ui-button">
                      Open chat
                    </Link>
                    <UnmatchButton matchId={match.matchId} />
                  </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </aside>
  );
};
