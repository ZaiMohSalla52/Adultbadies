import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { unlockCompanionImage } from '@/lib/points/data';
import { markChatImageUnlockedInMessages } from '@/lib/virtual-girlfriend/data';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as { imageId?: string };
  const imageId = String(body.imageId ?? '').trim();
  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required.' }, { status: 400 });
  }

  try {
    const result = await unlockCompanionImage(auth.accessToken, imageId);

    if (!result.unlocked && result.reason === 'insufficient_points') {
      return NextResponse.json(
        {
          error: 'Not enough points to unblur this photo.',
          code: 'INSUFFICIENT_POINTS',
          balance: result.balance,
          cost: result.cost,
          upgradePath: '/premium',
        },
        { status: 402 },
      );
    }

    if (result.unlocked) {
      try {
        await markChatImageUnlockedInMessages(auth.accessToken, auth.user.id, imageId);
      } catch (persistError) {
        console.warn('[points] unlocked image but failed to persist chat message attachment state', persistError);
      }
    }

    return NextResponse.json({ ok: true, unlocked: result.unlocked, balance: result.balance });
  } catch (error) {
    console.error('[points] unlock failed', error);
    return NextResponse.json({ error: 'Unable to unlock this photo right now.' }, { status: 500 });
  }
}
