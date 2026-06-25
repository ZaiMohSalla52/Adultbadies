'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';
import styles from './profile-view.module.css';

/**
 * While a companion's images are generating in the background, poll the status
 * endpoint and refresh the server component once generation reaches a terminal
 * state (ready / partial_success / failed / review_pending).
 */
export const GenerationPoller = ({
  companionId,
  status,
  intervalMs = 4000,
  maxAttempts = 60,
}: {
  companionId: string;
  status: VirtualGirlfriendCompanionStatus;
  intervalMs?: number;
  maxAttempts?: number;
}) => {
  const router = useRouter();
  const attempts = useRef(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== 'generating') {
      setTimedOut(false);
      attempts.current = 0;
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > maxAttempts) {
        clearInterval(interval);
        if (!cancelled) setTimedOut(true);
        return;
      }

      try {
        const response = await fetch(
          `/api/virtual-girlfriend/generation-status?companionId=${encodeURIComponent(companionId)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { status?: string };
        if (!cancelled && data.status && data.status !== 'generating') {
          clearInterval(interval);
          setTimedOut(false);
          router.refresh();
        }
      } catch {
        // transient; keep polling until maxAttempts
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companionId, status, intervalMs, maxAttempts, router]);

  if (status !== 'generating' || !timedOut) return null;

  return (
    <div className={styles.pollerBanner}>
      <p>Photos are still generating in the background.</p>
      <button type="button" className={styles.secondaryButton} onClick={() => router.refresh()}>
        Refresh profile
      </button>
    </div>
  );
};