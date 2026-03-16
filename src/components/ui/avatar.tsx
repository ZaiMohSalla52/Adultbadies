import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
type AvatarVariant = 'circle' | 'rounded';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'avatar-size-xs',
  sm: 'avatar-size-sm',
  md: 'avatar-size-md',
  lg: 'avatar-size-lg',
  xl: 'avatar-size-xl',
  hero: 'avatar-size-hero',
};

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  kind?: 'human' | 'ai';
  size?: AvatarSize;
  variant?: AvatarVariant;
  ring?: boolean;
  isActive?: boolean;
  isLive?: boolean;
  unreadCount?: number;
  className?: string;
  objectPosition?: string;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const Avatar = ({
  name,
  imageUrl,
  kind = 'human',
  size = 'md',
  variant = 'circle',
  ring = false,
  isActive = false,
  isLive = false,
  unreadCount,
  className,
  objectPosition = 'center',
}: AvatarProps) => {
  const hasUnread = typeof unreadCount === 'number' && unreadCount > 0;

  return (
    <div
      className={cn(
        'avatar-root',
        SIZE_CLASS[size],
        variant === 'circle' ? 'avatar-circle' : 'avatar-rounded',
        ring ? 'avatar-ring' : '',
        kind === 'ai' ? 'avatar-ai' : '',
        className,
      )}
      aria-label={`${name} profile image`}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill sizes="96px" className="avatar-image" style={{ objectPosition }} unoptimized />
      ) : (
        <div className="avatar-fallback" aria-hidden>
          <span>{getInitials(name)}</span>
        </div>
      )}

      {isActive ? <span className="avatar-presence-dot" aria-label="Active" /> : null}
      {isLive ? <span className="avatar-live-badge">Live</span> : null}
      {hasUnread ? <span className="avatar-unread-badge">{unreadCount! > 99 ? '99+' : unreadCount}</span> : null}
    </div>
  );
};

export const ProfileMediaFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={cn('profile-media-frame', className)}>{children}</div>;
