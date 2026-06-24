import { supabaseRest } from '@/lib/supabase/rest';

export type UnlockResult = {
  unlocked: boolean;
  already?: boolean;
  balance: number;
  cost: number;
  reason?: string;
};

/** Current point balance for the user (0 if no row yet). */
export const getPointBalance = async (token: string, userId: string): Promise<number> => {
  const rows = await supabaseRest<{ balance: number }[]>('point_balances', token, {
    searchParams: new URLSearchParams({
      select: 'balance',
      user_id: `eq.${userId}`,
      limit: '1',
    }),
  });
  return rows[0]?.balance ?? 0;
};

/** Set of image ids the user has already unlocked (optionally scoped to a companion). */
export const getUnlockedImageIds = async (
  token: string,
  userId: string,
  companionId?: string,
): Promise<string[]> => {
  const params = new URLSearchParams({ select: 'image_id', user_id: `eq.${userId}` });
  if (companionId) params.set('companion_id', `eq.${companionId}`);
  const rows = await supabaseRest<{ image_id: string }[]>('image_unlocks', token, { searchParams: params });
  return rows.map((row) => row.image_id);
};

/** Grant the premium monthly stipend if eligible (idempotent per billing period). Returns the balance. */
export const claimPointStipend = async (token: string): Promise<number> => {
  const result = await supabaseRest<{ balance: number } | { balance: number }[]>('rpc/claim_point_stipend', token, {
    method: 'POST',
    body: {},
  });
  const row = Array.isArray(result) ? result[0] : result;
  return row?.balance ?? 0;
};

/** Grant free gallery access (e.g. a photo already delivered in chat). */
export const grantCompanionImageAccess = async (token: string, imageId: string): Promise<void> => {
  await supabaseRest('rpc/grant_companion_image_access', token, {
    method: 'POST',
    body: { p_image_id: imageId },
  });
};

/** Spend points to unlock a gallery image. The DB enforces cost and balance. */
export const unlockCompanionImage = async (token: string, imageId: string): Promise<UnlockResult> => {
  const result = await supabaseRest<UnlockResult>('rpc/unlock_companion_image', token, {
    method: 'POST',
    body: { p_image_id: imageId },
  });
  return result;
};
