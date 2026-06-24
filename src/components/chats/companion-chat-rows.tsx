import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';

export type VGThreadItem = {
  id: string;
  companionId: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  href: string;
  preview: string | null;
  lastActivityAt: string;
  lastMessageSenderId: string | null;
  userId: string;
  isNew: boolean;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  if (diffDays < 7) return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export function CompanionChatRows({ items }: { items: VGThreadItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="chats-item chats-item--ai">
          <Avatar
            name={item.name}
            imageUrl={item.avatarUrl}
            kind="ai"
            size="lg"
            ring
            isActive
          />
          <div className="chats-item-body">
            <div className="chats-item-top">
              <span className="chats-item-name">{item.name}</span>
              <span className="chats-ai-badge">AI</span>
              <span className="chats-item-time">{formatDate(item.lastActivityAt)}</span>
            </div>
            <div className="chats-item-bottom">
              <span className="chats-item-preview">{item.preview ?? 'No messages yet.'}</span>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}