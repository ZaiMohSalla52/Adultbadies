import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { runPortraitPreviewImageMachine } from '@/lib/virtual-girlfriend/image-machine';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as {
    sex?: string;
    origin?: string;
    hairColor?: string;
    figure?: string;
    age?: string;
  };

  try {
    // Preview-only: this does not persist companion images and is intentionally separate from canonical setup persistence.
    const result = await runPortraitPreviewImageMachine({
      kind: 'portrait_preview',
      sex: body.sex,
      origin: body.origin,
      hairColor: body.hairColor,
      figure: body.figure,
      age: body.age,
      count: 4,
    });

    return NextResponse.json({ ok: true, candidates: result.candidates });
  } catch (error) {
    console.error('[virtual-girlfriend] portrait candidate generation failed', error);
    return NextResponse.json({ error: 'Unable to generate portrait candidates right now.' }, { status: 500 });
  }
}
