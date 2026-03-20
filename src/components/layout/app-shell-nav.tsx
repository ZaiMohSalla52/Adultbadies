'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import styles from './app-shell-nav.module.css';

export type AppNavItem = {
  label: string;
  href: string;
};

export const AppShellNav = ({ items, mobile = false }: { items: readonly AppNavItem[]; mobile?: boolean }) => {
  const pathname = usePathname();
  const NavIcon = ({ label }: { label: string }) => {
    switch (label) {
      case 'Discovery':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
      case 'Matches':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        );
      case 'Chats':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        );
      case 'Virtual Girlfriend':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'Account':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      default:
        return <span>•</span>;
    }
  };

  if (mobile) {
    // Hide mobile nav on VG chat page (full screen chat)
    if (pathname.startsWith('/virtual-girlfriend/chat')) {
      return null;
    }

    const mobileTabs = items.filter((item) => item.label !== 'Matches');

    return (
      <nav className={styles.mobileNav} aria-label="Authenticated navigation mobile">
        {mobileTabs.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? styles.tabActive : styles.tab}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.tabIcon}>
                <NavIcon label={item.label} />
              </span>
              <span className={styles.tabLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Link href="/discovery" className={styles.brandLink} aria-label="Adult Badies discovery">
          <span className={styles.brandMark} aria-hidden>
            AB
          </span>
          <span className={styles.brandName}>Adult Badies</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="Authenticated navigation">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Fragment key={item.href}>
              {item.label === 'Account' ? <div className={styles.navSpacer} aria-hidden /> : null}
              <Link
                href={item.href}
                className={isActive ? styles.navItemActive : styles.navItem}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <NavIcon label={item.label} />
                </span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            </Fragment>
          );
        })}
      </nav>

      <div className={styles.sidebarBottom}>
        <form action={signOutAction}>
          <button type="submit" className={styles.signOutBtn}>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
};
