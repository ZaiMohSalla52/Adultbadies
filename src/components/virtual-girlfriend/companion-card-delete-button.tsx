'use client';

import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import { readJsonResponse } from '@/lib/api/read-json-response';

export const CompanionCardDeleteButton = ({
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

  const stopNavigation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
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
      setPending(false);
    }
  };

  if (confirming) {
    return (
      <div className="ai-gf-card-delete-confirm" onClick={stopNavigation} role="presentation">
        <p className="ai-gf-card-delete-title">Delete {companionName}?</p>
        <p className="ai-gf-card-delete-copy">Chats and photos will be removed permanently.</p>
        {error ? <p className="ai-gf-card-delete-error">{error}</p> : null}
        <div className="ai-gf-card-delete-actions">
          <button
            type="button"
            className="ai-gf-card-delete-cancel"
            onClick={(event) => {
              stopNavigation(event);
              setConfirming(false);
              setError(null);
            }}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ai-gf-card-delete-confirm-btn"
            onClick={(event) => {
              stopNavigation(event);
              void deleteCompanion();
            }}
            disabled={pending}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="ai-gf-card-delete"
      aria-label={`Delete ${companionName}`}
      title={`Delete ${companionName}`}
      onClick={(event) => {
        stopNavigation(event);
        setConfirming(true);
        setError(null);
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    </button>
  );
};