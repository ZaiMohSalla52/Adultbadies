'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, ProfileMediaFrame } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/safety/types';
import type { Entitlements } from '@/lib/subscriptions/types';
import type { DiscoveryCandidate } from '@/lib/discovery/types';
import type { MatchListItem } from '@/lib/matches/types';

type DiscoveryDeckProps = {
  initialCandidates: DiscoveryCandidate[];
  entitlements: Entitlements;
  swipesToday: number;
  recentMatches: MatchListItem[];
};

export const DiscoveryDeck = ({ initialCandidates, entitlements, swipesToday, recentMatches }: DiscoveryDeckProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [showSafety, setShowSafety] = useState(false);

  const currentCandidate = useMemo(() => candidates[0] ?? null, [candidates]);

  const removeCurrentCandidate = () => {
    setCandidates((prev) => prev.slice(1));
    setReportDetails('');
  };

  const swipe = (direction: 'like' | 'dislike', source: 'like' | 'pass' | 'super' = 'like') => {
    if (!currentCandidate || isPending) return;

    const target = currentCandidate;
    setFeedback(null);

    // VG auto-match on like
    if (target.kind === 'virtual_girlfriend' && direction === 'like') {
      startTransition(async () => {
        const response = await fetch('/api/discovery/vg-like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companionId: target.companionId }),
        });

        if (!response.ok) {
          setFeedback('Could not match with this companion. Please try again.');
          return;
        }

        removeCurrentCandidate();
        setFeedback(`It's a match with ${target.displayName}! You can start chatting now.`);
        router.refresh();
      });
      return;
    }

    // VG dislike — just remove from deck, no API call needed
    if (target.kind === 'virtual_girlfriend' && direction === 'dislike') {
      removeCurrentCandidate();
      if (source === 'pass') setFeedback(`Passed on ${target.displayName}.`);
      return;
    }

    // Human swipe
    startTransition(async () => {
      const response = await fetch('/api/discovery/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: target.userId, direction }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          setFeedback('You reached your free daily swipe limit. Upgrade to Premium for unlimited swipes.');
          return;
        }

        setFeedback('Could not save swipe. Please try again.');
        return;
      }

      const payload = (await response.json()) as { matched?: boolean };
      removeCurrentCandidate();

      if (payload.matched) {
        setFeedback(`It's a match with ${target.displayName}!`);
      } else if (source === 'super') {
        setFeedback(`Super Like sent to ${target.displayName}.`);
      } else if (source === 'pass') {
        setFeedback(`Passed on ${target.displayName}.`);
      }

      router.refresh();
    });
  };

  const blockCurrentUser = () => {
    if (!currentCandidate || isPending || currentCandidate.kind === 'virtual_girlfriend') return;

    const target = currentCandidate;
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: target.userId, reason: 'blocked_from_discovery' }),
      });

      if (!response.ok) {
        setFeedback('Could not block this user. Please try again.');
        return;
      }

      removeCurrentCandidate();
      setFeedback(`${target.displayName} has been blocked.`);
      router.refresh();
    });
  };

  const reportCurrentUser = () => {
    if (!currentCandidate || isPending || currentCandidate.kind === 'virtual_girlfriend') return;

    const target = currentCandidate;
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: target.userId,
          category: reportCategory,
          details: reportDetails,
        }),
      });

      if (!response.ok) {
        setFeedback('Could not submit report. Please try again.');
        return;
      }

      setFeedback('Thanks. Your report has been submitted.');
      setReportDetails('');
      router.refresh();
    });
  };

  const isHumanCandidate = currentCandidate?.kind === 'human';

  return (
    <div className="encounters-screen encounters-screen-with-sidebar">
      {/* ── Sidebar (desktop only) ── */}
      <aside className="encounters-sidebar">
        <div className="encounters-sidebar-header">
          <span className="encounters-sidebar-title">Matches</span>
          <Link href="/chats" className="encounters-sidebar-see-all">See all</Link>
        </div>

        <div className="encounters-matches-grid">
          {/* Likes sent shortcut card */}
          <Link href="/chats" className="encounters-match-thumb encounters-likes-sent-card">
            <span className="encounters-likes-sent-icon">💌</span>
            <span className="encounters-likes-sent-label">Likes sent</span>
          </Link>

          {recentMatches.slice(0, 11).map((match) => (
            <Link key={match.matchId} href={`/matches/${match.matchId}`} className="encounters-match-thumb">
              {match.avatarUrl ? (
                <Image
                  src={match.avatarUrl}
                  alt={match.otherUserName}
                  fill
                  className="encounters-match-thumb-img"
                  unoptimized
                />
              ) : (
                <div className="encounters-match-thumb-fallback">
                  {match.otherUserName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="encounters-match-thumb-name">{match.otherUserName}</span>
            </Link>
          ))}

          {recentMatches.length === 0 && (
            <p className="encounters-sidebar-empty">No matches yet. Keep swiping!</p>
          )}
        </div>
      </aside>

      {/* ── Main swipe area ── */}
      <div className="encounters-main">
        {/* Mobile-only header */}
        <div className="encounters-mobile-top">
          <Card className="app-page-header encounters-header-card">
            <div className="encounters-header-row">
              <div>
                <p className="chat-label">Discovery</p>
                <h1 className="my-0">Encounters</h1>
              </div>
              <p className="encounters-status-pill encounters-status-pill-count">
                {swipesToday}
                {entitlements.limits.swipesPerDay !== null ? `/${entitlements.limits.swipesPerDay}` : ''}
              </p>
            </div>
            <p className="my-0 text-muted">Discover people nearby and decide in seconds.</p>
            <p className="encounters-status-pill">{entitlements.isPremium ? 'Premium mode · unlimited swipes' : 'Free mode · daily limit active'}</p>
          </Card>
        </div>

        {!currentCandidate ? (
          <Card className="encounters-empty-state">
            <h2 style={{ marginTop: 0 }}>No more candidates right now</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>You are caught up for now. Check back later.</p>
          </Card>
        ) : (
          <Card className="discovery-card-enter encounters-card">
            <ProfileMediaFrame className="encounters-image-wrap">
              {currentCandidate.photoUrl ? (
                <Image
                  src={currentCandidate.photoUrl}
                  alt={currentCandidate.displayName}
                  fill
                  className="avatar-image"
                  unoptimized
                  priority
                />
              ) : (
                <div className="encounters-avatar-fallback">
                  <Avatar name={currentCandidate.displayName} size="xl" ring />
                  <p className="my-0 text-sm text-muted">No photo uploaded</p>
                </div>
              )}

              {/* VG disclosure badge */}
              {currentCandidate.kind === 'virtual_girlfriend' && (
                <div className="encounters-vg-badge">
                  ✨ AI · {currentCandidate.disclosureLabel ?? 'Virtual'}
                </div>
              )}

              <div className="encounters-overlay">
                <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
                  {currentCandidate.displayName}
                  {currentCandidate.age ? `, ${currentCandidate.age}` : ''}
                </h2>
                {currentCandidate.kind === 'virtual_girlfriend' ? (
                  <span className="encounters-intent-tag encounters-intent-tag-vg">Virtual Girlfriend ✨</span>
                ) : (
                  <span className="encounters-intent-tag">Here to date</span>
                )}
                <p style={{ margin: '0.15rem 0', color: 'var(--text-muted)' }}>{currentCandidate.location}</p>
                {currentCandidate.bio ? <p style={{ margin: 0, fontSize: '0.92rem' }}>{currentCandidate.bio}</p> : null}
              </div>
            </ProfileMediaFrame>
          </Card>
        )}

        <div className="encounters-action-row">
          <button
            type="button"
            className="encounters-btn encounters-btn-pass"
            disabled={isPending || !currentCandidate}
            onClick={() => swipe('dislike', 'pass')}
            aria-label="Pass"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button
            type="button"
            className="encounters-btn encounters-btn-super"
            disabled={isPending || !currentCandidate}
            onClick={() => swipe('like', 'super')}
            aria-label="Super like"
          >
            🔥
          </button>
          <button
            type="button"
            className="encounters-btn encounters-btn-like"
            disabled={isPending || !currentCandidate}
            onClick={() => swipe('like', 'like')}
            aria-label="Like"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
        </div>

        {feedback ? <p className="encounters-feedback">{feedback}</p> : null}

        {/* Safety tools — compact, collapsed by default, only for human profiles */}
        {isHumanCandidate && (
          <div className="encounters-safety-inline">
            <button
              type="button"
              className="encounters-safety-toggle"
              onClick={() => setShowSafety((v) => !v)}
            >
              {showSafety ? 'Hide safety tools ▲' : 'Safety tools ▼'}
            </button>
            {showSafety && (
              <Card className="encounters-safety-card">
                <div className="encounters-safety-header">
                  <p style={{ margin: 0, fontWeight: 600 }}>Safety tools</p>
                  {!entitlements.isPremium ? (
                    <Link href="/premium" className="text-brand" style={{ fontSize: '0.84rem' }}>
                      Upgrade to Premium
                    </Link>
                  ) : null}
                </div>
                <div className="encounters-safety-actions">
                  <Button type="button" variant="ghost" disabled={isPending || !currentCandidate} onClick={blockCurrentUser}>
                    Block
                  </Button>
                  <Button type="button" variant="secondary" disabled={isPending || !currentCandidate} onClick={reportCurrentUser}>
                    Report
                  </Button>
                </div>
                <select
                  className="ui-select"
                  value={reportCategory}
                  onChange={(event) => setReportCategory(event.target.value as ReportCategory)}
                  disabled={isPending}
                >
                  {REPORT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional details"
                  disabled={isPending}
                />
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
