import type { PropsWithChildren } from 'react';
import { SectionShell } from '@/components/layout/section-shell';
import { redirectAuthenticatedUser } from '@/lib/auth/server';

export default async function AuthLayout({ children }: PropsWithChildren) {
  await redirectAuthenticatedUser('/dashboard');

  return <SectionShell>{children}</SectionShell>;
}
