import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { AppShellNav } from '@/components/layout/app-shell-nav';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const appNavItems = [
  { label: 'Discovery', href: '/discovery' },
  { label: 'Matches', href: '/matches' },
  { label: 'Premium', href: '/premium' },
  { label: 'Account', href: '/account' },
] as const;

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  return (
    <div className="app-shell">
      <header className="app-shell-header ui-glass">
        <Link href="/discovery" className="marketing-brand" aria-label="Adult Badies discovery">
          <span className="marketing-brand-mark" aria-hidden>
            AB
          </span>
          <span>Adult Badies</span>
        </Link>

        <nav className="app-shell-nav" aria-label="Authenticated navigation">
          <AppShellNav items={appNavItems} />
        </nav>

        <form action={signOutAction} className="app-shell-signout-form">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </header>

      <main className="app-shell-main">{children}</main>

      <nav className="app-shell-mobile-nav ui-glass" aria-label="Authenticated navigation mobile">
        <AppShellNav items={appNavItems} mobile />
      </nav>
    </div>
  );
}
