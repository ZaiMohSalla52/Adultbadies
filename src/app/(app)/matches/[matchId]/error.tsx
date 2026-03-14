'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MatchConversationError({ reset }: { reset: () => void }) {
  return (
    <Card>
      <p className="my-0">Unable to load this conversation.</p>
      <div className="flex gap-3">
        <Button onClick={reset} type="button" variant="secondary">
          Retry
        </Button>
        <Link className="text-sm" href="/matches">
          Back to matches
        </Link>
      </div>
    </Card>
  );
}
