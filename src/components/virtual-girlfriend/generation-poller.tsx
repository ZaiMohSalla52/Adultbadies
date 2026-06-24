'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';

/**
 * While a companion's images are generating in the background, poll the status
 * endpoint and refresh the server component once generation reaches a terminal
 * state (ready / partial_success / failed / review_pending).
 */
export const GenerationPoller = ({
  companionId,
  status,
  intervalMs = 4000,
  maxAttempts = 45,
}: {
  companionId: string;
  status: VirtualGirlfriendCompanionStatus;
  intervalMs?: number;
  maxAttempts?: number;
}) => {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (status !== 'generating') return;

    let cancelled = false;
    const interval = setInterval(async () => {
      attempts.current += 1;
      if (attempts.current > maxAttempts) {
        clearInterval(interval);
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

  return null;
};
