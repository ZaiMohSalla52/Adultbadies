'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActiveCompanionPanel } from '@/components/virtual-girlfriend/active-companion-panel';
import { CompanionLibraryCard } from '@/components/virtual-girlfriend/companion-library-card';
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
  const otherItems = uniqueItems.filter(
    (item) => item.companion.id !== activeItem?.companion.id && item.status !== 'generating' && item.status !== 'review_pending',
  );
  const pendingItems = uniqueItems.filter(
    (item) => (item.status === 'generating' || item.status === 'review_pending') && item.companion.id !== activeItem?.companion.id,
  );
  const readyCount = uniqueItems.filter((item) => item.status === 'ready' || item.status === 'partial_success').length;

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
        <p className="my-0 text-muted">Browse distinct profiles, jump straight into chat, and switch active companions anytime.</p>
        <div className="vg-hub-stats-row">
          <span>{uniqueItems.length} total</span>
          <span>{readyCount} ready</span>
          <span>{pendingItems.length} generating</span>
        </div>
        <p className="my-0 text-xs text-muted">
          {entitlements.isPremium
            ? 'Premium membership is active. Companion limits may expand over time.'
            : 'Companion limits by membership tier are rolling out soon. Your existing companions remain available.'}
        </p>
      </Card>

      {activeItem ? (
        <section className="vg-hub-section vg-hub-section-active">
          <div className="vg-section-heading">
            <h2 className="my-0 text-base font-semibold">Active companion</h2>
            <p className="my-0 text-xs text-muted">Your primary relationship thread with direct entry to profile, chat, and voice.</p>
          </div>
          <ActiveCompanionPanel
            companion={activeItem.companion}
            image={activeItem.image}
            status={activeItem.status}
            pending={pending}
            pendingId={pendingId}
            onSwitch={onSwitch}
          />
        </section>
      ) : null}

      {otherItems.length ? (
        <section className="vg-hub-section">
          <div className="vg-section-heading vg-section-heading-spread">
            <div className="vg-section-heading-copy">
              <h2 className="my-0 text-base font-semibold">Companion library</h2>
              <p className="my-0 text-xs text-muted">Ready companions you can chat with immediately.</p>
            </div>
            <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-ghost vg-create-inline">
              Create another
            </Link>
          </div>
          <div className="vg-roster-grid">
            {otherItems.map((item) => (
              <CompanionLibraryCard
                key={item.companion.id}
                companion={item.companion}
                image={item.image}
                status={item.status}
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
            <h2 className="my-0 text-base font-semibold">Pending companions</h2>
            <p className="my-0 text-xs text-muted">Companions still generating images or final setup assets.</p>
          </div>
          <div className="vg-roster-grid">
            {pendingItems.map((item) => (
              <CompanionLibraryCard
                key={item.companion.id}
                companion={item.companion}
                image={item.image}
                status={item.status}
                pending={pending}
                pendingId={pendingId}
                onSwitch={onSwitch}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Card className="app-surface-card vg-create-cta-card">
        <h2 className="my-0 text-base font-semibold">Create another Virtual Girlfriend</h2>
        <p className="my-0 text-sm text-muted">Start a distinct companion with separate personality, images, memory timeline, and relationship arc.</p>
        <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-primary">
          Create another companion
        </Link>
      </Card>
    </div>
  );
};
