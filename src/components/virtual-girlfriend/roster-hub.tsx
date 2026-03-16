'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendCompanionStatus,
} from '@/lib/virtual-girlfriend/types';

type RosterItem = {
  companion: VirtualGirlfriendCompanionRecord;
  image: VirtualGirlfriendCompanionImageRecord | null;
  status: VirtualGirlfriendCompanionStatus;
};

const CompanionCard = ({
  item,
  isActive,
  pending,
  pendingId,
  onSwitch,
}: {
  item: RosterItem;
  isActive: boolean;
  pending: boolean;
  pendingId: string | null;
  onSwitch: (companionId: string) => void;
}) => {
  const { companion, image, status } = item;
  const statusLabel = isActive ? 'active' : status;

  return (
    <article className={`vg-roster-card ${isActive ? 'vg-roster-card-active' : ''}`}>
      <div className="vg-roster-image-wrap">
        {image ? (
          <Image src={image.delivery_url} alt={`${companion.name} portrait`} fill className="object-cover" />
        ) : (
          <div className="vg-roster-image-empty">Portrait preparing</div>
        )}
      </div>

      <div className="vg-roster-copy">
        <div className="vg-roster-meta-row">
          <p className="my-0 text-xs text-muted">{companion.archetype ?? 'Virtual Companion'}</p>
          <span className={`vg-status-pill vg-status-pill-${statusLabel}`}>{statusLabel}</span>
        </div>
        <h2 className="my-0">{companion.name}</h2>
        <p className="my-0 text-sm text-muted">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
        <p className="my-0 text-xs text-muted">
          {(companion.profile_tags ?? []).slice(0, 3).join(' • ') || companion.tone || 'Distinct chemistry'}
        </p>
        {status === 'generating' ? <p className="my-0 text-xs text-muted">Generating photos and finishing setup…</p> : null}
        {status === 'failed' ? (
          <p className="my-0 text-xs text-muted">Image generation failed earlier. Open profile and create another if needed.</p>
        ) : null}
      </div>

      <div className="vg-roster-actions">
        <Link href={`/virtual-girlfriend/profile?companionId=${companion.id}`} className="ui-button ui-button-ghost vg-secondary-action">
          View profile
        </Link>
        <Button type="button" onClick={() => onSwitch(companion.id)} disabled={pending && pendingId === companion.id}>
          {pending && pendingId === companion.id ? 'Switching…' : isActive ? 'Open active' : 'Make active'}
        </Button>
      </div>
    </article>
  );
};

export const VirtualGirlfriendRosterHub = ({
  items,
  activeCompanionId,
  entitlements,
}: {
  items: RosterItem[];
  activeCompanionId: string | null;
  entitlements: Entitlements;
}) => {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const uniqueItems = useMemo(() => Array.from(new Map(items.map((item) => [item.companion.id, item])).values()), [items]);
  const activeItem = uniqueItems.find((item) => item.companion.id === activeCompanionId) ?? uniqueItems[0] ?? null;
  const otherItems = uniqueItems.filter((item) => item.companion.id !== activeItem?.companion.id && item.status !== 'generating');
  const pendingItems = uniqueItems.filter((item) => item.status === 'generating' && item.companion.id !== activeItem?.companion.id);

  const onSwitch = (companionId: string) => {
    if (pending || companionId === activeCompanionId) {
      router.push(`/virtual-girlfriend/profile?companionId=${companionId}`);
      return;
    }

    startTransition(async () => {
      setPendingId(companionId);
      const response = await fetch('/api/virtual-girlfriend/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });

      if (!response.ok) {
        setPendingId(null);
        return;
      }

      router.push(`/virtual-girlfriend/profile?companionId=${companionId}`);
      router.refresh();
    });
  };

  return (
    <div className="app-page-stack">
      <Card className="app-page-header vg-hub-header">
        <p className="chat-label">Virtual Girlfriend</p>
        <h1 className="my-0">Your companion library</h1>
        <p className="my-0 text-muted">Browse distinct profiles, keep relationships separate, and switch who is active anytime.</p>
        <p className="my-0 text-xs text-muted">
          {entitlements.isPremium
            ? 'Premium membership is active. Companion limits may expand over time.'
            : 'Companion limits by membership tier are rolling out soon. Your existing companions remain available.'}
        </p>
      </Card>

      {activeItem ? (
        <section className="vg-hub-section">
          <div className="vg-section-heading">
            <h2 className="my-0 text-base font-semibold">Active companion</h2>
          </div>
          <CompanionCard item={activeItem} isActive pending={pending} pendingId={pendingId} onSwitch={onSwitch} />
        </section>
      ) : null}

      {otherItems.length ? (
        <section className="vg-hub-section">
          <div className="vg-section-heading">
            <h2 className="my-0 text-base font-semibold">Other available companions</h2>
          </div>
          <div className="vg-roster-grid">
            {otherItems.map((item) => (
              <CompanionCard
                key={item.companion.id}
                item={item}
                isActive={false}
                pending={pending}
                pendingId={pendingId}
                onSwitch={onSwitch}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pendingItems.length ? (
        <section className="vg-hub-section">
          <div className="vg-section-heading">
            <h2 className="my-0 text-base font-semibold">Pending / generating</h2>
          </div>
          <div className="vg-roster-grid">
            {pendingItems.map((item) => (
              <CompanionCard
                key={item.companion.id}
                item={item}
                isActive={false}
                pending={pending}
                pendingId={pendingId}
                onSwitch={onSwitch}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Card className="app-surface-card">
        <h2 className="my-0 text-base font-semibold">Create another Virtual Girlfriend</h2>
        <p className="my-0 text-sm text-muted">Build a separate companion record with its own profile, gallery, and memory timeline.</p>
        <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-primary">
          Create another companion
        </Link>
      </Card>
    </div>
  );
};
