import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import { SectionShell } from '@/components/layout/section-shell';
import { Button } from '@/components/ui/button';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const navItems = [
  { href: '/discovery', label: 'Discover' },
  { href: '/matches', label: 'Matches' },
  { href: '/premium', label: 'Premium' },
];

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  const entitlements = await getUserEntitlements(accessToken, user.id);

  return (
    <SectionShell>
      <div className="ui-glass" style={{ borderRadius: '20px', padding: '0.9rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong className="hero-gradient-text" style={{ fontSize: '1.1rem' }}>Adult Badies</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">Sign out</Button>
          </form>
        </div>
      </div>

      {children}

      <div className="mobile-bottom-nav">
        <div className="ui-glass" style={{ borderRadius: '999px', padding: '0.45rem', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '0.4rem' }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="ui-button ui-button-ghost" style={{ height: '2.35rem' }}>
              {item.label}
            </Link>
          ))}
          <span className="ui-button ui-button-secondary" style={{ height: '2.35rem', fontSize: '0.75rem' }}>
            {entitlements.isPremium ? 'Premium' : 'Free'}
          </span>
        </div>
      </div>
    </SectionShell>
  );
}
