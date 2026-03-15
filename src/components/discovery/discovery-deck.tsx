'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/safety/types';
import type { Entitlements } from '@/lib/subscriptions/types';
import type { DiscoveryCandidate } from '@/lib/discovery/types';

type DiscoveryDeckProps = {
  initialCandidates: DiscoveryCandidate[];
  entitlements: Entitlements;
  swipesToday: number;
};

export const DiscoveryDeck = ({ initialCandidates, entitlements, swipesToday }: DiscoveryDeckProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDetails, setReportDetails] = useState('');

  const currentCandidate = useMemo(() => candidates[0] ?? null, [candidates]);

  const removeCurrentCandidate = () => {
    setCandidates((prev) => prev.slice(1));
    setReportDetails('');
  };

  const swipe = (direction: 'like' | 'dislike', source: 'like' | 'pass' | 'super' = 'like') => {
    if (!currentCandidate || isPending) return;

    const target = currentCandidate;
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/discovery/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: target.userId, direction }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          setFeedback('You reached your free daily swipe limit. Upgrade to Premium for unlimited swipes.');
          return;
        }

        setFeedback('Could not save swipe. Please try again.');
        return;
      }

      const payload = (await response.json()) as { matched?: boolean };
      removeCurrentCandidate();

      if (payload.matched) {
        setFeedback(`It\'s a match with ${target.displayName}!`);
      } else if (source === 'super') {
        setFeedback(`Super Like sent to ${target.displayName}.`);
      } else if (source === 'pass') {
        setFeedback(`Passed on ${target.displayName}.`);
      }

      router.refresh();
    });
  };

  const blockCurrentUser = () => {
    if (!currentCandidate || isPending) return;

    const target = currentCandidate;
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: target.userId, reason: 'blocked_from_discovery' }),
      });

      if (!response.ok) {
        setFeedback('Could not block this user. Please try again.');
        return;
      }

      removeCurrentCandidate();
      setFeedback(`${target.displayName} has been blocked.`);
      router.refresh();
    });
  };

  const reportCurrentUser = () => {
    if (!currentCandidate || isPending) return;

    const target = currentCandidate;
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: target.userId,
          category: reportCategory,
          details: reportDetails,
        }),
      });

      if (!response.ok) {
        setFeedback('Could not submit report. Please try again.');
        return;
      }

      setFeedback('Thanks. Your report has been submitted.');
      setReportDetails('');
      router.refresh();
    });
  };

  return (
    <div className="app-page-stack encounters-screen">
      <div className="encounters-mobile-top">
        <Card className="app-page-header encounters-header-card">
          <div className="encounters-header-row">
            <div>
              <p className="chat-label">Discovery</p>
              <h1 className="my-0">Encounters</h1>
            </div>
            <p className="encounters-status-pill encounters-status-pill-count">
              {swipesToday}
              {entitlements.limits.swipesPerDay !== null ? `/${entitlements.limits.swipesPerDay}` : ''}
            </p>
          </div>
          <p className="my-0 text-muted">Discover people nearby and decide in seconds.</p>
          <p className="encounters-status-pill">{entitlements.isPremium ? 'Premium mode · unlimited swipes' : 'Free mode · daily limit active'}</p>
        </Card>
      </div>

      <div className="encounters-desktop-layout">
        <div className="encounters-main">
          {!currentCandidate ? (
            <Card className="encounters-empty-state">
              <h2 style={{ marginTop: 0 }}>No more candidates right now</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>You are caught up for now. Check back later.</p>
            </Card>
          ) : (
            <Card className="discovery-card-enter encounters-card">
              <div className="encounters-image-wrap">
                {currentCandidate.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentCandidate.photoUrl} alt={currentCandidate.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No photo uploaded
                  </div>
                )}
                <div className="encounters-overlay">
                  <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
                    {currentCandidate.displayName}
                    {currentCandidate.age ? `, ${currentCandidate.age}` : ''}
                  </h2>
                  <span className="encounters-intent-tag">Here to date</span>
                  <p style={{ margin: '0.15rem 0', color: 'var(--text-muted)' }}>{currentCandidate.location}</p>
                  {currentCandidate.bio ? <p style={{ margin: 0, fontSize: '0.92rem' }}>{currentCandidate.bio}</p> : null}
                </div>
              </div>
            </Card>
          )}

          <div className="encounters-action-row">
            <Button type="button" variant="secondary" className="encounters-action-button" disabled={isPending || !currentCandidate} onClick={() => swipe('dislike', 'pass')}>
              ✕
            </Button>
            <Button type="button" className="encounters-action-button encounters-action-super" disabled={isPending || !currentCandidate} onClick={() => swipe('like', 'super')}>
              🔥
            </Button>
            <Button type="button" className="encounters-action-button" disabled={isPending || !currentCandidate} onClick={() => swipe('like', 'like')}>
              ❤
            </Button>
          </div>

          {feedback ? <p className="encounters-feedback">{feedback}</p> : null}
        </div>

        <aside className="encounters-safety-panel">
          <Card className="app-surface-card encounters-safety-card">
            <div className="encounters-safety-header">
              <p style={{ margin: 0, fontWeight: 600 }}>Safety tools</p>
              {!entitlements.isPremium ? (
                <Link href="/premium" className="text-brand" style={{ fontSize: '0.84rem' }}>
                  Upgrade to Premium
                </Link>
              ) : null}
            </div>
            <div className="encounters-safety-actions">
              <Button type="button" variant="ghost" disabled={isPending || !currentCandidate} onClick={blockCurrentUser}>Block</Button>
              <Button type="button" variant="secondary" disabled={isPending || !currentCandidate} onClick={reportCurrentUser}>Report</Button>
            </div>
            <select
              className="ui-select"
              value={reportCategory}
              onChange={(event) => setReportCategory(event.target.value as ReportCategory)}
              disabled={isPending}
            >
              {REPORT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.replace('_', ' ')}
                </option>
              ))}
            </select>
            <Textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              maxLength={1000}
              placeholder="Optional details"
              disabled={isPending}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
};
