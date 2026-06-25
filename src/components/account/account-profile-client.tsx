'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './account-profile.module.css';

type AccountProfileClientProps = {
  email: string;
  displayName: string;
  isPremium: boolean;
  pointBalance: number;
  membershipState: string;
};

export const AccountProfileClient = ({
  email,
  displayName,
  isPremium,
  pointBalance,
  membershipState,
}: AccountProfileClientProps) => {
  const [view, setView] = useState<'main' | 'settings'>('main');

  if (view === 'settings') {
    return (
      <div className={styles.page}>
        <header className={styles.mobileHeader}>
          <button type="button" className={styles.backButton} onClick={() => setView('main')} aria-label="Back to profile">
            ‹
          </button>
          <span className={styles.headerTitle}>Account settings</span>
          <span className={styles.pointsBadge}>💜 {pointBalance}</span>
        </header>

        <section className={styles.settingsCard}>
          <h3 className={styles.settingsTitle}>Account settings</h3>
          <dl className={styles.settingsList}>
            <div>
              <dt>Display name</dt>
              <dd>{displayName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Points balance</dt>
              <dd>💜 {pointBalance}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{isPremium ? 'Premium' : 'Free'}</dd>
            </div>
          </dl>
          <p className={styles.settingsHint}>
            Photos in chat and gallery stay blurred until you spend points to unblur them — premium included.
          </p>
        </section>

        <section className={styles.linksCard}>
          <Link href="/premium" className={styles.linkRow}>
            Points & Premium <span>›</span>
          </Link>
          <Link href="/chats" className={styles.linkRow}>
            Chats <span>›</span>
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.mobileHeader}>
        <Link href="/discovery" className={styles.backButton} aria-label="Back">
          ‹
        </Link>
        <span className={styles.headerTitle}>Profile</span>
        <span className={styles.pointsBadge}>💜 {pointBalance}</span>
      </header>

      {!isPremium ? (
        <section className={styles.premiumCard}>
          <h2 className={styles.premiumTitle}>Join 👑 Premium</h2>
          <ul className={styles.premiumList}>
            <li>🎁 Monthly points stipend for unblurs</li>
            <li>💬 More chat momentum every month</li>
            <li>👩‍🎤 Create custom AI companions</li>
            <li>💖 Premium discovery perks</li>
          </ul>
          <Link href="/premium" className={styles.subscribeBtn}>
            Subscribe
          </Link>
        </section>
      ) : (
        <section className={styles.premiumCardActive}>
          <h2 className={styles.premiumTitle}>👑 Premium active</h2>
          <p className={styles.premiumMeta}>Status: {membershipState.replace(/_/g, ' ')}</p>
          <Link href="/premium" className={styles.manageBtn}>
            Manage plan
          </Link>
        </section>
      )}

      <button type="button" className={styles.userCard} onClick={() => setView('settings')}>
        <div className={styles.userAvatar} aria-hidden>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className={styles.userInfo}>
          <strong className={styles.userName}>{displayName}</strong>
          <span className={styles.userEmail}>{email}</span>
        </div>
        <span className={styles.userChevron} aria-hidden>›</span>
      </button>

      <section className={styles.linksCard}>
        <Link href="/chats" className={styles.linkRow}>
          Chats <span>›</span>
        </Link>
        <Link href="/premium" className={styles.linkRow}>
          Points & Premium <span>›</span>
        </Link>
        <Link href="/virtual-girlfriend/setup?new=1" className={styles.linkRow}>
          Create companion <span>›</span>
        </Link>
      </section>
    </div>
  );
};