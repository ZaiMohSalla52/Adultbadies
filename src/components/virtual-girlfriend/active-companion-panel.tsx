import Link from 'next/link';
import { CompanionRosterMedia } from '@/components/virtual-girlfriend/companion-roster-media';
import { Button } from '@/components/ui/button';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendCompanionStatus,
} from '@/lib/virtual-girlfriend/types';

type ActiveCompanionPanelProps = {
  companion: VirtualGirlfriendCompanionRecord;
  image: VirtualGirlfriendCompanionImageRecord | null;
  status: VirtualGirlfriendCompanionStatus;
  pending: boolean;
  pendingId: string | null;
  onSwitch: (companionId: string) => void;
};

export const ActiveCompanionPanel = ({
  companion,
  image,
  status,
  pending,
  pendingId,
  onSwitch,
}: ActiveCompanionPanelProps) => {
  const fallbackVibe = (companion.profile_tags ?? []).slice(0, 3).join(' • ') || companion.tone || 'Distinct chemistry';

  return (
    <article className="vg-active-panel">
      <div className="vg-active-media-column">
        <CompanionRosterMedia
          name={companion.name}
          imageUrl={image?.delivery_url}
          isActive
          status={status}
          mode="active"
          objectPosition="center top"
        />
      </div>

      <div className="vg-active-content-column">
        <div className="vg-active-header-row">
          <p className="my-0 text-xs text-muted">{companion.archetype ?? 'Virtual Companion'}</p>
          <span className="vg-status-pill vg-status-pill-active">active</span>
        </div>

        <div className="vg-active-title-wrap">
          <h2 className="my-0">{companion.name}</h2>
          <p className="my-0 text-sm text-muted">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
        </div>

        <div className="vg-active-details">
          <p className="my-0 text-xs text-muted">{fallbackVibe}</p>
          {status === 'generating' ? (
            <p className="my-0 text-xs text-muted">Finalizing her locked portrait and gallery continuity…</p>
          ) : null}
          {status === 'partial_success' ? (
            <p className="my-0 text-xs text-muted">Portrait is ready. Additional gallery moments are still recovering.</p>
          ) : null}
          {status === 'failed' ? (
            <p className="my-0 text-xs text-muted">A generation step failed. You can still chat and review profile details.</p>
          ) : null}
          {status === 'review_pending' ? (
            <p className="my-0 text-xs text-muted">Portrait is visible while internal review is still pending.</p>
          ) : null}
        </div>

        <div className="vg-active-actions">
          <Link href={`/virtual-girlfriend/chat?companionId=${companion.id}`} className="ui-button ui-button-primary">
            Continue chat
          </Link>
          <div className="vg-active-secondary-actions">
            <Link href={`/virtual-girlfriend/profile?companionId=${companion.id}`} className="ui-button ui-button-ghost vg-secondary-action">
              View profile
            </Link>
            <Button type="button" variant="secondary" onClick={() => onSwitch(companion.id)} disabled={pending && pendingId === companion.id}>
              {pending && pendingId === companion.id ? 'Opening…' : 'Open active'}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};
