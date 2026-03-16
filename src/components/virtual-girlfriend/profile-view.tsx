import Image from 'next/image';
import Link from 'next/link';
import { Avatar, ProfileMediaFrame } from '@/components/ui/avatar';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualProfileRecord,
  VirtualGirlfriendCompanionStatus,
} from '@/lib/virtual-girlfriend/types';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';

export const VirtualGirlfriendProfileView = ({
  companion,
  visualProfile,
  images,
  status,
}: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  images: VirtualGirlfriendCompanionImageRecord[];
  status: VirtualGirlfriendCompanionStatus;
}) => {
  const curated = curateVirtualGirlfriendImages(images);
  const canonical = curated.canonical;
  const gallery = curated.gallery;
  const profileDisclosure = companion.disclosure_label;
  const photoDisclosure = visualProfile ? 'AI-generated photos' : null;

  const statusMessage =
    status === 'generating'
      ? 'Her profile is still generating. Photos may appear in a moment.'
      : status === 'failed'
        ? 'Photo generation failed for this profile. You can still chat or create another companion.'
        : null;

  return (
    <div className="app-page-stack vg-premium-profile">
      <section className="vg-hero-card">
        {canonical ? (
          <ProfileMediaFrame className="vg-hero-image-wrap">
            <Avatar name={companion.name} imageUrl={canonical.delivery_url} kind="ai" size="hero" variant="rounded" ring className="vg-hero-avatar" />
          </ProfileMediaFrame>
        ) : (
          <div className="vg-hero-image-empty">Her profile portrait is being prepared. Check back in a moment.</div>
        )}

        <div className="vg-hero-copy">
          <h1 className="my-0 vg-hero-name">{companion.name}</h1>
          <p className="my-0 text-muted vg-hero-bio">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
          <p className="my-0 vg-disclosure-row text-muted text-xs">
            <span>{profileDisclosure}</span>
            {photoDisclosure ? <span>{photoDisclosure}</span> : null}
          </p>
          {statusMessage ? <p className="my-0 text-xs text-muted">{statusMessage}</p> : null}
          <div className="vg-hero-actions">
            <Link href={`/virtual-girlfriend/chat?companionId=${companion.id}`} className="ui-button ui-button-primary">
              Chat now
            </Link>
            <Link href="/virtual-girlfriend" className="ui-button ui-button-ghost vg-secondary-action">
              Switch companion
            </Link>
            <Link href={`/virtual-girlfriend/setup?new=1`} className="ui-button ui-button-ghost vg-secondary-action">
              Create another
            </Link>
          </div>
        </div>
      </section>

      <section className="vg-gallery-section">
        <div className="vg-section-heading">
          <h2 className="my-0 text-base font-semibold">Photos</h2>
          <p className="my-0 text-sm text-muted">A closer look at her moments.</p>
        </div>

        {gallery.length ? (
          <div className="vg-gallery-grid">
            {gallery.map((image) => (
              <div key={image.id} className="vg-gallery-item">
                <Image src={image.delivery_url} alt={`${companion.name} gallery photo`} fill className="object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="my-0 text-sm text-muted">No gallery photos generated yet.</p>
        )}
      </section>
    </div>
  );
};
