import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'ui-button-primary',
  secondary: 'ui-button-secondary',
  ghost: 'ui-button-ghost',
};

export const Button = ({ className, variant = 'primary', ...props }: ButtonProps) => (
  <button className={cn('ui-button', variantStyles[variant], className)} {...props} />
);
