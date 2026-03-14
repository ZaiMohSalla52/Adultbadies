import type { PropsWithChildren } from 'react';
import { SectionShell } from '@/components/layout/section-shell';

export default function AppLayout({ children }: PropsWithChildren) {
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
