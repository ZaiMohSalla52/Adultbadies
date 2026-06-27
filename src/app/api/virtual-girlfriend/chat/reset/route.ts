import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import {
  clearVirtualGirlfriendConversationMessages,
  getOrCreateVirtualGirlfriendConversation,
  getVirtualGirlfriendCompanionForChat,
} from '@/lib/virtual-girlfriend/data';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as { companionId?: string };
  const companionId = String(body.companionId ?? '').trim();
  if (!companionId) {
    return NextResponse.json({ error: 'companionId is required.' }, { status: 400 });
  }

  const companion = await getVirtualGirlfriendCompanionForChat(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companionId);
  await clearVirtualGirlfriendConversationMessages(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
  });

  return NextResponse.json({ ok: true });
}