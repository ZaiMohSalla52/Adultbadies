import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import {
  getLatestVisualProfileForCompanion,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendCompanionImages,
} from '@/lib/virtual-girlfriend/data';
import { runGalleryTopUpImageMachine } from '@/lib/virtual-girlfriend/image-machine';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  // Owner-scoped: getVirtualGirlfriendCompanionById filters by user_id, so only
  // the companion's owner can trigger (paid) generation.
  const companion = await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  const visualProfile = await getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companionId);
  if (!visualProfile?.canonical_reference_image_id) {
    return NextResponse.json({ ok: false, reason: 'canonical_not_ready', reachedTarget: false }, { status: 409 });
  }

  const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companionId);

  try {
    const result = await runGalleryTopUpImageMachine({
      token: auth.accessToken,
      userId: auth.user.id,
      companion,
      visualProfile,
      existingImages: images,
      batchSize: 1,
    });

    return NextResponse.json({
      ok: true,
      galleryCount: result.galleryCount,
      generatedCount: result.generatedCount,
      reachedTarget: result.reachedTarget,
    });
  } catch (error) {
    console.error('[virtual-girlfriend] gallery top-up failed', error);
    return NextResponse.json({ ok: false, error: 'Gallery top-up failed.', reachedTarget: false }, { status: 500 });
  }
}
