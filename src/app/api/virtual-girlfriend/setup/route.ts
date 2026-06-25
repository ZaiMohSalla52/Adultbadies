import { NextRequest, NextResponse, after } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import {
  getOrCreateVirtualGirlfriendConversation,
  insertVirtualGirlfriendMessage,
  listVirtualGirlfriends,
  setCanonicalReferenceImageId,
  setVirtualGirlfriendGenerationStatus,
  upsertVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import { buildCompanionOpeningMessage } from '@/lib/virtual-girlfriend/setup-greeting';
import { getCompanionLabels } from '@/lib/virtual-girlfriend/companion-labels';
import { findDistinctnessConflict, isCharacterDuplicateConflict } from '@/lib/virtual-girlfriend/distinctness';
import {
  generateAndPersistVirtualGirlfriendImagePack,
  VirtualGirlfriendImagePackError,
} from '@/lib/virtual-girlfriend/visual-identity';
import { VG_FAST_MODEL } from '@/lib/virtual-girlfriend/llm-models';
import { callTogetherChat, extractResponsesText } from '@/lib/virtual-girlfriend/llm-provider';
import { generateVirtualGirlfriendPersona, resolvePersonaSemanticInput } from '@/lib/virtual-girlfriend/persona';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';
import type {
  VirtualGirlfriendSetupPayload,
  VirtualGirlfriendSetupResult,
  VirtualGirlfriendStructuredProfile,
} from '@/lib/virtual-girlfriend/types';

// Setup generates the canonical portrait + gallery pack synchronously, which
// far exceeds the platform default function limit. 60s is the safe ceiling
// across Vercel plans; Pro/Enterprise can raise this to 300.
export const runtime = 'nodejs';
export const maxDuration = 300;

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

const normalizeSetupInput = (
  body: Record<string, unknown>,
  name: string,
  normalizedTraits: ReturnType<typeof resolveSetupTraits>,
): VirtualGirlfriendStructuredProfile => ({
  schemaVersion: 1,
  name,
  sex: normalizedTraits.sex,
  age: normalizedTraits.age,
  origin: normalizedTraits.origin,
  hairColor: normalizedTraits.hairColor,
  hairLength: normalizedTraits.hairLength,
  eyeColor: normalizedTraits.eyeColor,
  skinTone: normalizedTraits.skinTone ?? null,
  styleVibe: normalizedTraits.styleVibe ?? toOptionalString(body.styleVibe),
  figure: normalizedTraits.bodyType,
  bodyType: normalizedTraits.bodyType,
  breastSize: normalizedTraits.breastSize ?? toOptionalString(body.breastSize),
  occupation: normalizedTraits.occupation ?? toOptionalString(body.occupation),
  personality: normalizedTraits.personality ?? toOptionalString(body.personality),
  sexuality: normalizedTraits.sexuality ?? toOptionalString(body.sexuality),
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
    const response = await callTogetherChat({
      model: VG_FAST_MODEL,
      input: [{ role: 'user', content: prompt }],
    });

    const parsed = JSON.parse(extractResponsesText(response)) as { name?: string };
    const suggestion = String(parsed.name ?? '').trim();
    return suggestion || null;
  } catch {
    return null;
  }
};

// Deterministic fallback that guarantees a name not already in the user's roster.
// Used only for name-only collisions where the character is already distinct, so
// generation never hard-blocks on a name clash.
const ensureDistinctName = (proposedName: string, existingNames: string[]): string => {
  const norm = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const taken = new Set(existingNames.map(norm));
  if (!taken.has(norm(proposedName))) return proposedName;

  const firstName = proposedName.trim().split(/\s+/)[0] ?? proposedName.trim();
  const suffixes = ['Rae', 'Skye', 'Belle', 'Vale', 'Wren', 'Faye', 'Nova', 'Sol', 'Ivy', 'Lux'];
  for (const suffix of suffixes) {
    const candidate = `${firstName} ${suffix}`;
    if (!taken.has(norm(candidate))) return candidate;
  }

  let counter = 2;
  while (taken.has(norm(`${firstName} ${counter}`))) counter += 1;
  return `${firstName} ${counter}`;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  console.info('[virtual-girlfriend][setup] request received', { userId: auth.user.id });

  try {
  let body: VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };
  try {
    body = (await request.json()) as VirtualGirlfriendSetupPayload & { companionId?: string; createNew?: boolean };
  } catch {
    return NextResponse.json(
      {
        state: 'blocked_pre_gen',
        message: 'Setup payload was too large or invalid. Please regenerate portraits and try again.',
      } satisfies VirtualGirlfriendSetupResult,
      { status: 413 },
    );
  }
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
  let normalizedTraits: ReturnType<typeof resolveSetupTraits>;
  try {
    normalizedTraits = resolveSetupTraits({
      sex: typeof body.sex === 'string' ? body.sex : undefined,
      origin: typeof body.origin === 'string' ? body.origin : undefined,
      hairColor: typeof body.hairColor === 'string' ? body.hairColor : undefined,
      hairLength: typeof body.hairLength === 'string' ? body.hairLength : undefined,
      eyeColor: typeof body.eyeColor === 'string' ? body.eyeColor : undefined,
      bodyType: typeof body.bodyType === 'string' ? body.bodyType : undefined,
      age: typeof body.age === 'number' || typeof body.age === 'string' ? body.age : undefined,
      skinTone: typeof body.skinTone === 'string' ? body.skinTone : undefined,
      styleVibe: typeof body.styleVibe === 'string' ? body.styleVibe : undefined,
      personality: typeof body.personality === 'string' ? body.personality : undefined,
      breastSize: typeof body.breastSize === 'string' ? body.breastSize : undefined,
      occupation: typeof body.occupation === 'string' ? body.occupation : undefined,
      sexuality: typeof body.sexuality === 'string' ? body.sexuality : undefined,
      freeformDetails: typeof body.freeformDetails === 'string' ? body.freeformDetails : undefined,
    });
  } catch {
    return NextResponse.json(
      { state: 'blocked_pre_gen', message: 'Invalid setup traits. Please review your selections and try again.' } satisfies VirtualGirlfriendSetupResult,
      { status: 400 },
    );
  }
  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);
  const excludeCompanionId = body.companionId?.trim() || undefined;
  const existingNames = companions.map((companion) => companion.name);

  let chosenName = baseName;
  let structuredProfile = normalizeSetupInput(body, chosenName, normalizedTraits);

  console.info('[virtual-girlfriend][setup] normalized input built', {
    userId: auth.user.id,
    name: structuredProfile.name,
    createNew: Boolean(body.createNew),
  });

  const evaluateConflict = () =>
    findDistinctnessConflict({
      candidateProfile: structuredProfile,
      existingCompanions: companions,
      excludeCompanionId,
    });

  let conflict = evaluateConflict();

  // Name-only collisions never hard-block: try an LLM rename first, falling back
  // to deterministic disambiguation. Only a genuine duplicate character blocks.
  for (let attempt = 1; conflict && !isCharacterDuplicateConflict(conflict) && attempt <= 3; attempt += 1) {
    const suggestion = await generateDistinctNameSuggestion({
      proposedName: chosenName,
      profile: structuredProfile,
      existingNames,
      conflictReasons: conflict.reasons,
    });

    if (!suggestion || suggestion.toLowerCase() === chosenName.toLowerCase()) break;

    chosenName = suggestion;
    structuredProfile = normalizeSetupInput(body, chosenName, normalizedTraits);
    conflict = evaluateConflict();
  }

  // Any remaining name-only conflict is resolved deterministically so generation proceeds.
  if (conflict && !isCharacterDuplicateConflict(conflict)) {
    chosenName = ensureDistinctName(chosenName, existingNames);
    structuredProfile = normalizeSetupInput(body, chosenName, normalizedTraits);
    conflict = evaluateConflict();
    console.info('[virtual-girlfriend][setup] name collision auto-resolved', {
      userId: auth.user.id,
      resolvedName: chosenName,
    });
  }

  if (conflict && isCharacterDuplicateConflict(conflict)) {
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

  const openingMessage = buildCompanionOpeningMessage({
    name: chosenName,
    sex: structuredProfile.sex,
    persona,
    personality: structuredProfile.personality,
  });

  await insertVirtualGirlfriendMessage(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
    role: 'assistant',
    content: openingMessage,
    moderation: {},
    contentType: 'text',
  });

  const imageSetup = {
    origin: structuredProfile.origin ?? undefined,
    archetype: structuredProfile.archetype,
    age: structuredProfile.age ?? undefined,
    hairColor: structuredProfile.hairColor ?? undefined,
    tone: structuredProfile.tone,
    affectionStyle: structuredProfile.affectionStyle,
    visualAesthetic: structuredProfile.visualAesthetic,
    occupation: structuredProfile.occupation ?? undefined,
    personality: structuredProfile.personality ?? undefined,
    preferenceHints: structuredProfile.preferenceHints ?? undefined,
    selectedPortraitPrompt: structuredProfile.selectedPortraitPrompt ?? undefined,
    selectedPortraitImage: structuredProfile.selectedPortraitImage ?? undefined,
    sex: structuredProfile.sex ?? undefined,
    hairLength: structuredProfile.hairLength ?? undefined,
    eyeColor: structuredProfile.eyeColor ?? undefined,
    skinTone: structuredProfile.skinTone ?? undefined,
    breastSize: structuredProfile.breastSize ?? undefined,
    styleVibe: structuredProfile.styleVibe ?? undefined,
    bodyType: structuredProfile.bodyType ?? structuredProfile.figure ?? undefined,
    figure: structuredProfile.figure ?? undefined,
    freeformDetails: structuredProfile.freeformDetails ?? undefined,
  };

  // Decouple image generation from the request. The companion is persisted in
  // 'generating' state and the response returns immediately; the canonical +
  // gallery pack renders in the background and the profile page polls for it.
  after(async () => {
    const scope = { userId: auth.user.id, companionId: companion.id };
    try {
      console.info('[virtual-girlfriend][setup] background visual generation started', scope);
      await generateAndPersistVirtualGirlfriendImagePack({
        token: auth.accessToken,
        userId: auth.user.id,
        companion,
        setup: imageSetup,
      });
      await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
      console.info('[virtual-girlfriend][setup] background generation complete', scope);
    } catch (error) {
      console.error('[virtual-girlfriend][setup] background generation failure', error);
      if (error instanceof VirtualGirlfriendImagePackError && error.canonicalImageId) {
        // Canonical landed but gallery failed: keep the canonical and mark ready.
        await setCanonicalReferenceImageId(auth.accessToken, auth.user.id, companion.id, error.canonicalImageId);
        await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'ready');
      } else {
        await setVirtualGirlfriendGenerationStatus(auth.accessToken, auth.user.id, companion.id, 'failed');
      }
    }
  });

  console.info('[virtual-girlfriend][setup] companion ready; images generating in background', {
    userId: auth.user.id,
    companionId: companion.id,
  });

  const labels = getCompanionLabels(structuredProfile.sex);

  return NextResponse.json({
    state: 'generating',
    companionId: companion.id,
    conversationId: conversation.id,
    redirectTo: `/virtual-girlfriend/chat?companionId=${companion.id}`,
    message: `Your ${labels.roleShort.toLowerCase()} is ready to chat — ${labels.photosLabel} are generating now.`,
  } satisfies VirtualGirlfriendSetupResult);
  } catch (error) {
    console.error('[virtual-girlfriend][setup] unhandled failure', error);
    const detail = error instanceof Error ? error.message : String(error);
    const isSupabase = detail.includes('Supabase REST');
    const isPersona = /persona|together|modelslab|llm/i.test(detail);

    return NextResponse.json(
      {
        state: 'failed',
        message: isSupabase
          ? 'Could not save your companion right now. Please wait a moment and try again.'
          : isPersona
            ? 'Could not generate your companion personality. Please try again.'
            : 'Server error while creating your companion setup. Please try again.',
      } satisfies VirtualGirlfriendSetupResult,
      { status: 500 },
    );
  }
}
