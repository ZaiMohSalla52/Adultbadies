import type { PropsWithChildren } from 'react';
import { PublicFooter } from '@/components/layout/public-footer';
import { PublicNavigation } from '@/components/layout/public-navigation';

export default function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="marketing-shell">
      <PublicNavigation />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
