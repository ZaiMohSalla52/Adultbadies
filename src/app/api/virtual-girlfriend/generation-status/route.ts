import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionThumbnailBatch,
} from '@/lib/virtual-girlfriend/data';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
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

  const [visualProfile, thumbnailMap] = await Promise.all([
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companionId),
    getVirtualGirlfriendCompanionThumbnailBatch(auth.accessToken, auth.user.id, [companionId]),
  ]);

  const images = thumbnailMap.get(companionId) ?? [];
  const status = resolveCompanionImageState({ companion, images, visualProfile });
  const curated = curateVirtualGirlfriendImages(images, {
    lockedCanonicalImageId: visualProfile?.canonical_reference_image_id ?? null,
  });
  const portraitPreviewUrl =
    typeof companion.structured_profile?.selectedPortraitImage === 'string'
      ? companion.structured_profile.selectedPortraitImage.trim() || null
      : null;

  return NextResponse.json(
    {
      status,
      generationStatus: companion.generation_status,
      imageCount: images.length,
      canonicalUrl: curated.canonical?.delivery_url ?? null,
      portraitPreviewUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
