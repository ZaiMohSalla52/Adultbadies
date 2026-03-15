'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AppNavItem = {
  label: string;
  href: string;
};

export const AppShellNav = ({ items, mobile = false }: { items: readonly AppNavItem[]; mobile?: boolean }) => {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const className = mobile
          ? `app-shell-mobile-link ${isActive ? 'app-shell-mobile-link-active' : ''}`
          : `app-shell-nav-link ${isActive ? 'app-shell-nav-link-active' : ''}`;

        return (
          <Link key={item.href} href={item.href} className={className} aria-current={isActive ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
};
