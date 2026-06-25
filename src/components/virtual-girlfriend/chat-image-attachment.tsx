'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';
import styles from './chat-client.module.css';

export const ChatImageAttachment = ({
  attachment,
  companionName,
  initialUnlocked,
  balance: initialBalance,
  unblurCost,
  isPremium,
  onUnlocked,
}: {
  attachment: VirtualGirlfriendMessageAttachment;
  companionName: string;
  initialUnlocked: boolean;
  balance: number;
  unblurCost: number;
  isPremium: boolean;
  onUnlocked?: (imageId: string, nextBalance: number) => void;
}) => {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [balance, setBalance] = useState(initialBalance);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setUnlocked(initialUnlocked);
  }, [initialUnlocked, attachment.imageId]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const handleUnlock = async () => {
    setError(null);
    setPending(true);
    try {
      const response = await fetch('/api/points/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: attachment.imageId }),
      });
      const data = (await response.json()) as { ok?: boolean; balance?: number; error?: string; code?: string };

      if (response.status === 402 || data.code === 'INSUFFICIENT_POINTS') {
        setBalance(data.balance ?? balance);
        setError('Not enough points to unblur.');
        return;
      }
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Unable to unblur right now.');
        return;
      }

      setUnlocked(true);
      const nextBalance = typeof data.balance === 'number' ? data.balance : balance;
      if (typeof data.balance === 'number') setBalance(nextBalance);
      onUnlocked?.(attachment.imageId, nextBalance);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(attachment.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${companionName.replace(/\s+/g, '-').toLowerCase()}-photo.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(attachment.imageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div className={`${styles.chatImage} ${styles.chatImageReveal}`}>
        <button
          type="button"
          className={styles.chatImageTap}
          onClick={() => setExpanded(true)}
          aria-label={unlocked ? `View ${companionName} photo` : `View blurred ${companionName} photo`}
        >
          <Image
            src={attachment.imageUrl}
            alt={`${companionName} photo`}
            width={attachment.width ?? 768}
            height={attachment.height ?? 1024}
            sizes="(max-width: 768px) 220px, 240px"
            className={unlocked ? styles.chatImageSharp : styles.chatImageBlurred}
          />
        </button>
        {!unlocked ? (
          <div className={styles.chatImageLock}>
            <button type="button" className={styles.chatImageUnlockBtn} onClick={() => void handleUnlock()} disabled={pending}>
              {pending ? 'Unblurring…' : `Unblur for 💜 ${unblurCost}`}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.chatImageDownload} onClick={() => void handleDownload()} aria-label="Download photo">
            ↓
          </button>
        )}
        {error ? (
          <p className={styles.chatImageError}>
            {error}{' '}
            {!isPremium ? (
              <Link href="/premium" className={styles.chatImageUpgrade}>
                Get Premium
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      {expanded ? (
        <div className={styles.chatImageLightbox} role="dialog" aria-modal="true" aria-label={`${companionName} photo`}>
          <button type="button" className={styles.chatImageLightboxBackdrop} aria-label="Close photo" onClick={() => setExpanded(false)} />
          <div className={styles.chatImageLightboxBody}>
            <button type="button" className={styles.chatImageLightboxClose} onClick={() => setExpanded(false)} aria-label="Close photo">
              ✕
            </button>
            <Image
              src={attachment.imageUrl}
              alt={`${companionName} photo full view`}
              width={attachment.width ?? 1024}
              height={attachment.height ?? 1024}
              sizes="100vw"
              className={unlocked ? styles.chatImageLightboxSharp : styles.chatImageLightboxBlurred}
            />
            {!unlocked ? (
              <div className={styles.chatImageLightboxLock}>
                <button type="button" className={styles.chatImageUnlockBtn} onClick={() => void handleUnlock()} disabled={pending}>
                  {pending ? 'Unblurring…' : `Unblur for 💜 ${unblurCost}`}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};