'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app-top-bar.module.css';

export const AppTopBar = () => {
  const pathname = usePathname();
  const isChat = pathname.startsWith('/virtual-girlfriend/chat');

  return (
    <header className={`${styles.topBar}${isChat ? ` ${styles.topBarHiddenOnMobileChat}` : ''}`}>
      <Link href="/discovery" className={styles.brand} aria-label="Adult Badies home">
        <span className={styles.brandIcon} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
        <span className={styles.brandText}>
          Adult <span className={styles.brandAccent}>Badies</span>
        </span>
      </Link>

      <div className={styles.actions}>
        {!isChat ? (
          <Link href="/premium" className={styles.premiumBtn}>
            Join Premium
          </Link>
        ) : null}
        <Link href="/account" className={styles.accountBtn} aria-label="Account">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
      </div>
    </header>
  );
};