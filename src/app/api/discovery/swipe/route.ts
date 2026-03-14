import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getBlockedUserIds } from '@/lib/safety/data';
import { supabaseRest } from '@/lib/supabase/rest';
import type { SwipeRecord } from '@/lib/discovery/types';

type SwipeDirection = 'like' | 'dislike';

const isConflictError = (message: string) => message.includes('duplicate key value') || message.includes('23505');

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as {
    targetUserId?: string;
    direction?: SwipeDirection;
  };

  const targetUserId = String(body.targetUserId ?? '').trim();

  if (!targetUserId || targetUserId === auth.user.id) {
    return NextResponse.json({ error: 'Invalid target user.' }, { status: 400 });
  }

  if (body.direction !== 'like' && body.direction !== 'dislike') {
    return NextResponse.json({ error: 'Invalid swipe direction.' }, { status: 400 });
  }


  const blockedIds = await getBlockedUserIds(auth.accessToken, auth.user.id);
  if (blockedIds.has(targetUserId)) {
    return NextResponse.json({ error: 'You cannot interact with this user.' }, { status: 403 });
  }
  await supabaseRest('swipes', auth.accessToken, {
    method: 'POST',
    body: {
      swiper_id: auth.user.id,
      target_user_id: targetUserId,
      direction: body.direction,
    },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });

  let matched = false;

  if (body.direction === 'like') {
    const reciprocalLikeRows = await supabaseRest<SwipeRecord[]>('swipes', auth.accessToken, {
      searchParams: new URLSearchParams({
        select: 'swiper_id,target_user_id,direction',
        swiper_id: `eq.${targetUserId}`,
        target_user_id: `eq.${auth.user.id}`,
        direction: 'eq.like',
        limit: '1',
      }),
    });

    if (reciprocalLikeRows.length > 0) {
      try {
        await supabaseRest('matches', auth.accessToken, {
          method: 'POST',
          body: {
            user_a_id: auth.user.id,
            user_b_id: targetUserId,
            status: 'active',
          },
          prefer: 'resolution=ignore-duplicates,return=minimal',
        });
        matched = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!isConflictError(message)) {
          throw error;
        }
        matched = true;
      }
    }
  }

  return NextResponse.json({ ok: true, matched });
}
