import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function ConversationNotFound() {
  return (
    <Card>
      <p className="my-0">Conversation not found or unavailable.</p>
      <Link className="text-sm" href="/matches">
        Back to matches
      </Link>
    </Card>
  );
}
