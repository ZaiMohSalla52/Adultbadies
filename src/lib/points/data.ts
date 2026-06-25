import { env } from '@/lib/env';
import { POINTS } from '@/lib/points/constants';
import { supabaseRest } from '@/lib/supabase/rest';

export type UnlockResult = {
  unlocked: boolean;
  already?: boolean;
  balance: number;
  cost: number;
  reason?: string;
};

const isMissingGrantRpcError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('PGRST202') || message.includes('grant_companion_image_access');
};

const serviceRoleFetch = async (path: string, init?: RequestInit) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase service request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) return null;
  const raw = await response.text();
  return raw.trim() ? (JSON.parse(raw) as unknown) : null;
};

const grantCompanionImageAccessViaServiceRole = async (userId: string, imageId: string) => {
  const imageRows = (await serviceRoleFetch(
    `ai_companion_images?select=companion_id&id=eq.${encodeURIComponent(imageId)}&limit=1`,
  )) as Array<{ companion_id: string | null }>;

  const companionId = imageRows?.[0]?.companion_id;
  if (!companionId) {
    throw new Error('Image not found for gallery grant.');
  }

  await serviceRoleFetch('image_unlocks', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      image_id: imageId,
      companion_id: companionId,
      points_spent: 0,
    }),
  });
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
export const grantCompanionImageAccess = async (
  token: string,
  imageId: string,
  userId: string,
): Promise<void> => {
  try {
    await supabaseRest('rpc/grant_companion_image_access', token, {
      method: 'POST',
      body: { p_image_id: imageId },
    });
    return;
  } catch (error) {
    if (!isMissingGrantRpcError(error)) throw error;
    console.warn(
      '[points] grant_companion_image_access RPC missing — using service-role fallback. Run supabase/migrations/020_grant_chat_image_access.sql.',
    );
  }

  await grantCompanionImageAccessViaServiceRole(userId, imageId);
};

export type MessagePointSpendResult = {
  ok: boolean;
  balance: number;
  cost: number;
  reason?: string;
};

const isMissingMessageSpendRpc = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('PGRST202') || message.includes('spend_chat_message_point');
};

/** Spend points for one chat message. DB enforces cost (1 pt) and balance. */
export const spendChatMessagePoint = async (token: string, userId: string): Promise<MessagePointSpendResult> => {
  try {
    const result = await supabaseRest<MessagePointSpendResult>('rpc/spend_chat_message_point', token, {
      method: 'POST',
      body: {},
    });
    return {
      ok: Boolean(result.ok),
      balance: result.balance ?? 0,
      cost: result.cost ?? POINTS.messageCost,
      reason: result.reason,
    };
  } catch (error) {
    if (!isMissingMessageSpendRpc(error)) throw error;
    console.warn(
      '[points] spend_chat_message_point RPC missing — using balance check fallback. Run supabase/migrations/021_chat_message_point_cost.sql.',
    );
  }

  const balance = await getPointBalance(token, userId);
  if (balance < POINTS.messageCost) {
    return { ok: false, balance, cost: POINTS.messageCost, reason: 'insufficient_points' };
  }

  const rows = await supabaseRest<{ balance: number }[]>('point_balances', token, {
    searchParams: new URLSearchParams({
      select: 'balance',
      user_id: `eq.${userId}`,
      limit: '1',
    }),
  });
  const current = rows[0]?.balance ?? 0;
  if (current < POINTS.messageCost) {
    return { ok: false, balance: current, cost: POINTS.messageCost, reason: 'insufficient_points' };
  }

  const updated = await supabaseRest<{ balance: number }[]>('point_balances', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${userId}` }),
    body: { balance: current - POINTS.messageCost },
  });

  return {
    ok: true,
    balance: updated[0]?.balance ?? current - POINTS.messageCost,
    cost: POINTS.messageCost,
  };
};

/** Spend points to unlock a gallery image. The DB enforces cost and balance. */
export const unlockCompanionImage = async (token: string, imageId: string): Promise<UnlockResult> => {
  const result = await supabaseRest<UnlockResult>('rpc/unlock_companion_image', token, {
    method: 'POST',
    body: { p_image_id: imageId },
  });
  return result;
};