import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

export const VirtualGirlfriendProfileView = ({
  companion,
  visualProfile,
  images,
}: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  images: VirtualGirlfriendCompanionImageRecord[];
}) => {
  const canonical = images.find((image) => image.image_kind === 'canonical') ?? null;
  const gallery = images.filter((image) => image.image_kind === 'gallery');

  return (
    <div className="app-page-stack vg-premium-profile">
      <Card className="vg-hero-card">
        <div className="vg-hero-copy">
          <p className="chat-label">Virtual Girlfriend</p>
          <h1 className="my-0 vg-hero-name">{companion.name}</h1>
          <p className="my-0 text-muted vg-hero-bio">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
          <p className="my-0 text-xs text-muted">{companion.disclosure_label} • AI-generated photos</p>
          <div className="vg-hero-actions">
            <Link href="/virtual-girlfriend/chat" className="ui-button">
              Chat now
            </Link>
            <Link href="/virtual-girlfriend/setup" className="ui-button ui-button-ghost">
              Refine setup
            </Link>
          </div>
        </div>

        {canonical ? (
          <div className="vg-hero-image-wrap">
            <Image src={canonical.delivery_url} alt={`${companion.name} portrait`} fill className="object-cover" priority />
          </div>
        ) : (
          <div className="vg-hero-image-empty">Her profile portrait is being prepared. Check back in a moment.</div>
        )}
      </Card>

      <Card className="app-surface-card space-y-3">
        <div className="vg-section-heading">
          <h2 className="my-0 text-base font-semibold">Photo gallery</h2>
          <p className="my-0 text-sm text-muted">Curated visual identity with continuity across generations.</p>
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
      </Card>

      {visualProfile ? (
        <Card className="app-surface-card">
          <p className="my-0 text-sm text-muted">
            Visual profile {visualProfile.style_version} active. Identity continuity is enabled for profile and gallery images.
          </p>
        </Card>
      ) : null}
    </div>
  );
};
