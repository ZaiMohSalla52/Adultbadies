'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export const UnmatchButton = ({ matchId }: { matchId: string }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onUnmatch = () => {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/matches/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });

      if (!response.ok) {
        setError('Unable to unmatch right now.');
        return;
      }

      router.push('/matches');
      router.refresh();
    });
  };

  return (
    <div>
      <Button type="button" variant="ghost" onClick={onUnmatch} disabled={pending} className="matches-unmatch-button">
        Unmatch
      </Button>
      {error ? <p className="my-0 text-sm text-muted">{error}</p> : null}
    </div>
  );
};
