import { redirect } from 'next/navigation';
import { DiscoveryDeck } from '@/components/discovery/discovery-deck';
import { Card } from '@/components/ui/card';
import { getDiscoveryCandidates } from '@/lib/discovery/data';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getSwipeCountForToday, getUserEntitlements } from '@/lib/subscriptions/data';

export default async function DiscoveryPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!snapshot.profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  const [candidates, entitlements, swipesToday] = await Promise.all([
    getDiscoveryCandidates(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
    getSwipeCountForToday(auth.accessToken, auth.user.id),
  ]);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card style={{ padding: '1rem 1.1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Discovery</h1>
        <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>Swipe smoothly. Match quickly. Meet people nearby.</p>
      </Card>
      <DiscoveryDeck initialCandidates={candidates} entitlements={entitlements} swipesToday={swipesToday} />
    </div>
  );
}
