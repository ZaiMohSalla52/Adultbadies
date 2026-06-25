'use client';

import Link from 'next/link';
import { Fragment, useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import styles from './app-shell-nav.module.css';

export type AppNavItem = {
  label: string;
  href: string;
};

export const AppShellNav = ({ items, mobile = false }: { items: readonly AppNavItem[]; mobile?: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) setPendingHref(null);
  }, [isPending]);

  const handleNavClick = (href: string) => {
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  const NavIcon = ({ label }: { label: string }) => {
    switch (label) {
      case 'Explore':
      case 'Discovery':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
      case 'Chats':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        );
      case 'Create':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
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
    if (pathname.startsWith('/virtual-girlfriend/chat')) {
      return null;
    }

    return (
      <nav className={styles.mobileNav} aria-label="Authenticated navigation mobile">
        {items.map((item) => {
          const hrefPath = item.href.split('?')[0];
          const isActive = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
          const isItemPending = isPending && pendingHref === item.href;

          return (
            <a
              key={item.href}
              href={item.href}
              className={isActive ? styles.tabActive : styles.tab}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); handleNavClick(item.href); }}
            >
              <span className={`${styles.tabIcon}${isItemPending ? ` ${styles.tabIconPending}` : ''}`}>
                {isItemPending ? <span className={styles.navSpinner} aria-hidden /> : <NavIcon label={item.label} />}
              </span>
              <span className={styles.tabLabel}>{item.label}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Link href="/discovery" className={styles.brandLink} aria-label="Adult Badies explore">
          <span className={styles.brandMark} aria-hidden>
            AB
          </span>
          <span className={styles.brandName}>Adult Badies</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="Authenticated navigation">
        {items.map((item) => {
          const hrefPath = item.href.split('?')[0];
          const isActive = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
          const isItemPending = isPending && pendingHref === item.href;

          return (
            <Fragment key={item.href}>
              {item.label === 'Account' ? <div className={styles.navSpacer} aria-hidden /> : null}
              <a
                href={item.href}
                className={isItemPending ? styles.navItemPending : isActive ? styles.navItemActive : styles.navItem}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); handleNavClick(item.href); }}
              >
                <span className={styles.navIcon}>
                  {isItemPending ? <span className={styles.navSpinner} aria-hidden /> : <NavIcon label={item.label} />}
                </span>
                <span className={styles.navLabel}>{item.label}</span>
              </a>
            </Fragment>
          );
        })}
      </nav>

      <div className={styles.sidebarPromo}>
        <p className={styles.sidebarPromoText}>Create a custom girlfriend or boyfriend in minutes.</p>
        <Link href="/virtual-girlfriend/setup?new=1" className={styles.sidebarPromoBtn}>
          Create character
        </Link>
      </div>

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