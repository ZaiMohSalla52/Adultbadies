import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionImages,
} from '@/lib/virtual-girlfriend/data';
import { resolveCompanionImageState } from '@/lib/virtual-girlfriend/generation-state';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const companionId = request.nextUrl.searchParams.get('companionId')?.trim();
  if (!companionId) {
    return NextResponse.json({ error: 'companionId is required.' }, { status: 400 });
  }

  const companion = await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  const [visualProfile, images] = await Promise.all([
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companionId),
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companionId),
  ]);

  const status = resolveCompanionImageState({ companion, images, visualProfile });

  return NextResponse.json(
    { status, generationStatus: companion.generation_status, imageCount: images.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
