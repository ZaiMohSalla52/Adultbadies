import type { PropsWithChildren } from 'react';
import { SectionShell } from '@/components/layout/section-shell';

export default function PublicLayout({ children }: PropsWithChildren) {
  return <SectionShell>{children}</SectionShell>;
}
