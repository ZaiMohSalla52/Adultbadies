import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function DashboardPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!snapshot.profile?.onboarding_completed) {
    redirect('/onboarding');
  }

  return (
    <Card className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="text-sm text-muted">Your profile is live. Start discovering nearby candidates now.</p>
      <Link href="/discovery" className="text-sm font-medium text-brand underline">
        Go to discovery
      </Link>
    </Card>
  );
}
