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
import type { VirtualGirlfriendSetupPayload, VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';


const CONFLICT_FIELD_LABELS: Record<string, string> = {
  selectedPortraitPrompt: 'portrait style',
  selectedPortraitImageKey: 'portrait choice',
  hairColor: 'hair color',
  figure: 'body type',
  sex: 'sex',
  origin: 'origin',
  ethnicity: 'ethnicity',
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
  likes: 'likes',
  habits: 'habits',
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOptionalStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return normalized.length ? normalized : null;
};

const buildStructuredProfile = (body: Record<string, unknown>, name: string): VirtualGirlfriendStructuredProfile => ({
  schemaVersion: 1,
  name,
  sex: toOptionalString(body.sex),
  age: typeof body.age === 'number' || typeof body.age === 'string' ? body.age : null,
  origin: toOptionalString(body.origin),
  ethnicity: toOptionalString(body.ethnicity),
  hairColor: toOptionalString(body.hairColor),
  figure: toOptionalString(body.figure),
  chestSize: toOptionalString(body.chestSize),
  occupation: toOptionalString(body.occupation),
  personality: toOptionalString(body.personality),
  sexuality: toOptionalString(body.sexuality),
  freeformDetails: toOptionalString(body.freeformDetails),
  likes: toOptionalStringArray(body.likes),
  habits: toOptionalStringArray(body.habits),
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
- Keep it feminine and natural.
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

  const body = (await request.json()) as VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };

  const baseName = String(body.name ?? '').trim();

  if (!baseName) {
    return NextResponse.json({ error: 'Please enter a companion name.' }, { status: 400 });
  }

  if (!body.archetype || !body.tone || !body.affectionStyle || !body.visualAesthetic) {
    return NextResponse.json({ error: 'Please complete all setup selections.' }, { status: 400 });
  }

  const setupPayload: VirtualGirlfriendSetupPayload = {
    ...body,
    name: baseName,
  };

  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);
  const maxDistinctnessAttempts = Boolean(body.createNew) ? 3 : 1;

  let chosenName = baseName;

  let structuredProfile = buildStructuredProfile(body, chosenName);
  const preferenceHints = structuredProfile.preferenceHints;
  const selectedPortraitPrompt = structuredProfile.selectedPortraitPrompt;
  const selectedPortraitImage = structuredProfile.selectedPortraitImage;

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

    if (!suggestion || suggestion.toLowerCase() === chosenName.toLowerCase()) {
      break;
    }

    chosenName = suggestion;
    structuredProfile = buildStructuredProfile(body, chosenName);

    conflict = findDistinctnessConflict({
      candidateProfile: structuredProfile,
      existingCompanions: companions,
      excludeCompanionId: body.companionId?.trim() || undefined,
    });
  }

  if (conflict) {
    const conflictAreas = Array.from(new Set(conflict.topFields.map((field) => field.category)));
    const topFieldLabels = conflict.topFields.map((field) => CONFLICT_FIELD_LABELS[field.field] ?? field.field);

    return NextResponse.json(
      {
        error: `Too close to ${conflict.companionName}. Try changing name, appearance, personality, or relationship vibe.`,
        conflict: {
          ...conflict,
          conflictAreas,
          topFieldLabels,
        },
      },
      { status: 409 },
    );
  }

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
    archetype: body.archetype,
    tone: body.tone,
    affectionStyle: body.affectionStyle,
    visualAesthetic: body.visualAesthetic,
    preferenceHints: preferenceHints ?? undefined,
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
        preferenceHints: preferenceHints ?? undefined,
        selectedPortraitPrompt: selectedPortraitPrompt ?? undefined,
        selectedPortraitImage: selectedPortraitImage ?? undefined,
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
