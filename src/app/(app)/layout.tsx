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
      <div className="flex justify-between mb-6">
        <strong>Application</strong>
        <span className="text-sm text-muted">User-facing area</span>
      </div>
      {children}
    </SectionShell>
  );
}
