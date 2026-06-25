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
import { UnlockableGallery } from '@/components/virtual-girlfriend/unlockable-gallery';
import { RegenerateImagesButton } from '@/components/virtual-girlfriend/regenerate-images-button';
import { DeleteCompanionButton } from '@/components/virtual-girlfriend/delete-companion-button';
import { getCompanionLabels } from '@/lib/virtual-girlfriend/companion-labels';
import styles from './profile-view.module.css';

export const VirtualGirlfriendProfileView = ({
  companion,
  visualProfile,
  images,
  status,
  pointBalance,
  unlockedImageIds,
  unblurCost,
  isPremium,
}: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  images: VirtualGirlfriendCompanionImageRecord[];
  status: VirtualGirlfriendCompanionStatus;
  pointBalance: number;
  unlockedImageIds: string[];
  unblurCost: number;
  isPremium: boolean;
}) => {
  const curated = curateVirtualGirlfriendImages(images, {
    lockedCanonicalImageId: visualProfile?.canonical_reference_image_id ?? null,
  });
  const canonical = curated.canonical;
  const gallery = curated.gallery;
  const unlockedSet = new Set(unlockedImageIds);
  const unlockedThumbnails = gallery.filter((image) => unlockedSet.has(image.id));
  const structured = companion.structured_profile;
  const labels = getCompanionLabels(structured?.sex);

  const cleanValue = (value: unknown): string | null => {
    if (typeof value === 'number') return `${value}`;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const vibeDescriptor = cleanValue(structured?.tone) ?? companion.tone ?? 'Magnetic, private, and effortlessly playful.';

  const softStatusMessage =
    status === 'generating'
      ? labels.statusGenerating
      : status === 'partial_success'
        ? labels.statusPartial
        : status === 'failed'
          ? labels.statusFailed
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
            <div className={styles.mainEmpty}>
              {status === 'failed' ? labels.statusFailed : labels.portraitPending}
            </div>
          )}

          {unlockedThumbnails.length > 0 ? (
            <div className={styles.thumbnailRow}>
              {unlockedThumbnails.slice(0, 3).map((image) => (
                <div key={image.id} className={styles.thumbnail}>
                  <Image src={image.delivery_url} alt={`${companion.name} alternate portrait`} fill className={styles.image} />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.identityColumn}>
          <h1 className={styles.name}>{companion.name}</h1>
          <p className={styles.vibe}>{vibeDescriptor}</p>

          {softStatusMessage ? <p className={styles.statusNote}>{softStatusMessage}</p> : null}
          {status === 'failed' ? <RegenerateImagesButton companionId={companion.id} /> : null}

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
            <Link href={`/virtual-girlfriend/generate?companionId=${companion.id}`} className={styles.secondaryButton}>
              Photo studio
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

      <DeleteCompanionButton companionId={companion.id} companionName={companion.name} />

      <section className={styles.gallerySection}>
        <div className={styles.sectionHeader}>
          <h2>Gallery moments</h2>
          <p>{labels.galleryExpand}</p>
        </div>

        {gallery.length > 0 ? (
          <UnlockableGallery
            companionName={companion.name}
            images={gallery.map((image) => ({ id: image.id, url: image.delivery_url }))}
            initialUnlockedIds={unlockedImageIds}
            balance={pointBalance}
            cost={unblurCost}
            isPremium={isPremium}
          />
        ) : (
          <div className={styles.galleryEmpty}>No extra gallery moments yet.</div>
        )}
      </section>
    </div>
  );
};
