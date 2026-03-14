import { getUserEntitlements } from '@/lib/subscriptions/data';

type EntitledFeature = 'unlimitedSwipes' | 'rewind' | 'seeWhoLikedYou';

export const requireEntitledFeature = async (
  token: string,
  userId: string,
  feature: EntitledFeature,
): Promise<{ allowed: boolean; reason?: string }> => {
  const entitlements = await getUserEntitlements(token, userId);

  if (entitlements.features[feature]) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'This feature requires Premium.',
  };
};
