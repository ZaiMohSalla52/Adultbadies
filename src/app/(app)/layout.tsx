import type { PropsWithChildren } from 'react';
import { redirect } from 'next/navigation';
import { AppShellNav } from '@/components/layout/app-shell-nav';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getAgeVerification, isAgeVerified } from '@/lib/safety/age';

const appNavItems = [
  { label: 'Discovery', href: '/discovery' },
  { label: 'Matches', href: '/matches' },
  { label: 'Chats', href: '/chats' },
  { label: 'AI Girlfriend', href: '/virtual-girlfriend' },
  { label: 'Create', href: '/virtual-girlfriend/setup?new=1' },
  { label: 'Account', href: '/account' },
] as const;

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  const ageVerification = await getAgeVerification(accessToken, user.id);
  if (!isAgeVerified(ageVerification)) {
    redirect('/age-verification');
  }

  return (
    <div className="app-shell">
      <AppShellNav items={appNavItems} />

      <main className="app-shell-main">{children}</main>

      <AppShellNav items={appNavItems} mobile />
    </div>
  );
}
