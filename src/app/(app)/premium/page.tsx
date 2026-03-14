import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getSwipeCountForToday, getUserEntitlements } from '@/lib/subscriptions/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const featureRows = [
  {
    name: 'Daily swipes',
    free: '25/day',
    premium: 'Unlimited',
  },
  {
    name: 'Rewind last swipe',
    free: 'Locked teaser',
    premium: 'Included',
  },
  {
    name: 'See who liked you',
    free: 'Locked teaser',
    premium: 'Included',
  },
];

export default async function PremiumPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const entitlements = await getUserEntitlements(auth.accessToken, auth.user.id);
  const swipesToday = await getSwipeCountForToday(auth.accessToken, auth.user.id);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="my-0 text-lg font-semibold">Premium plans</h1>
        <p className="text-sm text-muted">
          Current plan: <strong>{entitlements.isPremium ? 'Premium' : 'Free'}</strong>
        </p>
        <p className="text-sm text-muted">
          Subscription state: <strong>{entitlements.membershipState.replace('_', ' ')}</strong>
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="my-0 text-base font-semibold">Free vs Premium</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">Feature</th>
                <th className="py-2 pr-3 font-medium">Free</th>
                <th className="py-2 font-medium">Premium</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr key={row.name} className="border-b border-border/60">
                  <td className="py-2 pr-3">{row.name}</td>
                  <td className="py-2 pr-3 text-muted">{row.free}</td>
                  <td className="py-2">{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="my-0 text-base font-semibold">Usage</h2>
        <p className="text-sm text-muted">Swipes used today: {swipesToday}</p>
        <p className="text-sm text-muted">
          {entitlements.limits.swipesPerDay === null
            ? 'Unlimited swipes are active on your plan.'
            : `Free plan daily limit: ${entitlements.limits.swipesPerDay} swipes.`}
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="my-0 text-base font-semibold">Billing provider (MVP scaffold)</h2>
        <p className="text-sm text-muted">
          Checkout provider integration is scaffolded for a future stage. Plan upgrades are currently UI- and entitlement-ready.
        </p>
        <Link href="/discovery" className="text-sm">
          Return to discovery
        </Link>
      </Card>
    </div>
  );
}
