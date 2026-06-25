'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './profile-view.module.css';

export const RegenerateImagesButton = ({ companionId }: { companionId: string }) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/virtual-girlfriend/regenerate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to restart image generation.');
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Retry failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.retryRow}>
      <button type="button" className={styles.secondaryButton} onClick={() => void retry()} disabled={pending}>
        {pending ? 'Restarting photos…' : 'Retry photo generation'}
      </button>
      {error ? <p className={styles.retryError}>{error}</p> : null}
    </div>
  );
};