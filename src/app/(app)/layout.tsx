import type { PropsWithChildren } from 'react';
import Link from 'next/link';
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <strong>Application</strong>
          <p className="my-0 text-sm text-muted">Signed in as {user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors hover:bg-surface-2">
            Dashboard
          </Link>
          <Link href="/discovery" className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors hover:bg-surface-2">
            Discover
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      <nav className="mb-6 flex gap-4">
        <Link className="text-sm" href="/discovery">
          Discovery
        </Link>
        <Link className="text-sm" href="/matches">
          Matches
        </Link>
      </nav>

      {children}
    </SectionShell>
  );
}
