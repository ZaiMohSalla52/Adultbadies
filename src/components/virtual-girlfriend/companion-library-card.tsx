import Link from 'next/link';
import { CompanionRosterMedia } from '@/components/virtual-girlfriend/companion-roster-media';
import { Button } from '@/components/ui/button';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendCompanionStatus,
} from '@/lib/virtual-girlfriend/types';

type CompanionLibraryCardProps = {
  companion: VirtualGirlfriendCompanionRecord;
  image: VirtualGirlfriendCompanionImageRecord | null;
  status: VirtualGirlfriendCompanionStatus;
  isActive?: boolean;
  pending: boolean;
  pendingId: string | null;
  onSwitch: (companionId: string) => void;
};

export const CompanionLibraryCard = ({
  companion,
  image,
  status,
  isActive = false,
  pending,
  pendingId,
  onSwitch,
}: CompanionLibraryCardProps) => {
  const statusLabel = isActive ? 'active' : status;
  const fallbackVibe = (companion.profile_tags ?? []).slice(0, 2).join(' • ') || companion.tone || 'Distinct chemistry';

  return (
    <article className="vg-library-card">
      <CompanionRosterMedia
        name={companion.name}
        imageUrl={image?.delivery_url}
        isActive={isActive}
        status={status}
        mode="library"
        objectPosition="center 20%"
      />

      <div className="vg-library-copy">
        <div className="vg-roster-meta-row">
          <p className="my-0 text-xs text-muted">{companion.archetype ?? 'Virtual Companion'}</p>
          <span className={`vg-status-pill vg-status-pill-${statusLabel}`}>{statusLabel}</span>
        </div>
        <h3 className="my-0 vg-library-name">{companion.name}</h3>
        <p className="my-0 text-xs text-muted">{fallbackVibe}</p>
      </div>

      <div className="vg-library-actions">
        <Link href={`/virtual-girlfriend/chat?companionId=${companion.id}`} className="ui-button ui-button-primary">
          Chat
        </Link>
        <div className="vg-roster-secondary-actions">
          <Link href={`/virtual-girlfriend/profile?companionId=${companion.id}`} className="ui-button ui-button-ghost vg-secondary-action">
            View profile
          </Link>
          <Button type="button" variant="secondary" onClick={() => onSwitch(companion.id)} disabled={pending && pendingId === companion.id}>
            {pending && pendingId === companion.id ? 'Switching…' : isActive ? 'Open active' : 'Make active'}
          </Button>
        </div>
      </div>
    </article>
  );
};
