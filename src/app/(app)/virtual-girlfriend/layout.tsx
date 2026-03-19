import type { ReactNode } from 'react';
import { VGSidebar } from '@/components/virtual-girlfriend/vg-sidebar';
import { VGMobileNav } from '@/components/virtual-girlfriend/vg-mobile-nav';

export default function VirtualGirlfriendLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="virtual-girlfriend-layout">
      <VGSidebar />
      <main className="virtual-girlfriend-main">{children}</main>
      <VGMobileNav />
    </div>
  );
}
