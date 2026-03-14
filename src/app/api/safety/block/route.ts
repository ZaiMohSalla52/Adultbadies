import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { createBlock } from '@/lib/safety/data';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { blockedUserId?: string; reason?: string };
  const blockedUserId = String(body.blockedUserId ?? '').trim();

  try {
    await createBlock(auth.accessToken, auth.user.id, blockedUserId, body.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to block user.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
