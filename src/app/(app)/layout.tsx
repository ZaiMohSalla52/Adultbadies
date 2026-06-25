import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AppShellNav } from '@/components/layout/app-shell-nav';
import { AppTopBar } from '@/components/layout/app-top-bar';
import { AgeCacheWarmer } from '@/components/safety/age-cache-warmer';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import {
  getAgeVerification,
  getCachedAgeVerifiedUserId,
  isAgeVerified,
} from '@/lib/safety/age';

const desktopNavItems = [
  { label: 'Explore', href: '/discovery' },
  { label: 'Chats', href: '/chats' },
  { label: 'AI Boyfriend', href: '/discovery?tab=boyfriends' },
  { label: 'AI Girlfriend', href: '/discovery?tab=girlfriends' },
  { label: 'Generate Photo', href: '/virtual-girlfriend/generate' },
  { label: 'Gallery', href: '/virtual-girlfriend/generate' },
  { label: 'Account', href: '/account' },
] as const;

const mobileNavItems = [
  { label: 'Explore', href: '/discovery', mobile: true },
  { label: 'Chats', href: '/chats', mobile: true },
  { label: 'Create', href: '/virtual-girlfriend/setup?new=1', mobile: true },
  { label: 'Account', href: '/account', mobile: true },
] as const;

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  const cachedAgeUserId = await getCachedAgeVerifiedUserId();
  if (cachedAgeUserId !== user.id) {
    const ageVerification = await getAgeVerification(accessToken, user.id);
    if (!isAgeVerified(ageVerification)) {
      redirect('/age-verification');
    }
  }

  return (
    <div className="app-shell">
      <AgeCacheWarmer />
      <AppTopBar />
      <Suspense fallback={null}>
        <AppShellNav items={desktopNavItems} />
      </Suspense>

      <main className="app-shell-main">{children}</main>

      <Suspense fallback={null}>
        <AppShellNav items={mobileNavItems} mobile />
      </Suspense>
    </div>
  );
}