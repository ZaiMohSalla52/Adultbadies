'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './profile-view.module.css';

export type UnlockableImage = {
  id: string;
  url: string;
};

export const UnlockableGallery = ({
  companionName,
  images,
  initialUnlockedIds,
  balance: initialBalance,
  cost,
  isPremium,
}: {
  companionName: string;
  images: UnlockableImage[];
  initialUnlockedIds: string[];
  balance: number;
  cost: number;
  isPremium: boolean;
}) => {
  const [unlocked, setUnlocked] = useState<Set<string>>(() => new Set(initialUnlockedIds));
  const [balance, setBalance] = useState(initialBalance);

  // Merge in any newly-unlocked ids (e.g. a photo just sent in chat) without
  // dropping locally-unlocked ones.
  useEffect(() => {
    setUnlocked((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of initialUnlockedIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [initialUnlockedIds]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lockedCount = useMemo(
    () => images.filter((image) => !unlocked.has(image.id)).length,
    [images, unlocked],
  );

  const handleUnlock = async (imageId: string) => {
    setError(null);
    setPendingId(imageId);
    try {
      const response = await fetch('/api/points/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });
      const data = (await response.json()) as { ok?: boolean; balance?: number; error?: string; code?: string };

      if (response.status === 402 || data.code === 'INSUFFICIENT_POINTS') {
        setBalance(data.balance ?? balance);
        setError('Not enough points. Premium members get a monthly points stipend.');
        return;
      }
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Unable to unblur right now.');
        return;
      }

      setUnlocked((prev) => new Set(prev).add(imageId));
      if (typeof data.balance === 'number') setBalance(data.balance);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <div className={styles.galleryToolbar}>
        <span className={styles.pointsPill}>💜 {balance} points</span>
        {lockedCount > 0 ? (
          <span className={styles.lockedHint}>
            {lockedCount} locked · {cost} pts each
          </span>
        ) : null}
      </div>

      <div className={styles.galleryRow}>
        {images.map((image) => {
          const isUnlocked = unlocked.has(image.id);
          return (
            <div key={image.id} className={styles.galleryCard}>
              <Image
                src={image.url}
                alt={`${companionName} gallery photo`}
                fill
                className={styles.image}
                style={isUnlocked ? undefined : { filter: 'blur(22px)', transform: 'scale(1.1)' }}
              />
              {!isUnlocked ? (
                <div className={styles.lockOverlay}>
                  <button
                    type="button"
                    className={styles.unblurButton}
                    onClick={() => handleUnlock(image.id)}
                    disabled={pendingId === image.id}
                  >
                    {pendingId === image.id ? 'Unblurring…' : `Unblur for 💜 ${cost}`}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className={styles.galleryError}>
          {error}{' '}
          {!isPremium ? (
            <Link href="/premium" className={styles.upgradeLink}>
              Get Premium
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
};
