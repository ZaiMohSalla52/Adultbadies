'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import styles from './app-shell-nav.module.css';

export type AppNavItem = {
  label: string;
  href: string;
};

export const AppShellNav = ({ items, mobile = false }: { items: readonly AppNavItem[]; mobile?: boolean }) => {
  const pathname = usePathname();
  const iconByLabel: Record<string, string> = {
    Discovery: '🔍',
    Matches: '❤️',
    Chats: '💬',
    'Virtual Girlfriend': '👩',
    Account: '⚙️',
  };

  if (mobile) {
    const mobileTabs = items.filter((item) => item.label !== 'Matches');

    return (
      <nav className={styles.mobileNav} aria-label="Authenticated navigation mobile">
        {mobileTabs.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const icon = iconByLabel[item.label] ?? '•';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? styles.tabActive : styles.tab}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.tabIcon}>{icon}</span>
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
          const icon = iconByLabel[item.label] ?? '•';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? styles.navItemActive : styles.navItem}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
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
