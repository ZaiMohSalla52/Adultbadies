import { redirect } from 'next/navigation';
import { DiscoveryDeck } from '@/components/discovery/discovery-deck';
import { getDiscoveryCandidates, getDiscoverableVirtualGirlfriends } from '@/lib/discovery/data';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getSwipeCountForToday, getUserEntitlements } from '@/lib/subscriptions/data';
import { getMatchList } from '@/lib/matches/data';
import type { DiscoveryCandidate } from '@/lib/discovery/types';

const interleaveVgCandidates = (humans: DiscoveryCandidate[], vgs: DiscoveryCandidate[]): DiscoveryCandidate[] => {
  if (vgs.length === 0) return humans;
  const result: DiscoveryCandidate[] = [];
  let vgIndex = 0;
  for (let i = 0; i < humans.length; i++) {
    result.push(humans[i]);
    // Insert a VG card every 5 human cards
    if ((i + 1) % 5 === 0 && vgIndex < vgs.length) {
      result.push(vgs[vgIndex++]);
    }
  }
  // Append remaining VG candidates at the end
  while (vgIndex < vgs.length) {
    result.push(vgs[vgIndex++]);
  }
  return result;
};

export default async function DiscoveryPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!snapshot.profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  const [candidates, vgCandidates, entitlements, swipesToday, recentMatches] = await Promise.all([
    getDiscoveryCandidates(auth.accessToken, auth.user.id),
    getDiscoverableVirtualGirlfriends(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
    getSwipeCountForToday(auth.accessToken, auth.user.id),
    getMatchList(auth.accessToken, auth.user.id),
  ]);

  const allCandidates = interleaveVgCandidates(candidates, vgCandidates);

  return (
    <DiscoveryDeck
      initialCandidates={allCandidates}
      entitlements={entitlements}
      swipesToday={swipesToday}
      recentMatches={recentMatches}
    />
  );
}
