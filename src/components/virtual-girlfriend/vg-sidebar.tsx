'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './vg-sidebar.module.css';

const NAV_ITEMS = [
  { label: 'Explore', href: '/virtual-girlfriend', icon: '🏠' },
  { label: 'Chats', href: '/virtual-girlfriend/chat', icon: '💬' },
  { label: 'Gallery', href: '/virtual-girlfriend/gallery', icon: '🖼️' },
  { label: 'Profile', href: '/virtual-girlfriend/profile', icon: '👤' },
] as const;

export const VGSidebar = () => {
  const pathname = usePathname();

  if (pathname.startsWith('/virtual-girlfriend/setup')) {
    return null;
  }

  return (
    <>
      <div className={styles.sidebarOffset} aria-hidden />
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/virtual-girlfriend'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <Link href="/virtual-girlfriend/setup?new=1" className={styles.createCta}>
            <span className={styles.createIcon}>✨</span>
            <span>Create Companion</span>
          </Link>
        </div>
      </aside>
    </>
  );
};
