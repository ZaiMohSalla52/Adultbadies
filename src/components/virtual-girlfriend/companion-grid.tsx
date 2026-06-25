'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CompanionCardDeleteButton } from '@/components/virtual-girlfriend/companion-card-delete-button';
import type { VirtualGirlfriendCompanionRecord, VirtualGirlfriendCompanionStatus } from '@/lib/virtual-girlfriend/types';

export type CompanionGridCard = {
  companion: VirtualGirlfriendCompanionRecord;
  imageUrl: string | null;
  status: VirtualGirlfriendCompanionStatus;
  isActive: boolean;
  chatReady: boolean;
  href: string;
};

export const CompanionGrid = ({ cards }: { cards: CompanionGridCard[] }) => (
  <div className="ai-gf-grid">
    {cards.map(({ companion, imageUrl, status, isActive, chatReady, href }) => (
      <div key={companion.id} className="ai-gf-card-wrap">
        <Link href={href} className="ai-gf-card">
          <div className="ai-gf-card-img">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={companion.name}
                fill
                sizes="(max-width: 480px) 50vw, 160px"
                className="ai-gf-card-photo"
              />
            ) : (
              <div className="ai-gf-card-fallback">
                {companion.name.charAt(0).toUpperCase()}
              </div>
            )}
            {isActive && <span className="ai-gf-badge ai-gf-badge--active">Active</span>}
            {(status === 'generating' || status === 'review_pending') && (
              <span className="ai-gf-badge ai-gf-badge--generating">Generating…</span>
            )}
            {status === 'failed' && (
              <span className="ai-gf-badge ai-gf-badge--failed">Needs setup</span>
            )}
          </div>
          <div className="ai-gf-card-body">
            <strong className="ai-gf-card-name">{companion.name}</strong>
            <p className="ai-gf-card-bio">
              {companion.display_bio || companion.archetype || 'AI Companion'}
            </p>
            <span className="ai-gf-card-cta">
              {chatReady ? 'Chat Now →' : 'View Profile →'}
            </span>
          </div>
        </Link>
        <CompanionCardDeleteButton companionId={companion.id} companionName={companion.name} />
      </div>
    ))}

    <Link href="/virtual-girlfriend/setup?new=1" className="ai-gf-create">
      <span className="ai-gf-create-icon">✨</span>
      <span className="ai-gf-create-label">Create New</span>
      <span className="ai-gf-create-sub">AI Companion</span>
    </Link>
  </div>
);