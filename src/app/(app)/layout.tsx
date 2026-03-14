import type { PropsWithChildren } from 'react';
import { redirect } from 'next/navigation';
import { SectionShell } from '@/components/layout/section-shell';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function AppLayout({ children }: PropsWithChildren) {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  return (
    <SectionShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <strong>Application</strong>
          <p className="my-0 text-sm text-muted">Signed in as {user.email}</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
      {children}
    </SectionShell>
  );
}
