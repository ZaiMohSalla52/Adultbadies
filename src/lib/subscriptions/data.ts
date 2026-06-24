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

// Test/dev premium override: emails listed in PREMIUM_OVERRIDE_EMAILS
// (comma-separated) resolve as premium without a real subscription. The email
// is read from the Supabase access-token JWT so the override works for every
// getUserEntitlements caller without threading the email through each one.
const decodeJwtEmail = (token: string): string | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as { email?: unknown };
    return typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
};

const isPremiumOverrideToken = (token: string): boolean => {
  const allow = (process.env.PREMIUM_OVERRIDE_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false;
  const email = decodeJwtEmail(token);
  return email ? allow.includes(email) : false;
};

export const getUserEntitlements = async (token: string, userId: string): Promise<Entitlements> => {
  const subscription = await getLatestSubscription(token, userId);
  return buildEntitlements(subscription, { forcePremium: isPremiumOverrideToken(token) });
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
