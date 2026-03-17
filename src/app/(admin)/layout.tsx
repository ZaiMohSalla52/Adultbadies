import type { PropsWithChildren } from 'react';
import { SectionShell } from '@/components/layout/section-shell';
import { requireAdminReviewer } from '@/lib/auth/admin';

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdminReviewer();

  return (
    <SectionShell>
      <div className="mb-6 flex justify-between">
        <strong>Admin</strong>
        <span className="text-sm text-muted">Restricted control surface</span>
      </div>
      {children}
    </SectionShell>
  );
}
