'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './roster-hub.module.css';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendCompanionStatus,
} from '@/lib/virtual-girlfriend/types';

type RosterItem = {
  companion: VirtualGirlfriendCompanionRecord;
  image: VirtualGirlfriendCompanionImageRecord | null;
  status: VirtualGirlfriendCompanionStatus;
};

const CHAT_READY_STATUSES: VirtualGirlfriendCompanionStatus[] = ['ready', 'partial_success'];

const getVibeText = (companion: VirtualGirlfriendCompanionRecord) =>
  companion.display_bio ||
  companion.archetype ||
  companion.structured_profile?.personality ||
  companion.tone ||
  'Distinct chemistry';

export const VirtualGirlfriendRosterHub = ({
  items,
  activeCompanionId,
  entitlements,
}: {
  items: RosterItem[];
  activeCompanionId: string | null;
  entitlements: Entitlements;
}) => {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (companionId: string) => {
    startTransition(async () => {
      await fetch(`/api/virtual-girlfriend/companion?id=${companionId}`, { method: 'DELETE' });
      setDeletingId(null);
      router.refresh();
    });
  };

  const uniqueItems = Array.from(new Map(items.map((item) => [item.companion.id, item])).values());

  if (!uniqueItems.length) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>👩</span>
          <h2 className={styles.emptyTitle}>No companions yet</h2>
          <p className={styles.emptyText}>Create your first AI companion to start chatting.</p>
          <Link href="/virtual-girlfriend/setup?new=1" className={styles.emptyButton}>
            Create Companion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Your Companions</h1>
          <p className={styles.pageSubtitle}>
            {uniqueItems.length} companion{uniqueItems.length !== 1 ? 's' : ''}
            {entitlements.isPremium ? ' • Premium' : ''}
          </p>
        </div>
        <Link href="/virtual-girlfriend/setup?new=1" className={styles.createButton}>
          + Create New
        </Link>
      </div>

      <div className={styles.grid}>
        {uniqueItems.map((item) => {
          const imageUrl = item.image?.delivery_url || item.image?.origin_storage_key || '/placeholder-avatar.png';
          const isActive = item.companion.id === activeCompanionId;
          const vibeText = getVibeText(item.companion);
          const href = CHAT_READY_STATUSES.includes(item.status)
            ? `/virtual-girlfriend/chat?companionId=${item.companion.id}`
            : `/virtual-girlfriend/profile?companionId=${item.companion.id}`;
          const isConfirming = deletingId === item.companion.id;

          return (
            <div key={item.companion.id} className={styles.cardWrapper}>
              <Link href={href} className={styles.card}>
                <div className={styles.cardImage}>
                  <img src={imageUrl} alt={item.companion.name} className={styles.cardPhoto} loading="lazy" />
                  {isActive ? <span className={styles.activeBadge}>Active</span> : null}
                  {item.status === 'generating' || item.status === 'review_pending' ? (
                    <span className={styles.generatingBadge}>Generating...</span>
                  ) : null}
                  {item.status === 'failed' ? <span className={styles.failedBadge}>Needs review</span> : null}
                </div>
                <div className={styles.cardOverlay}>
                  <h3 className={styles.cardName}>{item.companion.name}</h3>
                  <p className={styles.cardVibe}>{vibeText}</p>
                </div>
              </Link>

              <button
                className={styles.deleteBtn}
                onClick={() => setDeletingId(isConfirming ? null : item.companion.id)}
                aria-label={`Delete ${item.companion.name}`}
                title="Delete companion"
              >
                🗑
              </button>

              {isConfirming && (
                <div className={styles.deleteConfirm}>
                  <span className={styles.deleteConfirmText}>Delete {item.companion.name}?</span>
                  <div className={styles.deleteConfirmActions}>
                    <button
                      className={styles.deleteConfirmYes}
                      onClick={() => handleDelete(item.companion.id)}
                      disabled={isPending}
                    >
                      {isPending ? '…' : 'Delete'}
                    </button>
                    <button
                      className={styles.deleteConfirmNo}
                      onClick={() => setDeletingId(null)}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Link href="/virtual-girlfriend/setup?new=1" className={styles.createCard}>
          <span className={styles.createIcon}>✨</span>
          <span className={styles.createTitle}>Create New</span>
          <span className={styles.createSubtext}>Companion</span>
        </Link>
      </div>
    </div>
  );
};
