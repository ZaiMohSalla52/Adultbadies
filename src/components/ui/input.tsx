import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-brand transition focus:ring-2',
      className,
    )}
    {...props}
  />
);
