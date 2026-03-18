import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { runPortraitPreviewImageMachine } from '@/lib/virtual-girlfriend/image-machine';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

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
    });

    // Preview-only: this does not persist companion images and is intentionally separate from canonical setup persistence.
    const result = await runPortraitPreviewImageMachine({
      kind: 'portrait_preview',
      ...resolvedTraits,
      count: 4,
    });

    return NextResponse.json({ ok: true, candidates: result.candidates });
  } catch (error) {
    console.error('[virtual-girlfriend] portrait candidate generation failed', error);
    return NextResponse.json({ error: 'Unable to generate portrait candidates right now.' }, { status: 500 });
  }
}
