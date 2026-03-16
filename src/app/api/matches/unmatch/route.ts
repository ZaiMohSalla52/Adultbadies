import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { unmatchUserMatch } from '@/lib/matches/data';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { matchId?: string };
  const matchId = String(body.matchId ?? '').trim();

  try {
    await unmatchUserMatch(auth.accessToken, auth.user.id, matchId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to unmatch right now.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
