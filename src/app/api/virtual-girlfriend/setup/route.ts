import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getOrCreateVirtualGirlfriendConversation, upsertVirtualGirlfriend } from '@/lib/virtual-girlfriend/data';
import { generateAndPersistVirtualGirlfriendImagePack } from '@/lib/virtual-girlfriend/visual-identity';
import { generateVirtualGirlfriendPersona } from '@/lib/virtual-girlfriend/persona';
import type { VirtualGirlfriendSetupPayload } from '@/lib/virtual-girlfriend/types';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };

  if (!body.archetype || !body.tone || !body.affectionStyle || !body.visualAesthetic) {
    return NextResponse.json({ error: 'Please complete all setup selections.' }, { status: 400 });
  }

  const persona = await generateVirtualGirlfriendPersona(body);

  const companion = await upsertVirtualGirlfriend(auth.accessToken, {
    userId: auth.user.id,
    companionId: body.companionId?.trim() || undefined,
    createNew: Boolean(body.createNew),
    name: persona.displayName,
    bio: persona.shortBio,
    personaProfile: persona,
    archetype: body.archetype,
    tone: body.tone,
    affectionStyle: body.affectionStyle,
    visualAesthetic: body.visualAesthetic,
    preferenceHints: body.preferenceHints,
    profileTags: persona.vibeTags,
  });

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);

  try {
    await generateAndPersistVirtualGirlfriendImagePack({
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

    return NextResponse.json({ ok: true, companionId: companion.id, conversationId: conversation.id, imageStatus: 'ready' });
  } catch (error) {
    console.error('[virtual-girlfriend] setup image generation failed', error);
    return NextResponse.json({
      ok: true,
      companionId: companion.id,
      conversationId: conversation.id,
      imageStatus: 'failed',
      warning: 'Profile created, but image generation failed. You can still open and use this companion.',
    });
  }
}
