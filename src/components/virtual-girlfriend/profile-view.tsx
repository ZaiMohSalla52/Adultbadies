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
import styles from './profile-view.module.css';

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
  const structured = companion.structured_profile;

  const cleanValue = (value: unknown): string | null => {
    if (typeof value === 'number') return `${value}`;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const vibeDescriptor = cleanValue(structured?.tone) ?? companion.tone ?? 'Magnetic, private, and effortlessly playful.';

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

  const hairColor = cleanValue(structured?.hairColor);
  const personality = cleanValue(structured?.personality) ?? companion.archetype;

  const traits = [
    { label: 'Sex', value: cleanValue(structured?.sex) },
    { label: 'Origin', value: cleanValue(structured?.origin) },
    { label: 'Hair Color', value: hairColor, swatch: hairColor },
    { label: 'Hair Length', value: cleanValue(structured?.hairLength) },
    { label: 'Figure/Body', value: cleanValue(structured?.bodyType) ?? cleanValue(structured?.figure) },
    { label: 'Age', value: cleanValue(structured?.age) },
    {
      label: 'Breast Size',
      value: (cleanValue(structured?.sex) ?? '').toLowerCase() === 'female' ? cleanValue(structured?.breastSize) : null,
    },
    { label: 'Occupation', value: cleanValue(structured?.occupation) },
    { label: 'Personality', value: personality, emoji: '✨' },
    { label: 'Sexuality', value: cleanValue(structured?.sexuality) },
  ].filter((trait) => Boolean(trait.value));

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.portraitColumn}>
          {canonical ? (
            <ProfileMediaFrame className={styles.mainPortrait}>
              <Avatar
                name={companion.name}
                imageUrl={canonical.delivery_url}
                kind="ai"
                size="hero"
                variant="rounded"
                className={styles.heroAvatar}
              />
            </ProfileMediaFrame>
          ) : (
            <div className={styles.mainEmpty}>Her portrait is being prepared. Please check back in a moment.</div>
          )}

          {gallery.length > 0 ? (
            <div className={styles.thumbnailRow}>
              {gallery.slice(0, 3).map((image) => (
                <div key={image.id} className={styles.thumbnail}>
                  <Image src={image.delivery_url} alt={`${companion.name} alternate portrait`} fill className={styles.image} />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.identityColumn}>
          <p className={styles.disclosure}>{visualProfile ? 'AI-generated photos' : companion.disclosure_label}</p>
          <h1 className={styles.name}>{companion.name}</h1>
          <p className={styles.vibe}>{vibeDescriptor}</p>

          {softStatusMessage ? <p className={styles.statusNote}>{softStatusMessage}</p> : null}

          <div className={styles.traitsGrid}>
            {traits.map((trait) => (
              <article key={trait.label} className={styles.traitCard}>
                <p className={styles.traitLabel}>{trait.label}</p>
                <p className={styles.traitValue}>
                  {trait.swatch ? <span className={styles.swatch} style={{ backgroundColor: trait.swatch }} aria-hidden /> : null}
                  {trait.emoji ? <span className={styles.emoji}>{trait.emoji}</span> : null}
                  <span>{trait.value}</span>
                </p>
              </article>
            ))}
          </div>

          <div className={styles.actions}>
            <Link href={`/virtual-girlfriend/chat?companionId=${companion.id}`} className={styles.primaryButton}>
              Chat now
            </Link>
            <Link href="/virtual-girlfriend" className={styles.secondaryButton}>
              Switch companion
            </Link>
            <Link href="/virtual-girlfriend/setup?new=1" className={styles.secondaryButton}>
              Create another
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.gallerySection}>
        <div className={styles.sectionHeader}>
          <h2>Gallery moments</h2>
          <p>More moments will appear here as her gallery expands.</p>
        </div>

        {gallery.length > 0 ? (
          <div className={styles.galleryRow}>
            {gallery.map((image) => (
              <div key={image.id} className={styles.galleryCard}>
                <Image src={image.delivery_url} alt={`${companion.name} gallery photo`} fill className={styles.image} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.galleryEmpty}>No extra gallery moments yet.</div>
        )}
      </section>
    </div>
  );
};
