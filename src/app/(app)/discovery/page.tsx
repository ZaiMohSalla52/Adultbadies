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
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="my-0 text-lg font-semibold">Discovery</h1>
        <p className="text-sm text-muted">Find people nearby and swipe when you are interested.</p>
      </Card>

      <DiscoveryDeck initialCandidates={candidates} />
    </div>
  );
}
