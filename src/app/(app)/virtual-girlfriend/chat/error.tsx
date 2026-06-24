'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VirtualGirlfriendChatError({ reset }: { reset: () => void }) {
  return (
    <Card>
      <p className="my-0">Unable to load chat right now.</p>
      <Button className="mt-0" onClick={reset} type="button" variant="secondary">
        Try again
      </Button>
    </Card>
  );
}
