'use client';

import Link from 'next/link';
import { Fragment, useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from './app-shell-nav.module.css';

export type AppNavItem = {
  label: string;
  href: string;
  mobile?: boolean;
};

const isNavActive = (pathname: string, searchParams: URLSearchParams, item: AppNavItem) => {
  const hrefPath = item.href.split('?')[0];
  const hrefQuery = item.href.includes('?') ? new URLSearchParams(item.href.split('?')[1]) : null;

  if (item.label === 'Chats') {
    return pathname === '/chats' || pathname.startsWith('/virtual-girlfriend/chat');
  }

  if (hrefQuery?.get('tab')) {
    return pathname === hrefPath && searchParams.get('tab') === hrefQuery.get('tab');
  }

  if (item.label === 'Explore') {
    return pathname === '/discovery' && !searchParams.get('tab');
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
};

export const AppShellNav = ({ items, mobile = false }: { items: readonly AppNavItem[]; mobile?: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const visibleItems = items.filter((item) => (mobile ? item.mobile !== false : true));

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
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        );
      case 'Chats':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        );
      case 'AI Boyfriend':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
          </svg>
        );
      case 'AI Girlfriend':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
            <path d="M12 12v2" />
          </svg>
        );
      case 'Generate Photo':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        );
      case 'Gallery':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        );
      case 'Account':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      case 'Create':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
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
        {visibleItems.map((item) => {
          const isActive = isNavActive(pathname, searchParams, item);
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
      <nav className={styles.nav} aria-label="Authenticated navigation">
        {visibleItems.map((item) => {
          const isActive = isNavActive(pathname, searchParams, item);
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
                {isActive ? <span className={styles.navActiveDot} aria-hidden /> : null}
              </a>
            </Fragment>
          );
        })}
      </nav>

      <div className={styles.sidebarPromo}>
        <Link href="/virtual-girlfriend/setup?new=1" className={styles.createPromoBtn}>
          <span className={styles.createPromoIcon} aria-hidden>✨</span>
          Create Unique Digital Persona
        </Link>
        <Link href="/premium" className={styles.premiumPromoBtn}>
          <span className={styles.premiumPromoIcon} aria-hidden>👑</span>
          Join Premium
        </Link>
        <p className={styles.premiumPromoSub}>1 point per message · monthly points stipend</p>
      </div>
    </aside>
  );
};