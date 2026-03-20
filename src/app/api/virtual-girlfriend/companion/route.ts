import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  deleteVirtualGirlfriendCompanion,
  getVirtualGirlfriendById,
  listVirtualGirlfriends,
  setActiveVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const companionId = request.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (!companionId) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  const companion = await getVirtualGirlfriendById(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  const wasActive = companion.is_active;

  await deleteVirtualGirlfriendCompanion(auth.accessToken, auth.user.id, companionId);

  // If the deleted companion was active, promote the next available one
  if (wasActive) {
    const remaining = await listVirtualGirlfriends(auth.accessToken, auth.user.id);
    if (remaining.length > 0) {
      await setActiveVirtualGirlfriend(auth.accessToken, auth.user.id, remaining[0].id);
    }
  }

  return NextResponse.json({ ok: true });
}
