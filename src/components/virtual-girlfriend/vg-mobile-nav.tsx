'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './vg-mobile-nav.module.css';

const TABS = [
  { label: 'Explore', href: '/virtual-girlfriend', icon: '🏠' },
  { label: 'Create', href: '/virtual-girlfriend/setup?new=1', icon: '✨' },
  { label: 'Gallery', href: '/virtual-girlfriend/gallery', icon: '🖼️' },
  { label: 'Chats', href: '/virtual-girlfriend/chat', icon: '💬' },
] as const;

export const VGMobileNav = () => {
  const pathname = usePathname();

  if (pathname.startsWith('/virtual-girlfriend/chat')) return null;
  if (pathname.startsWith('/virtual-girlfriend/setup')) return null;

  return (
    <nav className={styles.mobileNav}>
      {TABS.map((tab) => {
        const tabPath = tab.href.split('?')[0];
        const isActive = pathname === tabPath;

        return (
          <Link key={tab.href} href={tab.href} className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}>
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
