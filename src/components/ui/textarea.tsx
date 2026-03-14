import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      'w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground outline-none ring-brand transition focus:ring-2',
      className,
    )}
    {...props}
  />
);
