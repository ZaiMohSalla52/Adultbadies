import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  getOrCreateVirtualGirlfriendConversation,
  listVirtualGirlfriends,
  setCanonicalReferenceImageId,
  setVirtualGirlfriendGenerationStatus,
  upsertVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import { findDistinctnessConflict } from '@/lib/virtual-girlfriend/distinctness';
import {
  generateAndPersistVirtualGirlfriendImagePack,
  VirtualGirlfriendImagePackError,
} from '@/lib/virtual-girlfriend/visual-identity';
import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import { generateVirtualGirlfriendPersona, resolvePersonaSemanticInput } from '@/lib/virtual-girlfriend/persona';
import type {
  VirtualGirlfriendSetupPayload,
  VirtualGirlfriendSetupResult,
  VirtualGirlfriendStructuredProfile,
} from '@/lib/virtual-girlfriend/types';

const CONFLICT_FIELD_LABELS: Record<string, string> = {
  selectedPortraitPrompt: 'portrait style',
  selectedPortraitImageKey: 'portrait choice',
  hairColor: 'hair color',
  figure: 'body type',
  sex: 'sex',
  origin: 'origin',
  ageBand: 'age',
  occupation: 'occupation',
  personality: 'personality',
  sexuality: 'sexuality',
  archetype: 'archetype',
  tone: 'tone',
  affectionStyle: 'relationship vibe',
  visualAesthetic: 'visual aesthetic',
  preferenceHints: 'preference hints',
  freeformDetails: 'details',
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeSetupInput = (body: Record<string, unknown>, name: string): VirtualGirlfriendStructuredProfile => ({
  schemaVersion: 1,
  name,
  sex: toOptionalString(body.sex),
  age: typeof body.age === 'number' || typeof body.age === 'string' ? body.age : null,
  origin: toOptionalString(body.origin),
  hairColor: toOptionalString(body.hairColor),
  figure: toOptionalString(body.figure),
  occupation: toOptionalString(body.occupation),
  personality: toOptionalString(body.personality),
  sexuality: toOptionalString(body.sexuality),
  freeformDetails: toOptionalString(body.freeformDetails),
  archetype: String(body.archetype ?? '').trim(),
  tone: String(body.tone ?? '').trim(),
  affectionStyle: String(body.affectionStyle ?? '').trim(),
  visualAesthetic: String(body.visualAesthetic ?? '').trim(),
  preferenceHints: toOptionalString(body.preferenceHints ?? body.freeformDetails),
  selectedPortraitPrompt: toOptionalString(body.selectedPortraitPrompt),
  selectedPortraitImage: toOptionalString(body.selectedPortraitImage),
});

const generateDistinctNameSuggestion = async (input: {
  proposedName: string;
  profile: VirtualGirlfriendStructuredProfile;
  existingNames: string[];
  conflictReasons: string[];
}) => {
  const prompt = `Return strict JSON with a better distinct companion name.
{
  "name": string
}

Rules:
- Keep it natural.
- 1-2 words, max 24 chars.
- Must be meaningfully distinct from: ${input.existingNames.join(', ') || 'none'}.
- Avoid same surname/family variants.
- Preserve profile vibe: archetype=${input.profile.archetype}, tone=${input.profile.tone}, visual=${input.profile.visualAesthetic}.
- Prior conflict reasons: ${input.conflictReasons.join(', ') || 'none'}.
- Current blocked name: ${input.proposedName}.
- Output JSON only.`;

  try {
    const response = await callOpenAIResponses({
      model: 'gpt-5-mini',
      input: [{ role: 'user', content: prompt }],
      reasoning: { effort: 'medium' },
    });

    const parsed = JSON.parse(extractResponsesText(response)) as { name?: string };
    const suggestion = String(parsed.name ?? '').trim();
    return suggestion || null;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  console.info('[virtual-girlfriend][setup] request received', { userId: auth.user.id });

  const body = (await request.json()) as VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };
  const baseName = String(body.name ?? '').trim();

  if (!baseName) {
    return NextResponse.json({ state: 'blocked_pre_gen', message: 'Please enter a companion name.' } satisfies VirtualGirlfriendSetupResult, {
      status: 400,
    });
  }

  if (!body.archetype || !body.tone || !body.affectionStyle || !body.visualAesthetic || !body.selectedPortraitImage || !body.selectedPortraitPrompt) {
    return NextResponse.json(
      { state: 'blocked_pre_gen', message: 'Please complete all setup selections before generating.' } satisfies VirtualGirlfriendSetupResult,
      { status: 400 },
    );
  }

  const setupPayload: VirtualGirlfriendSetupPayload = { ...body, name: baseName };
  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);
  const maxDistinctnessAttempts = Boolean(body.createNew) ? 3 : 1;

  let chosenName = baseName;
  let structuredProfile = normalizeSetupInput(body, chosenName);

  console.info('[virtual-girlfriend][setup] normalized input built', {
    userId: auth.user.id,
    name: structuredProfile.name,
    createNew: Boolean(body.createNew),
  });

  let conflict = findDistinctnessConflict({
    candidateProfile: structuredProfile,
    existingCompanions: companions,
    excludeCompanionId: body.companionId?.trim() || undefined,
  });

  for (let attempt = 1; conflict && attempt < maxDistinctnessAttempts; attempt += 1) {
    const suggestion = await generateDistinctNameSuggestion({
      proposedName: chosenName,
      profile: structuredProfile,
      existingNames: companions.map((companion) => companion.name),
      conflictReasons: conflict.reasons,
    });

    if (!suggestion || suggestion.toLowerCase() === chosenName.toLowerCase()) break;

    chosenName = suggestion;
    structuredProfile = normalizeSetupInput(body, chosenName);
    conflict = findDistinctnessConflict({
      candidateProfile: structuredProfile,
      existingCompanions: companions,
      excludeCompanionId: body.companionId?.trim() || undefined,
    });
  }

  if (conflict) {
    const conflictAreas = Array.from(new Set(conflict.topFields.map((field) => field.category)));
    const topFieldLabels = conflict.topFields.map((field) => CONFLICT_FIELD_LABELS[field.field] ?? field.field);

    console.info('[virtual-girlfriend][setup] distinctness conflict', {
      userId: auth.user.id,
      blockedByCompanionId: conflict.companionId,
      reasons: conflict.reasons,
    });

    return NextResponse.json(
      {
        state: 'blocked_pre_gen',
        message: `Generation did not start. This profile is too close to ${conflict.companionName}. Change some traits and try again.`,
        conflict: {
          ...conflict,
          conflictAreas,
          topFieldLabels,
        },
      } satisfies VirtualGirlfriendSetupResult,
      { status: 409 },
    );
  }

  console.info('[virtual-girlfriend][setup] accepted past distinctness', { userId: auth.user.id, name: chosenName });

  const personaInput = resolvePersonaSemanticInput({
    structuredProfile,
    fallback: { ...setupPayload, name: chosenName },
  });
  const persona = await generateVirtualGirlfriendPersona(personaInput);

  const companion = await upsertVirtualGirlfriend(auth.accessToken, {
    userId: auth.user.id,
    companionId: body.companionId?.trim() || undefined,
    createNew: Boolean(body.createNew),
    name: chosenName,
    bio: persona.shortBio,
    personaProfile: persona,
    archetype: structuredProfile.archetype,
    tone: structuredProfile.tone,
    affectionStyle: structuredProfile.affectionStyle,
    visualAesthetic: structuredProfile.visualAesthetic,
    preferenceHints: structuredProfile.preferenceHints ?? undefined,
    profileTags: persona.vibeTags,
    structuredProfile,
  });

  console.info('[virtual-girlfriend][setup] companion persisted', { userId: auth.user.id, companionId: companion.id });

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);

  try {
    console.info('[virtual-girlfriend][setup] visual generation started', { userId: auth.user.id, companionId: companion.id });

    const generatedPack = await generateAndPersistVirtualGirlfriendImagePack({
      token: auth.accessToken,
      userId: auth.user.id,
      companion,
      setup: {
        archetype: structuredProfile.archetype,
        tone: structuredProfile.tone,
        affectionStyle: structuredProfile.affectionStyle,
        visualAesthetic: structuredProfile.visualAesthetic,
        preferenceHints: structuredProfile.preferenceHints ?? undefined,
        selectedPortraitPrompt: structuredProfile.selectedPortraitPrompt ?? undefined,
        selectedPortraitImage: structuredProfile.selectedPortraitImage ?? undefined,
        sex: structuredProfile.sex ?? undefined,
      },
    });

    if (generatedPack.canonicalImage) {
      await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, generatedPack.canonicalImage.id);
    }

    await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
    console.info('[virtual-girlfriend][setup] provider success + persistence complete', { userId: auth.user.id, companionId: companion.id });

    return NextResponse.json({
      state: 'ready',
      companionId: companion.id,
      conversationId: conversation.id,
      message: 'Companion created with locked portrait and gallery continuity.',
    } satisfies VirtualGirlfriendSetupResult);
  } catch (error) {
    console.error('[virtual-girlfriend][setup] provider failure', error);

    if (error instanceof VirtualGirlfriendImagePackError && error.canonicalImageId) {
      await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, error.canonicalImageId);
      await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
      console.info('[virtual-girlfriend][setup] canonical persisted but gallery generation failed', {
        userId: auth.user.id,
        companionId: companion.id,
        canonicalImageId: error.canonicalImageId,
      });

      return NextResponse.json({
        state: 'partial_success',
        companionId: companion.id,
        conversationId: conversation.id,
        warning: 'Her locked portrait is ready, but gallery expansion failed this pass. You can continue now and retry gallery moments later.',
      } satisfies VirtualGirlfriendSetupResult, { status: 207 });
    }

    await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'failed');
    console.info('[virtual-girlfriend][setup] persistence complete with failed image status', { userId: auth.user.id, companionId: companion.id });

    return NextResponse.json({
      state: 'failed',
      companionId: companion.id,
      conversationId: conversation.id,
      message: 'Profile was created, but we could not complete image generation. Open the profile to retry from a stable state.',
    } satisfies VirtualGirlfriendSetupResult, { status: 502 });
  }
}
