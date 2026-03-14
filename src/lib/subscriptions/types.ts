export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'expired'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionRecord = {
  id: string;
  user_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_code: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipState = 'free' | 'premium_active' | 'premium_canceled' | 'premium_expired';

export type Entitlements = {
  planCode: string;
  membershipState: MembershipState;
  subscriptionStatus: SubscriptionStatus | null;
  isPremium: boolean;
  features: {
    unlimitedSwipes: boolean;
    rewind: boolean;
    seeWhoLikedYou: boolean;
  };
  limits: {
    swipesPerDay: number | null;
  };
};
