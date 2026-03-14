import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
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

  return (
    <Card>
      <h1 className="my-0 text-lg font-semibold">Discovery</h1>
      <p className="text-sm text-muted">Discovery and swipe engine is enabled from Stage 4.</p>
      <Link className="text-sm" href="/matches">
        Go to matches inbox
      </Link>
    </Card>
  );
}
