import { Avatar, ProfileMediaFrame } from '@/components/ui/avatar';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';

export const CompanionRosterMedia = ({
  name,
  imageUrl,
  isActive,
  status,
}: {
  name: string;
  imageUrl?: string | null;
  isActive: boolean;
  status: VirtualGirlfriendCompanionStatus;
}) => (
  <ProfileMediaFrame className="vg-roster-media-frame">
    <Avatar
      name={name}
      imageUrl={imageUrl}
      kind="ai"
      size="hero"
      variant="rounded"
      isActive={isActive}
      objectPosition="center top"
      className="vg-roster-media-avatar"
    />
    {!imageUrl ? (
      <div className="vg-roster-image-empty" role="status" aria-live="polite">
        {status === 'generating' ? 'Portrait generating…' : 'Portrait unavailable'}
      </div>
    ) : null}
  </ProfileMediaFrame>
);
