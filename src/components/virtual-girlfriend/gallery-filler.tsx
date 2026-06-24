'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Owner-only: drives the gallery toward its target by calling the top-up
 * endpoint one batch at a time, refreshing after each batch so the next mount
 * continues until the target is reached. Self-gates on galleryCount.
 */
export const GalleryFiller = ({
  companionId,
  galleryCount,
  target,
}: {
  companionId: string;
  galleryCount: number;
  target: number;
}) => {
  const router = useRouter();
  // Tracks which count we've already kicked a batch for, to avoid duplicate
  // concurrent calls while allowing a fresh call after each successful batch.
  const inFlightForCount = useRef<number | null>(null);

  useEffect(() => {
    if (galleryCount >= target) return;
    if (inFlightForCount.current === galleryCount) return;
    inFlightForCount.current = galleryCount;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/virtual-girlfriend/gallery/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companionId }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { galleryCount?: number };
        if (!cancelled && typeof data.galleryCount === 'number' && data.galleryCount > galleryCount) {
          router.refresh();
        }
      } catch {
        // transient; a later mount/refresh can retry
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companionId, galleryCount, target, router]);

  return null;
};
