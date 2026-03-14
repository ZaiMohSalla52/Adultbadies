import type { Entitlements, MembershipState, SubscriptionRecord } from '@/lib/subscriptions/types';

const FREE_PLAN_CODE = 'free';
const PREMIUM_PLAN_CODE = 'premium_monthly';
const FREE_DAILY_SWIPE_LIMIT = 25;

const hasPeriodAccess = (subscription: SubscriptionRecord) => {
  if (!subscription.current_period_end) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > Date.now();
};

const resolveMembershipState = (subscription: SubscriptionRecord | null): MembershipState => {
  if (!subscription) {
    return 'free';
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return 'premium_active';
  }

  if (subscription.status === 'canceled' && hasPeriodAccess(subscription)) {
    return 'premium_canceled';
  }

  return 'premium_expired';
};

export const buildEntitlements = (subscription: SubscriptionRecord | null): Entitlements => {
  const membershipState = resolveMembershipState(subscription);
  const hasPremium = membershipState === 'premium_active' || membershipState === 'premium_canceled';

  return {
    planCode: hasPremium ? subscription?.plan_code ?? PREMIUM_PLAN_CODE : FREE_PLAN_CODE,
    membershipState,
    subscriptionStatus: subscription?.status ?? null,
    isPremium: hasPremium,
    features: {
      unlimitedSwipes: hasPremium,
      rewind: hasPremium,
      seeWhoLikedYou: hasPremium,
    },
    limits: {
      swipesPerDay: hasPremium ? null : FREE_DAILY_SWIPE_LIMIT,
    },
  };
};
