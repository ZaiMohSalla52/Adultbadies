import { supabaseRest } from '@/lib/supabase/rest';
import { buildEntitlements } from '@/lib/subscriptions/entitlements';
import type { Entitlements, SubscriptionRecord } from '@/lib/subscriptions/types';

const subscriptionSelect =
  'id,user_id,provider,provider_customer_id,provider_subscription_id,plan_code,status,current_period_start,current_period_end,cancel_at,created_at,updated_at';

export const getLatestSubscription = async (token: string, userId: string): Promise<SubscriptionRecord | null> => {
  const rows = await supabaseRest<SubscriptionRecord[]>('subscriptions', token, {
    searchParams: new URLSearchParams({
      select: subscriptionSelect,
      user_id: `eq.${userId}`,
      order: 'created_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

export const getUserEntitlements = async (token: string, userId: string): Promise<Entitlements> => {
  const subscription = await getLatestSubscription(token, userId);
  return buildEntitlements(subscription);
};

export const getSwipeCountForToday = async (token: string, userId: string): Promise<number> => {
  const now = new Date();
  const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const rows = await supabaseRest<{ id: string }[]>('swipes', token, {
    searchParams: new URLSearchParams({
      select: 'id',
      swiper_id: `eq.${userId}`,
      created_at: `gte.${dayStartUtc}`,
      limit: '1000',
    }),
  });

  return rows.length;
};
