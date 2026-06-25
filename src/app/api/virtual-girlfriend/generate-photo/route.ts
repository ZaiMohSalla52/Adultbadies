import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';

import { getUnlockedImageIds } from '@/lib/points/data';
import { applyChatImageLock } from '@/lib/virtual-girlfriend/chat-image-lock';
import {
  getActiveVirtualGirlfriend,
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionImages,
} from '@/lib/virtual-girlfriend/data';
import { resolveVirtualGirlfriendChatImage } from '@/lib/virtual-girlfriend/chat-images';
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';
import type { VirtualGirlfriendImageCategory } from '@/lib/virtual-girlfriend/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as {
    companionId?: string;
    prompt?: string;
    category?: VirtualGirlfriendImageCategory;
  };

  const prompt = String(body.prompt ?? '').trim();
  const requestedCompanionId = String(body.companionId ?? '').trim();
  const category = (body.category ?? 'outfit') as VirtualGirlfriendImageCategory;

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const moderation = moderateVirtualGirlfriendImageRequest(prompt);
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason ?? 'Prompt not allowed.' }, { status: 400 });
  }

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (!companion?.setup_completed) {
    return NextResponse.json({ error: 'Complete companion setup first.' }, { status: 400 });
  }

  const [companionImages, visualProfile, unlockedImageIds] = await Promise.all([
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id),
    getUnlockedImageIds(auth.accessToken, auth.user.id, companion.id),
  ]);

  const result = await resolveVirtualGirlfriendChatImage({
    token: auth.accessToken,
    userId: auth.user.id,
    companion,
    category,
    existingImages: companionImages,
    visualProfile,
    allowFreshGeneration: true,
    userMessage: prompt,
    visualSceneHint: prompt,
    preferFreshGeneration: true,
  });

  if (!result.attachment) {
    return NextResponse.json(
      { error: result.reason ?? 'Unable to generate photo right now.', outcome: result.outcome },
      { status: 422 },
    );
  }

  const attachment = applyChatImageLock(result.attachment, unlockedImageIds);

  return NextResponse.json({
    ok: true,
    outcome: result.outcome,
    attachment,
  });
}