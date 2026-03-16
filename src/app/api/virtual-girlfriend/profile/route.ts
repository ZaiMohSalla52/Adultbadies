import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getOrCreateVirtualGirlfriendConversation,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionImages,
  listVirtualGirlfriends,
  resolveVirtualGirlfriendCompanion,
} from '@/lib/virtual-girlfriend/data';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const companionId = request.nextUrl.searchParams.get('companionId');
  const companion = await resolveVirtualGirlfriendCompanion(auth.accessToken, auth.user.id, companionId);
  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);

  if (!companion || !companion.setup_completed) {
    return NextResponse.json({ companion: null, companions, conversationId: null });
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);
  const visualProfile = await getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id);
  const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id);

  return NextResponse.json({ companion, companions, conversationId: conversation.id, visualProfile, images });
}
