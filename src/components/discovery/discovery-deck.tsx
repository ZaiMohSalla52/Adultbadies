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

  const swipe = (direction: 'like' | 'dislike') => {
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

  if (!currentCandidate) {
    return (
      <Card style={{ textAlign: 'center', padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>No more candidates right now</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>You are caught up for now. Check back later.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Card style={{ padding: '0.9rem 1rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {entitlements.isPremium ? 'Premium mode · unlimited swipes' : 'Free mode · daily limit active'}
        </p>
        <p style={{ margin: '0.35rem 0 0', fontWeight: 600 }}>
          Swipes today: {swipesToday}
          {entitlements.limits.swipesPerDay !== null ? ` / ${entitlements.limits.swipesPerDay}` : ''}
        </p>
        {!entitlements.isPremium ? (
          <Link href="/premium" className="text-brand" style={{ fontSize: '0.84rem' }}>
            Upgrade to Premium
          </Link>
        ) : null}
      </Card>

      <Card className="discovery-card-enter" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ aspectRatio: '4 / 5', width: '100%', position: 'relative' }}>
          {currentCandidate.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentCandidate.photoUrl} alt={currentCandidate.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              No photo uploaded
            </div>
          )}
          <div style={{ position: 'absolute', inset: 'auto 0 0', padding: '1rem', background: 'linear-gradient(180deg,transparent, rgba(5,11,24,0.92))' }}>
            <h2 style={{ margin: 0, fontSize: '1.45rem' }}>
              {currentCandidate.displayName}
              {currentCandidate.age ? `, ${currentCandidate.age}` : ''}
            </h2>
            <p style={{ margin: '0.2rem 0', color: 'var(--text-muted)' }}>{currentCandidate.location}</p>
            <p style={{ marginBottom: 0 }}>{currentCandidate.bio}</p>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => swipe('dislike')}>Pass</Button>
        <Button type="button" disabled={isPending} onClick={() => swipe('like')}>Like</Button>
      </div>

      <Card style={{ display: 'grid', gap: '0.65rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Safety tools</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <Button type="button" variant="ghost" disabled={isPending} onClick={blockCurrentUser}>Block</Button>
          <Button type="button" variant="secondary" disabled={isPending} onClick={reportCurrentUser}>Report</Button>
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

      {feedback ? <p style={{ margin: 0, textAlign: 'center', color: 'var(--accent-4)' }}>{feedback}</p> : null}
    </div>
  );
};
