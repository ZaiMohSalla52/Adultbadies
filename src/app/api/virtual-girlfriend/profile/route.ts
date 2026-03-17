import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getActiveVirtualGirlfriend,
  getVirtualGirlfriendCompanionById,
  getOrCreateVirtualGirlfriendConversation,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionImages,
  listVirtualGirlfriends,
} from '@/lib/virtual-girlfriend/data';
import { resolveVirtualGirlfriendProfile } from '@/lib/virtual-girlfriend/profile-resolver';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const requestedCompanionId = searchParams.get('companionId')?.trim() ?? '';
  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
  if (!companion || !companion.setup_completed) {
    return NextResponse.json({ companion: null, companions, conversationId: null });
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);
  const visualProfile = await getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id);
  const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id);

  const resolvedProfile = resolveVirtualGirlfriendProfile(companion);

  return NextResponse.json({ companion, resolvedProfile, companions, conversationId: conversation.id, visualProfile, images });
}
