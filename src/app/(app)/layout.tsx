import type { PropsWithChildren } from 'react';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/(auth)/actions';
import { SectionShell } from '@/components/layout/section-shell';
import { Button } from '@/components/ui/button';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  return (
    <SectionShell>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">Sign out</Button>
        </form>
      </div>
      {children}
    </SectionShell>
  );
}
