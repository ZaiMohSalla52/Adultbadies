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
  const curated = curateVirtualGirlfriendImages(images, {
    lockedCanonicalImageId: visualProfile?.canonical_reference_image_id ?? null,
  });
  const canonical = curated.canonical;
  const gallery = curated.gallery;
  const profileDisclosure = companion.disclosure_label;
  const photoDisclosure = visualProfile ? 'AI-generated photos' : null;
  const structured = companion.structured_profile;

  const cleanValue = (value: unknown): string | null => {
    if (typeof value === 'number') return `${value}`;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const joinUnique = (values: Array<string | null>) => {
    const parts = values.filter(Boolean) as string[];
    const deduped = parts.filter((value, idx) => parts.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === idx);
    return deduped.length ? deduped.join(' • ') : null;
  };

  const dossierAttributes = [
    { label: 'Age', value: cleanValue(structured?.age) },
    {
      label: 'Origin',
      value: cleanValue(structured?.origin),
    },
    { label: 'Hair color', value: cleanValue(structured?.hairColor) },
    {
      label: 'Figure',
      value: cleanValue(structured?.figure),
    },
    { label: 'Occupation', value: cleanValue(structured?.occupation) },
    { label: 'Personality', value: cleanValue(structured?.personality) ?? companion.archetype },
    { label: 'Sexuality', value: cleanValue(structured?.sexuality) },
    {
      label: 'Relationship vibe',
      value: joinUnique([cleanValue(structured?.tone) ?? companion.tone, cleanValue(structured?.affectionStyle) ?? companion.affection_style]),
    },
    {
      label: 'Lifestyle',
      value: cleanValue(structured?.freeformDetails) ?? cleanValue(structured?.visualAesthetic) ?? companion.visual_aesthetic,
    },
  ].filter((item) => Boolean(item.value));

  const softStatusMessage =
    status === 'generating'
      ? 'Her image set is still generating. We will show her portrait as soon as it is ready.'
      : status === 'partial_success'
        ? 'Her locked portrait is ready, but some gallery moments did not finish yet.'
        : status === 'failed'
          ? 'Image generation failed for this profile. You can still chat and open her profile while we retry later.'
          : status === 'review_pending'
            ? 'Portrait is usable now and currently marked as pending internal review.'
            : null;

  const traitPills = [
    cleanValue(structured?.personality) ?? companion.archetype,
    cleanValue(structured?.tone) ?? companion.tone,
    cleanValue(structured?.occupation),
    profileDisclosure,
  ].filter(Boolean) as string[];

  const vibeDescriptor = cleanValue(structured?.tone) ?? companion.tone ?? 'Magnetic, private, and effortlessly playful.';

  return (
    <div className="app-page-stack vg-profile-page">
      <section className="vg-profile-hero">
        <div className="vg-profile-portrait-stack">
          {canonical ? (
            <ProfileMediaFrame className="vg-profile-main-portrait">
              <Avatar name={companion.name} imageUrl={canonical.delivery_url} kind="ai" size="hero" variant="rounded" className="vg-hero-avatar" />
            </ProfileMediaFrame>
          ) : (
            <div className="vg-profile-main-empty">Her portrait is being prepared. Please check back in a moment.</div>
          )}

          {gallery.length ? (
            <div className="vg-profile-thumbnail-row">
              {gallery.slice(0, 3).map((image) => (
                <div key={image.id} className="vg-profile-thumbnail">
                  <Image src={image.delivery_url} alt={`${companion.name} alternate portrait`} fill className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="vg-profile-identity">
          <p className="my-0 text-xs text-muted">{photoDisclosure ?? profileDisclosure}</p>
          <h1 className="my-0 vg-profile-name">{companion.name}</h1>
          <p className="my-0 text-muted vg-profile-vibe">{vibeDescriptor}</p>

          {traitPills.length ? (
            <div className="vg-profile-pill-row" aria-label="Companion traits">
              {traitPills.slice(0, 4).map((pill) => (
                <span key={pill} className="vg-profile-pill">
                  {pill}
                </span>
              ))}
            </div>
          ) : null}

          {softStatusMessage ? <p className="my-0 text-xs text-muted vg-profile-soft-note">{softStatusMessage}</p> : null}

          <div className="vg-profile-cta-row">
            <Link href={`/virtual-girlfriend/chat?companionId=${companion.id}`} className="ui-button ui-button-primary vg-profile-primary-cta">
              Chat now
            </Link>
            <Link href="/virtual-girlfriend" className="ui-button ui-button-ghost vg-profile-secondary-cta">
              Switch companion
            </Link>
            <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-ghost vg-profile-secondary-cta">
              Create another
            </Link>
          </div>
        </div>
      </section>

      {dossierAttributes.length ? (
        <section className="vg-profile-dossier">
          <div className="vg-section-heading">
            <h2 className="my-0 text-base font-semibold">Character dossier</h2>
            <p className="my-0 text-sm text-muted">The essentials that define her style and chemistry.</p>
          </div>
          <dl className="vg-profile-dossier-grid">
            {dossierAttributes.map((item) => (
              <div key={item.label} className="vg-profile-dossier-card">
                <dt className="vg-profile-dossier-label">{item.label}</dt>
                <dd className="my-0 vg-profile-dossier-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="vg-profile-gallery">
        <div className="vg-section-heading">
          <h2 className="my-0 text-base font-semibold">Gallery moments</h2>
          <p className="my-0 text-sm text-muted">More moments will appear here as her gallery expands.</p>
        </div>

        {gallery.length ? (
          <div className="vg-profile-gallery-grid">
            {gallery.map((image) => (
              <div key={image.id} className="vg-profile-gallery-item">
                <Image src={image.delivery_url} alt={`${companion.name} gallery photo`} fill className="object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="vg-profile-gallery-empty">
            <p className="my-0">More moments will appear here as her gallery expands.</p>
          </div>
        )}
      </section>
    </div>
  );
};
