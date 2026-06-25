import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { runPortraitPreviewImageMachine } from '@/lib/virtual-girlfriend/image-machine';
import {
  deliverPortraitPreviewCandidates,
  filterReachablePortraitPreviewCandidates,
} from '@/lib/virtual-girlfriend/portrait-preview-delivery';
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

    // Preview-only: this does not persist companion images and is intentionally separate from canonical setup persistence.
    const result = await runPortraitPreviewImageMachine({
      kind: 'portrait_preview',
      ...resolvedTraits,
      count: 3,
    });

    const delivered = await deliverPortraitPreviewCandidates(result.candidates, auth.user.id);
    const hostedOnly = delivered.filter((candidate) => /^https?:\/\//i.test(candidate.imageDataUrl.trim()));
    let candidates = await filterReachablePortraitPreviewCandidates(hostedOnly);

    if (candidates.length < 2) {
      const dataUrlFallback = delivered.filter((candidate) => /^data:image\//i.test(candidate.imageDataUrl.trim()));
      if (dataUrlFallback.length >= 2) {
        candidates = dataUrlFallback;
      }
    }

    if (candidates.length < 2) {
      const hasCloudinary = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME
        && process.env.CLOUDINARY_API_KEY
        && process.env.CLOUDINARY_API_SECRET,
      );
      return NextResponse.json(
        {
          error: hasCloudinary
            ? 'Not enough portrait previews were generated. Please try again.'
            : 'Portrait hosting is not configured. Set CLOUDINARY_* env vars so previews can load in the browser.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, candidates: candidates.slice(0, 3) });
  } catch (error) {
    console.error('[virtual-girlfriend] portrait candidate generation failed', error);
    const message = error instanceof Error ? error.message : 'Unable to generate portrait candidates right now.';
    const timedOut = /timeout|timed out|FUNCTION_INVOCATION_TIMEOUT/i.test(message);
    return NextResponse.json(
      {
        error: timedOut
          ? 'Portrait generation took too long. Please tap Regenerate looks to try again.'
          : 'Unable to generate portrait candidates right now.',
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
