'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DiscoveryCandidate } from '@/lib/discovery/types';

type DiscoveryDeckProps = {
  initialCandidates: DiscoveryCandidate[];
};

export const DiscoveryDeck = ({ initialCandidates }: DiscoveryDeckProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentCandidate = useMemo(() => candidates[0] ?? null, [candidates]);

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
        setFeedback('Could not save swipe. Please try again.');
        return;
      }

      const payload = (await response.json()) as { matched?: boolean };
      setCandidates((prev) => prev.filter((candidate) => candidate.userId !== target.userId));

      if (payload.matched) {
        setFeedback(`It's a match with ${target.displayName}!`);
      }

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
      <Card className="space-y-4 p-0 overflow-hidden">
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

      {feedback ? <p className="text-center text-sm text-brand">{feedback}</p> : null}
    </div>
  );
};
