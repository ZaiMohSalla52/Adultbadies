'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readJsonResponse } from '@/lib/api/read-json-response';
import styles from './profile-view.module.css';

export const DeleteCompanionButton = ({
  companionId,
  companionName,
}: {
  companionId: string;
  companionName: string;
}) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setConfirming(false);
    setError(null);
  };

  const deleteCompanion = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/virtual-girlfriend/companion', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });

      const body = await readJsonResponse<{
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      }>(response);

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? 'Unable to delete companion.');
      }

      router.push(body.redirectTo ?? '/virtual-girlfriend');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
    } finally {
      setPending(false);
    }
  };

  if (!confirming) {
    return (
      <div className={styles.dangerZone}>
        <p className={styles.dangerTitle}>Danger zone</p>
        <p className={styles.dangerCopy}>
          Permanently remove {companionName}, including chats, photos, memories, and gallery unlocks for this companion.
        </p>
        <button type="button" className={styles.dangerButton} onClick={() => setConfirming(true)}>
          Delete companion
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dangerZone}>
      <p className={styles.dangerTitle}>Delete {companionName}?</p>
      <p className={styles.dangerCopy}>This cannot be undone. All photos and chat history for this companion will be removed.</p>
      <div className={styles.dangerActions}>
        <button type="button" className={styles.secondaryButton} onClick={cancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className={styles.dangerButton} onClick={() => void deleteCompanion()} disabled={pending}>
          {pending ? 'Deleting…' : 'Yes, delete permanently'}
        </button>
      </div>
      {error ? <p className={styles.dangerError}>{error}</p> : null}
    </div>
  );
};