import type { PropsWithChildren } from 'react';

export const SectionShell = ({ children }: PropsWithChildren) => (
  <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
);
