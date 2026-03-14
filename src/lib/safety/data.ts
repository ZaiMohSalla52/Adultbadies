import { supabaseRest } from '@/lib/supabase/rest';
import { REPORT_CATEGORIES, type BlockRecord, type ReportCategory, type ReportRecord } from '@/lib/safety/types';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const getBlockedUserIds = async (token: string, userId: string): Promise<Set<string>> => {
  const rows = await supabaseRest<BlockRecord[]>('blocks', token, {
    searchParams: new URLSearchParams({
      select: 'blocker_id,blocked_user_id',
      or: `(blocker_id.eq.${userId},blocked_user_id.eq.${userId})`,
    }),
  });

  const blockedIds = new Set<string>();

  for (const row of rows) {
    if (row.blocker_id === userId) blockedIds.add(row.blocked_user_id);
    if (row.blocked_user_id === userId) blockedIds.add(row.blocker_id);
  }

  return blockedIds;
};

export const createBlock = async (
  token: string,
  blockerId: string,
  blockedUserId: string,
  reason?: string,
): Promise<void> => {
  if (!isUuid(blockedUserId) || blockedUserId === blockerId) {
    throw new Error('Invalid user selected for block.');
  }

  await supabaseRest('blocks', token, {
    method: 'POST',
    body: {
      blocker_id: blockerId,
      blocked_user_id: blockedUserId,
      reason: reason?.trim() ? reason.trim() : null,
    },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });

  await supabaseRest('matches', token, {
    method: 'PATCH',
    body: {
      status: 'blocked',
      unmatched_at: new Date().toISOString(),
    },
    searchParams: new URLSearchParams({
      status: 'eq.active',
      or: `(and(user_a_id.eq.${blockerId},user_b_id.eq.${blockedUserId}),and(user_a_id.eq.${blockedUserId},user_b_id.eq.${blockerId}))`,
    }),
    prefer: 'return=minimal',
  });
};

export const createReport = async (
  token: string,
  reporterId: string,
  input: {
    reportedUserId?: string;
    matchId?: string;
    messageId?: string;
    category: ReportCategory;
    details?: string;
  },
): Promise<ReportRecord> => {
  if (!REPORT_CATEGORIES.includes(input.category)) {
    throw new Error('Invalid report category.');
  }

  const details = input.details?.trim() ?? '';
  if (details.length > 1000) {
    throw new Error('Report details are too long.');
  }

  const rows = await supabaseRest<ReportRecord[]>('reports', token, {
    method: 'POST',
    body: {
      reporter_id: reporterId,
      reported_user_id: input.reportedUserId ?? null,
      match_id: input.matchId ?? null,
      message_id: input.messageId ?? null,
      category: input.category,
      details: details || null,
    },
    searchParams: new URLSearchParams({ select: 'id,reporter_id,reported_user_id,match_id,message_id,category,details' }),
    prefer: 'return=representation',
  });

  const report = rows[0];
  if (!report) {
    throw new Error('Failed to create report.');
  }

  return report;
};
