import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getSwipeCountForToday, getUserEntitlements } from '@/lib/subscriptions/data';
import { claimPointStipend, getPointBalance } from '@/lib/points/data';
import { POINTS } from '@/lib/points/constants';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const featureRows = [
  {
    name: 'Daily swipes',
    free: '25/day',
    premium: 'Unlimited',
  },
  {
    name: 'Rewind last swipe',
    free: 'Not included',
    premium: 'Included',
  },
  {
    name: 'See who liked you',
    free: 'Not included',
    premium: 'Included',
  },
  {
    name: 'AI chat messages',
    free: `${POINTS.messageCost} point each`,
    premium: `${POINTS.messageCost} point each + monthly stipend`,
  },
  {
    name: 'Gallery photo unlocks',
    free: 'No points',
    premium: `${POINTS.premiumMonthlyStipend} points/mo (~${Math.floor(POINTS.premiumMonthlyStipend / POINTS.unblurCost)} unblurs)`,
  },
];

export default async function PremiumPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const [entitlements, swipesToday] = await Promise.all([
    getUserEntitlements(auth.accessToken, auth.user.id),
    getSwipeCountForToday(auth.accessToken, auth.user.id),
  ]);

  if (entitlements.isPremium) {
    await claimPointStipend(auth.accessToken);
  }
  const pointBalance = await getPointBalance(auth.accessToken, auth.user.id);

  return (
    <div className="app-page-stack">
      <Card className="app-page-header premium-header-card">
        <p className="chat-label">Premium</p>
        <h1 className="my-0">Premium plans</h1>
        <p className="my-0 text-muted">Unlock advanced discovery and keep more momentum in every conversation.</p>
      </Card>

      <div className="app-grid-2">
        <Card className="app-surface-card space-y-2">
          <h2 className="my-0 text-base font-semibold">Plan status</h2>
          <p className="text-sm text-muted">
            Current plan: <strong>{entitlements.isPremium ? 'Premium' : 'Free'}</strong>
          </p>
          <p className="text-sm text-muted">
            Subscription state: <strong>{entitlements.membershipState.replace('_', ' ')}</strong>
          </p>
        </Card>

        <Card className="app-surface-card space-y-2">
          <h2 className="my-0 text-base font-semibold">Points</h2>
          <p className="text-sm text-muted">
            Balance: <strong>💜 {pointBalance}</strong>
          </p>
          <p className="text-sm text-muted">
            {entitlements.isPremium
              ? `Premium grants ${POINTS.premiumMonthlyStipend} points each billing period. Unblur a gallery photo for ${POINTS.unblurCost} points.`
              : `Premium members get ${POINTS.premiumMonthlyStipend} points/month to unblur gallery photos (${POINTS.unblurCost} points each).`}
          </p>
        </Card>

        <Card className="app-surface-card space-y-2">
          <h2 className="my-0 text-base font-semibold">Usage</h2>
          <p className="text-sm text-muted">Swipes used today: {swipesToday}</p>
          <p className="text-sm text-muted">Virtual Girlfriend text: {entitlements.limits.virtualGirlfriendMessagesPerDay ?? 'Expanded'} daily messages.</p>
          <p className="text-sm text-muted">
            {entitlements.limits.swipesPerDay === null
              ? 'Unlimited swipes are active on your plan.'
              : `Free plan daily limit: ${entitlements.limits.swipesPerDay} swipes.`}
          </p>
        </Card>
      </div>

      <Card className="app-surface-card space-y-3">
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

      <Card className="app-surface-card premium-cta-card">
        <h2 className="my-0 text-base font-semibold">
          {entitlements.isPremium ? 'Manage your plan' : 'Upgrade to Premium'}
        </h2>
        <p className="text-sm text-muted my-0">
          {entitlements.isPremium
            ? 'Your Premium benefits are active. Billing changes are managed from account settings.'
            : 'Premium unlocks unlimited swipes, expanded daily chat, and a monthly point stipend for gallery unlocks.'}
        </p>
        <div className="premium-cta-actions">
          <Link href="/account" className="ui-button ui-button-primary">
            {entitlements.isPremium ? 'Account settings' : 'View account options'}
          </Link>
          <Link href="/discovery" className="ui-button ui-button-ghost">
            Browse companions
          </Link>
        </div>
      </Card>
    </div>
  );
}
