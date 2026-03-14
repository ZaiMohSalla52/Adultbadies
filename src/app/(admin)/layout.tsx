import type { PropsWithChildren } from 'react';
import { SectionShell } from '@/components/layout/section-shell';

export default function AdminLayout({ children }: PropsWithChildren) {
  return (
    <SectionShell>
      <div className="flex justify-between mb-6">
        <strong>Admin</strong>
        <span className="text-sm text-muted">Restricted control surface</span>
      </div>
      {children}
    </SectionShell>
  );
}
