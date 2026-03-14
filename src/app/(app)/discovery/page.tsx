import { redirect } from 'next/navigation';
import { DiscoveryDeck } from '@/components/discovery/discovery-deck';
import { Card } from '@/components/ui/card';
import { getDiscoveryCandidates } from '@/lib/discovery/data';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function DiscoveryPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!snapshot.profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  const candidates = await getDiscoveryCandidates(auth.accessToken, auth.user.id);

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <Card className="p-4">
        <h1 className="text-xl font-semibold">Discover</h1>
        <p className="text-sm text-muted">Swipe through people who match your basic preferences.</p>
      </Card>

      <DiscoveryDeck initialCandidates={candidates} />
    </div>
  );
}
