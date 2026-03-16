import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getActiveVirtualGirlfriend, getOrCreateVirtualGirlfriendConversation } from '@/lib/virtual-girlfriend/data';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
  if (!companion || !companion.setup_completed) {
    return NextResponse.json({ companion: null, conversationId: null });
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);

  return NextResponse.json({ companion, conversationId: conversation.id });
}
