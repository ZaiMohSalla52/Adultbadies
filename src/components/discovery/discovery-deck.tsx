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
        setFeedback(`It's a match with ${target.displayName}!`);
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
      <Card className="space-y-3 p-6 text-center">
        <h2 className="text-xl font-semibold">No more candidates right now</h2>
        <p className="text-sm text-muted">
          You are caught up for now. Check back later as more members complete onboarding.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="my-0 text-sm font-medium">Plan</p>
        <p className="my-0 text-sm text-muted">
          {entitlements.isPremium ? 'Premium: unlimited swipes enabled.' : 'Free: daily swipe limit applies.'}
        </p>
        <p className="my-0 text-sm text-muted">
          Swipes today: {swipesToday}
          {entitlements.limits.swipesPerDay !== null ? ` / ${entitlements.limits.swipesPerDay}` : ''}
        </p>
        {!entitlements.isPremium ? (
          <Link href="/premium" className="text-sm">
            Upgrade to Premium
          </Link>
        ) : null}
      </Card>

      <Card className="space-y-4 overflow-hidden p-0">
        <div className="aspect-[4/5] w-full bg-surface-2">
          {currentCandidate.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentCandidate.photoUrl} alt={currentCandidate.displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">No photo uploaded</div>
          )}
        </div>

        <div className="space-y-2 px-4 pb-4">
          <h2 className="text-xl font-semibold">
            {currentCandidate.displayName}
            {currentCandidate.age ? `, ${currentCandidate.age}` : ''}
          </h2>
          <p className="text-sm text-muted">{currentCandidate.location}</p>
          <p className="text-sm leading-relaxed">{currentCandidate.bio}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => swipe('dislike')}>
          Pass
        </Button>
        <Button type="button" disabled={isPending} onClick={() => swipe('like')}>
          Like
        </Button>
      </div>

      <Card className="space-y-3">
        <p className="my-0 text-sm font-medium">Premium features</p>
        <div className="grid gap-2 text-sm text-muted">
          <p>
            Rewind: {entitlements.features.rewind ? 'Available' : 'Locked on Free plan'}
          </p>
          <p>
            See who liked you: {entitlements.features.seeWhoLikedYou ? 'Available' : 'Locked on Free plan'}
          </p>
        </div>
        {!entitlements.isPremium ? (
          <Link href="/premium" className="text-sm">
            Unlock Premium features
          </Link>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <p className="my-0 text-sm font-medium">Safety tools</p>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={blockCurrentUser}>
            Block user
          </Button>
          <Button type="button" variant="secondary" disabled={isPending} onClick={reportCurrentUser}>
            Report user
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted" htmlFor="discovery-report-category">
            Report category
          </label>
          <select
            id="discovery-report-category"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
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
        </div>

        <Textarea
          value={reportDetails}
          onChange={(event) => setReportDetails(event.target.value)}
          maxLength={1000}
          placeholder="Optional details"
          disabled={isPending}
        />
      </Card>

      {feedback ? <p className="text-center text-sm text-brand">{feedback}</p> : null}
    </div>
  );
};
