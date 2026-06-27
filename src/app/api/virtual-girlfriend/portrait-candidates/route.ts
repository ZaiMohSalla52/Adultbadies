import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { isBrowserImageDeliveryConfigured } from '@/lib/storage/publish-browser-image';
import {
  getCanonicalReferenceImageForCompanion,
  getLatestVisualProfileForCompanion,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';
import { collectSiblingDistinctnessCues } from '@/lib/virtual-girlfriend/identity-face-dna';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import { assertModelsLabApiKey } from '@/lib/virtual-girlfriend/modelslab-client';
import {
  PORTRAIT_PREVIEW_CANDIDATE_COUNT,
  resolveModelsLabPortraitFallbackModel,
  resolveModelsLabPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';
import { runPortraitPreviewPipeline } from '@/lib/virtual-girlfriend/portrait-preview-pipeline';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';

// Portrait preview generates several candidate images; raise the function
// ceiling so it is not killed mid-generation (Pro/Enterprise can raise to 300).
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as {
    sex?: string;
    origin?: string;
    hairColor?: string;
    hairLength?: string;
    eyeColor?: string;
    skinTone?: string;
    bodyType?: string;
    figure?: string;
    age?: string | number;
    styleVibe?: string;
    personality?: string;
    breastSize?: string;
    occupation?: string;
    sexuality?: string;
    freeformDetails?: string;
  };

  try {
    const resolvedTraits = resolveSetupTraits({
      sex: body.sex,
      origin: body.origin,
      hairColor: body.hairColor,
      hairLength: body.hairLength,
      eyeColor: body.eyeColor,
      skinTone: body.skinTone,
      bodyType: body.bodyType,
      figure: body.figure,
      age: body.age,
      styleVibe: body.styleVibe,
      personality: body.personality,
      breastSize: body.breastSize,
      occupation: body.occupation,
      sexuality: body.sexuality,
      freeformDetails: body.freeformDetails,
    });

    const provider = resolveVgImageProvider();
    const portraitModel = resolveModelsLabPortraitModel();
    const portraitFallbackModel = resolveModelsLabPortraitFallbackModel();

    if (provider === 'modelslab') {
      assertModelsLabApiKey();
    }

    console.info('[virtual-girlfriend] portrait candidate generation start', {
      userId: auth.user.id,
      provider,
      portraitModel,
      portraitFallbackModel,
      styleVibe: resolvedTraits.styleVibe,
      origin: resolvedTraits.origin,
      deliveryConfigured: isBrowserImageDeliveryConfigured(),
    });

    const setupDraftKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ userId: auth.user.id, ...resolvedTraits }))
      .digest('hex')
      .slice(0, 16);

    const siblings = await listVirtualGirlfriendCompanions(auth.accessToken, auth.user.id);
    const siblingProfiles = await Promise.all(
      siblings.slice(0, 8).map((companion) =>
        getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id)),
    );
    const negativeOverlapCues = collectSiblingDistinctnessCues(
      siblingProfiles.map((profile) => profile?.identity_pack ?? null),
    );
    const siblingCanonicalReferences = (
      await Promise.all(
        siblings.slice(0, 8).map(async (companion) => {
          const image = await getCanonicalReferenceImageForCompanion(
            auth.accessToken,
            auth.user.id,
            companion.id,
          );
          if (!image?.delivery_url?.trim()) return null;
          return {
            companionId: companion.id,
            deliveryUrl: image.delivery_url.trim(),
            mimeType: image.origin_mime_type,
          };
        }),
      )
    ).filter((reference): reference is NonNullable<typeof reference> => reference !== null);

    // Preview-only: this does not persist companion images and is intentionally separate from canonical setup persistence.
    const pipeline = await runPortraitPreviewPipeline({
      userId: auth.user.id,
      setupDraftKey,
      negativeOverlapCues,
      siblingCanonicalReferences,
      ...resolvedTraits,
      count: PORTRAIT_PREVIEW_CANDIDATE_COUNT,
    });

    console.info('[virtual-girlfriend] portrait candidate pipeline outcome', {
      userId: auth.user.id,
      ...pipeline.stages,
    });

    if (!pipeline.ok || pipeline.candidates.length < 1) {
      return NextResponse.json(
        {
          error: isBrowserImageDeliveryConfigured()
            ? 'Not enough portrait previews were generated. Please try again.'
            : 'Portrait hosting is not configured. Set R2_PUBLIC_BASE_URL (pub-*.r2.dev) or CLOUDINARY_* env vars.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, candidates: pipeline.candidates });
  } catch (error) {
    console.error('[virtual-girlfriend] portrait candidate generation failed', error);
    const message = error instanceof Error ? error.message : 'Unable to generate portrait candidates right now.';
    const timedOut = /timeout|timed out|FUNCTION_INVOCATION_TIMEOUT/i.test(message);
    const missingKey = /MODELSLAB_API_KEY is not configured/i.test(message);
    const missingFlux = /FLUX_API_KEY is not configured/i.test(message);
    return NextResponse.json(
      {
        error: missingKey
          ? 'Portrait generation is not configured (MODELSLAB_API_KEY missing on server).'
          : missingFlux
            ? 'Portrait generation provider mismatch (VG_IMAGE_PROVIDER=flux but FLUX_API_KEY missing).'
            : timedOut
              ? 'Portrait generation took too long. Please tap Regenerate looks to try again.'
              : 'Unable to generate portrait candidates right now.',
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
