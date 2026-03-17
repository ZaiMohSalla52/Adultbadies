import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { generateVirtualGirlfriendImage } from '@/lib/virtual-girlfriend/image-provider';

const toDataUrl = (bytes: Buffer, mimeType: string) => `data:${mimeType};base64,${bytes.toString('base64')}`;

const buildPrompt = (input: {
  sex?: string;
  origin?: string;
  hairColor?: string;
  figure?: string;
  age?: string;
  variant: number;
}) => `Premium dating-app portrait, single ${input.sex ?? 'female'} adult, face-forward close-up, natural skin texture, realistic phone-camera photography.
Origin cue: ${input.origin ?? 'mixed'}.
Hair cue: ${input.hairColor ?? 'natural'}.
Body presentation cue: ${input.figure ?? 'balanced'}.
Age cue: ${input.age ?? 'mid-20s'}.
Variant mood ${input.variant + 1}: subtle expression change, different wardrobe color, same person continuity.
No text, no watermark, no explicit nudity.`;

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
    const candidates = await Promise.all(
      Array.from({ length: 4 }).map(async (_, index) => {
        const prompt = buildPrompt({ ...body, variant: index });
        const generated = await generateVirtualGirlfriendImage({ prompt, mode: 'legacy_independent', provider: 'openai' });
        return {
          id: `candidate-${index + 1}`,
          imageDataUrl: toDataUrl(generated.bytes, generated.mimeType),
          prompt,
          label: `Candidate ${index + 1}`,
        };
      }),
    );

    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    console.error('[virtual-girlfriend] portrait candidate generation failed', error);
    return NextResponse.json({ error: 'Unable to generate portrait candidates right now.' }, { status: 500 });
  }
}
