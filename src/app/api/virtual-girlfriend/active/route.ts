import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getVirtualGirlfriendCompanionById, setActiveVirtualGirlfriend } from '@/lib/virtual-girlfriend/data';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { companionId?: string };
  const companionId = String(body.companionId ?? '').trim();

  if (!companionId) {
    return NextResponse.json({ error: 'companionId is required.' }, { status: 400 });
  }

  const companion = await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  await setActiveVirtualGirlfriend(auth.accessToken, auth.user.id, companionId);

  return NextResponse.json({ ok: true, companionId });
}
