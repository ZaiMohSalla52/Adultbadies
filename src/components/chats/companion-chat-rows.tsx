'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';

export type VGThreadItem = {
  id: string;
  companionId: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  href: string;
  preview: string | null;
  lastActivityAt: string;
  lastMessageSenderId: string | null;
  userId: string;
  isNew: boolean;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  if (diffDays < 7) return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export function CompanionChatRows({ items }: { items: VGThreadItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      {items.map((item) => {
        const yourMove = item.lastMessageSenderId !== null && item.lastMessageSenderId !== item.userId;
        return (
          <button
            key={item.id}
            type="button"
            className="chats-item chats-item-btn"
            onClick={() => setOpenId(item.id)}
          >
            <Avatar
              name={item.name}
              imageUrl={item.avatarUrl}
              kind="ai"
              size="lg"
              ring
              isActive
            />
            <div className="chats-item-body">
              <div className="chats-item-top">
                <span className="chats-item-name">{item.name}</span>
                {yourMove && <span className="chats-your-move-badge">YOUR MOVE</span>}
                <span className="chats-item-time">{formatDate(item.lastActivityAt)}</span>
              </div>
              <div className="chats-item-bottom">
                <span className="chats-item-preview">{item.preview ?? 'No messages yet.'}</span>
                <span className="chats-item-star">☆</span>
              </div>
            </div>
          </button>
        );
      })}

      {active && (
        <div
          className="companion-preview-backdrop"
          onClick={() => setOpenId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${active.name} profile`}
        >
          <div className="companion-preview-card" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button
              type="button"
              className="companion-preview-close"
              onClick={() => setOpenId(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="companion-preview-img">
              {active.avatarUrl ? (
                <Image
                  src={active.avatarUrl}
                  alt={active.name}
                  fill
                  unoptimized
                  className="companion-preview-photo"
                />
              ) : (
                <div className="companion-preview-fallback">
                  {active.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="companion-preview-body">
              <strong className="companion-preview-name">{active.name}</strong>
              {active.bio && <p className="companion-preview-bio">{active.bio}</p>}
              <Link href={active.href} className="ui-button ui-button-primary companion-preview-cta">
                Chat Now →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
