import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';

export const VirtualGirlfriendProfileView = ({ companion }: { companion: VirtualGirlfriendCompanionRecord }) => {
  const tags = companion.profile_tags ?? companion.persona_profile.vibeTags ?? [];

  return (
    <div className="app-page-stack">
      <Card className="app-page-header">
        <p className="chat-label">Virtual Girlfriend</p>
        <h1 className="my-0">{companion.name}</h1>
        <p className="my-0 text-muted">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
        <p className="my-0 text-xs text-muted">{companion.disclosure_label} • Virtual profile</p>
      </Card>

      <Card className="app-surface-card space-y-3">
        <h2 className="my-0 text-base font-semibold">Her vibe</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-muted">{tag}</span>
          ))}
        </div>
      </Card>

      <Card className="app-surface-card space-y-2">
        <h2 className="my-0 text-base font-semibold">Premium roadmap</h2>
        <p className="my-0 text-sm text-muted">Voice chat is premium-only and coming soon. Visual gallery generation unlocks in upcoming stages.</p>
      </Card>

      <div className="flex gap-3">
        <Link href="/virtual-girlfriend/chat" className="ui-button">
          Start chatting
        </Link>
        <Link href="/virtual-girlfriend/setup" className="ui-button ui-button-ghost">
          Refine setup
        </Link>
      </div>
    </div>
  );
};
