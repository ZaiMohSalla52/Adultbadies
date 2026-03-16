'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
} from '@/lib/virtual-girlfriend/types';

type RosterItem = {
  companion: VirtualGirlfriendCompanionRecord;
  image: VirtualGirlfriendCompanionImageRecord | null;
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
        <h1 className="my-0">Choose your companion</h1>
        <p className="my-0 text-muted">Every profile is a distinct relationship identity with her own vibe, memory, and style signal.</p>
        <p className="my-0 text-xs text-muted">
          {entitlements.isPremium
            ? 'Premium membership is active. Companion limits may expand over time.'
            : 'Companion limits by membership tier are rolling out soon. Your existing companions remain available.'}
        </p>
      </Card>

      <section className="vg-roster-grid">
        {items.map(({ companion, image }) => {
          const isActive = companion.id === activeCompanionId;
          const label = isActive ? 'Currently active' : 'Switch to this companion';

          return (
            <article key={companion.id} className={`vg-roster-card ${isActive ? 'vg-roster-card-active' : ''}`}>
              <div className="vg-roster-image-wrap">
                {image ? (
                  <Image src={image.delivery_url} alt={`${companion.name} portrait`} fill className="object-cover" />
                ) : (
                  <div className="vg-roster-image-empty">Portrait preparing</div>
                )}
              </div>

              <div className="vg-roster-copy">
                <p className="my-0 text-xs text-muted">{companion.archetype ?? 'Virtual Companion'}</p>
                <h2 className="my-0">{companion.name}</h2>
                <p className="my-0 text-sm text-muted">{companion.display_bio ?? companion.persona_profile.shortBio}</p>
                <p className="my-0 text-xs text-muted">
                  {(companion.profile_tags ?? []).slice(0, 2).join(' • ') || companion.tone || 'Distinct chemistry'}
                </p>
              </div>

              <Button type="button" onClick={() => onSwitch(companion.id)} disabled={pending && pendingId === companion.id}>
                {pending && pendingId === companion.id ? 'Switching…' : label}
              </Button>
            </article>
          );
        })}
      </section>

      <Card className="app-surface-card">
        <h2 className="my-0 text-base font-semibold">Create another Virtual Girlfriend</h2>
        <p className="my-0 text-sm text-muted">Build a new profile with its own personality, gallery continuity, and chat memory lane.</p>
        <Link href="/virtual-girlfriend/setup?new=1" className="ui-button ui-button-primary">
          Create another companion
        </Link>
      </Card>
    </div>
  );
};
