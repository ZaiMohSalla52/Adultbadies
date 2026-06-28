'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ExploreCharacterCard } from '@/components/discovery/explore-character-card';
import type { ExploreTab } from '@/lib/discovery/types';
import type { CompanionGridCard } from '@/components/virtual-girlfriend/companion-grid';
import { CompanionCardDeleteButton } from '@/components/virtual-girlfriend/companion-card-delete-button';
import type { DiscoveryCandidate } from '@/lib/discovery/types';
import styles from './explore-library.module.css';

export type ExploreCard = {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  href: string;
  tag?: string;
};

const TAB_LABELS: Record<ExploreTab, string> = {
  girlfriends: 'AI Girlfriends',
  boyfriends: 'AI Boyfriends',
  anime: 'Anime Characters',
  my: 'My Characters',
};

const TAB_QUERY: Record<ExploreTab, string | null> = {
  girlfriends: null,
  boyfriends: 'boyfriends',
  anime: 'anime',
  my: 'my',
};

const TAB_CATEGORY_LABEL: Record<ExploreTab, string | null> = {
  girlfriends: 'Woman',
  boyfriends: 'Man',
  anime: 'Anime',
  my: null,
};

const toExploreCardFromDiscovery = (candidate: DiscoveryCandidate): ExploreCard => ({
  id: candidate.companionId ?? candidate.userId,
  name: candidate.displayName,
  bio: candidate.bio,
  photoUrl: candidate.photoUrl,
  href: `/virtual-girlfriend/chat?companionId=${candidate.companionId}`,
  tag: 'Library',
});

const toExploreCardFromCompanion = (card: CompanionGridCard): ExploreCard & { deletable?: boolean } => ({
  id: card.companion.id,
  name: card.companion.name,
  bio: card.companion.display_bio || card.companion.archetype || 'AI Companion',
  photoUrl: card.imageUrl,
  href: card.href,
  tag: card.isActive ? 'Active' : card.chatReady ? 'Ready' : 'Setup',
  deletable: card.deletable,
});

type ExploreLibraryProps = {
  initialTab: ExploreTab;
  girlfriends: DiscoveryCandidate[];
  boyfriends: DiscoveryCandidate[];
  anime: DiscoveryCandidate[];
  myCharacters: CompanionGridCard[];
};

export const ExploreLibrary = ({
  initialTab,
  girlfriends,
  boyfriends,
  anime,
  myCharacters,
}: ExploreLibraryProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ExploreTab>(initialTab);
  const [query, setQuery] = useState('');

  const selectTab = (next: ExploreTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    const queryValue = TAB_QUERY[next];
    if (queryValue) {
      params.set('tab', queryValue);
    } else {
      params.delete('tab');
    }
    const qs = params.toString();
    router.replace(qs ? `/discovery?${qs}` : '/discovery', { scroll: false });
  };

  const cards = useMemo(() => {
    const pool =
      tab === 'girlfriends'
        ? girlfriends.map(toExploreCardFromDiscovery)
        : tab === 'boyfriends'
          ? boyfriends.map(toExploreCardFromDiscovery)
          : tab === 'anime'
            ? anime.map(toExploreCardFromDiscovery)
            : myCharacters.map(toExploreCardFromCompanion);

    const normalized = query.trim().toLowerCase();
    if (!normalized) return pool;

    return pool.filter(
      (card) =>
        card.name.toLowerCase().includes(normalized)
        || card.bio.toLowerCase().includes(normalized),
    );
  }, [tab, query, girlfriends, boyfriends, anime, myCharacters]);

  return (
    <div className={styles.frame}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Explore</h1>
          <p className={styles.subtitle}>Browse the romantic AI library or create your own companion.</p>
        </div>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search characters"
          />
        </div>
      </div>

      <div className={styles.banner}>
        <p className={styles.bannerText}>Build a custom companion with your look, vibe, and personality.</p>
        <Link href="/virtual-girlfriend/setup?new=1" className={styles.bannerCta}>
          Create character
        </Link>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Character categories">
        {(Object.keys(TAB_LABELS) as ExploreTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? styles.tabActive : styles.tab}
            onClick={() => selectTab(key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className={styles.grid} role="tabpanel">
        {cards.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {tab === 'anime' ? 'No anime-style companions yet' : 'No characters yet'}
            </p>
            <p>
              {tab === 'my'
                ? 'Create your first companion to see them here.'
                : tab === 'anime'
                  ? 'Create a companion and choose an anime-inspired look in setup.'
                  : 'Try another category or create your own.'}
            </p>
            <Link href="/virtual-girlfriend/setup?new=1" className={styles.bannerCta} style={{ display: 'inline-block', marginTop: 16 }}>
              Create character
            </Link>
          </div>
        ) : (
          cards.map((card) => {
            const myCard = tab === 'my' ? (card as ExploreCard & { deletable?: boolean }) : null;
            const cardInner = (
              <ExploreCharacterCard
                name={card.name}
                bio={card.bio}
                photoUrl={card.photoUrl}
                href={card.href}
                categoryLabel={TAB_CATEGORY_LABEL[tab]}
                metaTag={tab === 'my' ? card.tag : null}
              />
            );

            if (myCard?.deletable) {
              return (
                <div key={card.id} className={styles.cardWrap}>
                  {cardInner}
                  <CompanionCardDeleteButton companionId={card.id} companionName={card.name} />
                </div>
              );
            }

            return <div key={card.id} className={styles.gridItem}>{cardInner}</div>;
          })
        )}

        {tab === 'my' ? (
          <div className={styles.gridItem}>
            <Link href="/virtual-girlfriend/setup?new=1" className={styles.createCard}>
              <span className={styles.createIcon}>✨</span>
              <span className={styles.createLabel}>Create New</span>
              <span className={styles.createSub}>AI Companion</span>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
};