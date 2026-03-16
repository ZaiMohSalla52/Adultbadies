import { Avatar, ProfileMediaFrame } from '@/components/ui/avatar';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';

type CompanionRosterMediaProps = {
  name: string;
  imageUrl?: string | null;
  isActive: boolean;
  status: VirtualGirlfriendCompanionStatus;
  mode?: 'active' | 'library';
  objectPosition?: string;
};

export const CompanionRosterMedia = ({
  name,
  imageUrl,
  isActive,
  status,
  mode = 'library',
  objectPosition = 'center top',
}: CompanionRosterMediaProps) => (
  <ProfileMediaFrame className={`vg-roster-media-frame vg-roster-media-frame-${mode}`}>
    <Avatar
      name={name}
      imageUrl={imageUrl}
      kind="ai"
      size="hero"
      variant="rounded"
      isActive={isActive}
      objectPosition={objectPosition}
      className="vg-roster-media-avatar"
    />
    {!imageUrl ? (
      <div className="vg-roster-image-empty" role="status" aria-live="polite">
        {status === 'generating' ? 'Portrait generating…' : 'Portrait unavailable'}
      </div>
    ) : null}
  </ProfileMediaFrame>
);
