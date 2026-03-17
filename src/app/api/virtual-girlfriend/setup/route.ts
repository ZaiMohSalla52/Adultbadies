import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getOrCreateVirtualGirlfriendConversation,
  setCanonicalReferenceImageId,
  setVirtualGirlfriendGenerationStatus,
  upsertVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import {
  generateAndPersistVirtualGirlfriendImagePack,
  VirtualGirlfriendImagePackError,
} from '@/lib/virtual-girlfriend/visual-identity';
import { generateVirtualGirlfriendPersona, resolvePersonaSemanticInput } from '@/lib/virtual-girlfriend/persona';
import type { VirtualGirlfriendSetupPayload, VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };

  const name = String(body.name ?? '').trim();

  if (!name) {
    return NextResponse.json({ error: 'Please enter a companion name.' }, { status: 400 });
  }

  if (!body.archetype || !body.tone || !body.affectionStyle || !body.visualAesthetic) {
    return NextResponse.json({ error: 'Please complete all setup selections.' }, { status: 400 });
  }

  const setupPayload: VirtualGirlfriendSetupPayload = {
    ...body,
    name,
  };

  const structuredProfile = {
    schemaVersion: 1,
    name,
    archetype: body.archetype,
    tone: body.tone,
    affectionStyle: body.affectionStyle,
    visualAesthetic: body.visualAesthetic,
    preferenceHints: body.preferenceHints?.trim() || null,
  } satisfies VirtualGirlfriendStructuredProfile;

  const personaInput = resolvePersonaSemanticInput({
    structuredProfile,
    fallback: setupPayload,
  });

  const persona = await generateVirtualGirlfriendPersona(personaInput);

  const companion = await upsertVirtualGirlfriend(auth.accessToken, {
    userId: auth.user.id,
    companionId: body.companionId?.trim() || undefined,
    createNew: Boolean(body.createNew),
    name,
    bio: persona.shortBio,
    personaProfile: persona,
    archetype: body.archetype,
    tone: body.tone,
    affectionStyle: body.affectionStyle,
    visualAesthetic: body.visualAesthetic,
    preferenceHints: body.preferenceHints,
    profileTags: persona.vibeTags,
    structuredProfile,
  });

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);

  try {
    const generatedPack = await generateAndPersistVirtualGirlfriendImagePack({
      token: auth.accessToken,
      userId: auth.user.id,
      companion,
      setup: {
        archetype: body.archetype,
        tone: body.tone,
        affectionStyle: body.affectionStyle,
        visualAesthetic: body.visualAesthetic,
        preferenceHints: body.preferenceHints,
      },
    });

    if (generatedPack.canonicalImage) {
      await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, generatedPack.canonicalImage.id);
    }

    await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
    return NextResponse.json({ ok: true, companionId: companion.id, conversationId: conversation.id, imageStatus: 'ready' });
  } catch (error) {
    console.error('[virtual-girlfriend] setup image generation failed', error);

    if (error instanceof VirtualGirlfriendImagePackError && error.canonicalImageId) {
      await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, error.canonicalImageId);
    }

    await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'failed');
    return NextResponse.json({
      ok: true,
      companionId: companion.id,
      conversationId: conversation.id,
      imageStatus: 'failed',
      warning: 'Profile created, but image generation failed. You can still open and use this companion.',
    });
  }
}
