import { redirect } from 'next/navigation';
import { AccountProfileClient } from '@/components/account/account-profile-client';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { claimPointStipend, getPointBalance } from '@/lib/points/data';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function AccountPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [entitlements, onboarding] = await Promise.all([
    getUserEntitlements(auth.accessToken, auth.user.id),
    getOnboardingSnapshot(auth.accessToken, auth.user.id),
  ]);

  if (entitlements.isPremium) {
    await claimPointStipend(auth.accessToken);
  }

  const pointBalance = await getPointBalance(auth.accessToken, auth.user.id);
  const displayName =
    onboarding.profile?.display_name?.trim()
    || auth.user.email?.split('@')[0]
    || 'Member';

  return (
    <div className="account-page-frame account-page-fullscreen">
      <AccountProfileClient
        email={auth.user.email ?? 'Unknown'}
        displayName={displayName}
        isPremium={entitlements.isPremium}
        pointBalance={pointBalance}
        membershipState={entitlements.membershipState}
      />
    </div>
  );
}