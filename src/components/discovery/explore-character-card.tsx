'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './explore-character-card.module.css';

export type ExploreCharacterCardProps = {
  name: string;
  bio: string;
  photoUrl: string | null;
  href: string;
  categoryLabel?: string | null;
  hoverVideoUrl?: string | null;
  metaTag?: string | null;
};

export const ExploreCharacterCard = ({
  name,
  bio,
  photoUrl,
  href,
  categoryLabel,
  hoverVideoUrl,
  metaTag,
}: ExploreCharacterCardProps) => (
  <Link href={href} className={styles.card}>
    <div className={styles.media}>
      {categoryLabel ? <span className={styles.categoryBadge}>{categoryLabel}</span> : null}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 22vw"
          className={styles.staticImg}
        />
      ) : (
        <div className={styles.fallback}>{name.charAt(0)}</div>
      )}
      {hoverVideoUrl ? (
        <video
          className={styles.hoverVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src={hoverVideoUrl} type="video/mp4" />
        </video>
      ) : null}
    </div>
    <div className={styles.body}>
      <span className={styles.name}>{name}</span>
      <p className={styles.bio}>{bio}</p>
      {metaTag ? <span className={styles.metaTag}>{metaTag}</span> : null}
    </div>
  </Link>
);