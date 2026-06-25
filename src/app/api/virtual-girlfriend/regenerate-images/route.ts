import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import {
  getVirtualGirlfriendCompanionById,
  setCanonicalReferenceImageId,
  setVirtualGirlfriendGenerationStatus,
} from '@/lib/virtual-girlfriend/data';
import {
  generateAndPersistVirtualGirlfriendImagePack,
  VirtualGirlfriendImagePackError,
} from '@/lib/virtual-girlfriend/visual-identity';

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

  const companion = await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, companionId);
  if (!companion?.setup_completed) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  const structured = companion.structured_profile;
  if (!structured?.selectedPortraitImage || !structured?.selectedPortraitPrompt) {
    return NextResponse.json({ error: 'Portrait reference missing — recreate this companion to retry images.' }, { status: 400 });
  }

  await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'generating');

  const imageSetup = {
    origin: structured.origin ?? undefined,
    archetype: structured.archetype,
    age: structured.age ?? undefined,
    hairColor: structured.hairColor ?? undefined,
    tone: structured.tone,
    affectionStyle: structured.affectionStyle,
    visualAesthetic: structured.visualAesthetic,
    occupation: structured.occupation ?? undefined,
    personality: structured.personality ?? undefined,
    preferenceHints: structured.preferenceHints ?? undefined,
    selectedPortraitPrompt: structured.selectedPortraitPrompt ?? undefined,
    selectedPortraitImage: structured.selectedPortraitImage ?? undefined,
    sex: structured.sex ?? undefined,
    hairLength: structured.hairLength ?? undefined,
    eyeColor: structured.eyeColor ?? undefined,
    skinTone: structured.skinTone ?? undefined,
    breastSize: structured.breastSize ?? undefined,
    styleVibe: structured.styleVibe ?? undefined,
    bodyType: structured.bodyType ?? structured.figure ?? undefined,
    figure: structured.figure ?? undefined,
    freeformDetails: structured.freeformDetails ?? undefined,
  };

  after(async () => {
    try {
      await generateAndPersistVirtualGirlfriendImagePack({
        token: auth.accessToken,
        userId: auth.user.id,
        companion,
        setup: imageSetup,
      });
      await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
    } catch (error) {
      console.error('[virtual-girlfriend][regenerate-images] failed', error);
      if (error instanceof VirtualGirlfriendImagePackError && error.canonicalImageId) {
        await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, error.canonicalImageId);
        await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
      } else {
        await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'failed');
      }
    }
  });

  return NextResponse.json({ ok: true, status: 'generating' });
}