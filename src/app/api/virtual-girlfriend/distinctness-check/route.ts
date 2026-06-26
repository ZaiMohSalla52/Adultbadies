import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { listVirtualGirlfriends } from '@/lib/virtual-girlfriend/data';
import { findDistinctnessConflict, isCharacterDuplicateConflict } from '@/lib/virtual-girlfriend/distinctness';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';
import type { VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';

export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();

  if (!name) {
    return NextResponse.json({ ok: false, message: 'Name is required for distinctness check.' }, { status: 400 });
  }

  if (!body.archetype || !body.tone || !body.affectionStyle || !body.visualAesthetic) {
    return NextResponse.json({ ok: false, message: 'Derived profile fields are required.' }, { status: 400 });
  }

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
    return NextResponse.json({ ok: false, message: 'Invalid setup traits.' }, { status: 400 });
  }

  const structuredProfile: VirtualGirlfriendStructuredProfile = {
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
    breastSize: normalizedTraits.breastSize ?? null,
    occupation: normalizedTraits.occupation ?? null,
    personality: normalizedTraits.personality ?? null,
    sexuality: normalizedTraits.sexuality ?? null,
    freeformDetails: toOptionalString(body.freeformDetails),
    archetype: String(body.archetype ?? '').trim(),
    tone: String(body.tone ?? '').trim(),
    affectionStyle: String(body.affectionStyle ?? '').trim(),
    visualAesthetic: String(body.visualAesthetic ?? '').trim(),
    preferenceHints: toOptionalString(body.preferenceHints ?? body.freeformDetails),
    selectedPortraitPrompt: toOptionalString(body.selectedPortraitPrompt),
    selectedPortraitImage: toOptionalString(body.selectedPortraitImage),
  };

  const companions = await listVirtualGirlfriends(auth.accessToken, auth.user.id);
  const excludeCompanionId = typeof body.companionId === 'string' ? body.companionId.trim() || undefined : undefined;

  const conflict = findDistinctnessConflict({
    candidateProfile: structuredProfile,
    existingCompanions: companions,
    excludeCompanionId,
  });

  if (conflict && isCharacterDuplicateConflict(conflict)) {
    const conflictAreas = Array.from(new Set(conflict.topFields.map((field) => field.category)));
    const topFieldLabels = conflict.topFields.map((field) => CONFLICT_FIELD_LABELS[field.field] ?? field.field);
    const changeHint =
      topFieldLabels.length > 0
        ? `Try changing ${topFieldLabels.slice(0, 3).join(', ')}.`
        : 'Try changing hair, personality, occupation, or style.';

    return NextResponse.json(
      {
        ok: false,
        message: `This profile is too close to ${conflict.companionName}. ${changeHint}`,
        conflict: {
          ...conflict,
          conflictAreas,
          topFieldLabels,
        },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}