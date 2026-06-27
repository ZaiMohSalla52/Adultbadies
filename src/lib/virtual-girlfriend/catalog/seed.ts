import { env } from '@/lib/env';
import { adminSupabaseRest, requireServiceRoleKey } from '@/lib/virtual-girlfriend/phase0/admin-rest';
import { generateVirtualGirlfriendPersona } from '@/lib/virtual-girlfriend/persona';
import { setVirtualGirlfriendGenerationStatus } from '@/lib/virtual-girlfriend/data';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';
import { generateAndPersistVirtualGirlfriendImagePack } from '@/lib/virtual-girlfriend/visual-identity';
import type { VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';
import { CATALOG_COMPANION_BLUEPRINTS, type CatalogCompanionBlueprint } from '@/lib/virtual-girlfriend/catalog/profiles';
import { CATALOG_COMPANION_LIMIT, CATALOG_PROFILE_KEY_TAG } from '@/lib/virtual-girlfriend/catalog/constants';

export type CatalogSeedResult = {
  ok: boolean;
  existingCount: number;
  created: string[];
  skipped: string[];
  failed: Array<{ key: string; error: string }>;
  target: number;
};

const resolveCatalogSystemUserId = () => {
  const fromEnv = process.env.CATALOG_SYSTEM_USER_ID?.trim() || env.CATALOG_SYSTEM_USER_ID?.trim();
  if (!fromEnv) {
    throw new Error('CATALOG_SYSTEM_USER_ID is required to seed catalog companions.');
  }
  return fromEnv;
};

const buildStructuredProfile = (blueprint: CatalogCompanionBlueprint): VirtualGirlfriendStructuredProfile => ({
  schemaVersion: 1,
  name: blueprint.name,
  archetype: blueprint.archetype,
  tone: blueprint.tone,
  affectionStyle: blueprint.affectionStyle,
  visualAesthetic: blueprint.visualAesthetic,
  ...blueprint.profile,
  preferenceHints: blueprint.profile.freeformDetails ?? null,
});

const listExistingCatalogKeys = async () => {
  const rows = await adminSupabaseRest<Array<{ profile_tags: string[] | null }>>('ai_companions', {
    searchParams: new URLSearchParams({
      select: 'profile_tags',
      source: 'eq.catalog',
      limit: String(CATALOG_COMPANION_LIMIT + 10),
    }),
  });

  const keys = new Set<string>();
  for (const row of rows) {
    const tag = row.profile_tags?.find((entry) => entry.startsWith(`${CATALOG_PROFILE_KEY_TAG}:`));
    if (tag) keys.add(tag.split(':')[1] ?? '');
  }
  return keys;
};

const countCatalogCompanions = async () => {
  const rows = await adminSupabaseRest<Array<{ id: string }>>('ai_companions', {
    searchParams: new URLSearchParams({
      select: 'id',
      source: 'eq.catalog',
      limit: String(CATALOG_COMPANION_LIMIT + 10),
    }),
  });
  return rows.length;
};

const insertCatalogCompanion = async (input: {
  systemUserId: string;
  blueprint: CatalogCompanionBlueprint;
  persona: Awaited<ReturnType<typeof generateVirtualGirlfriendPersona>>;
  structuredProfile: VirtualGirlfriendStructuredProfile;
}) => {
  const rows = await adminSupabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', {
    method: 'POST',
    body: {
      user_id: input.systemUserId,
      source: 'catalog',
      name: input.blueprint.name,
      persona_prompt: 'Catalog companion',
      display_bio: input.persona.shortBio,
      persona_profile: input.persona,
      structured_profile: input.structuredProfile,
      archetype: input.blueprint.archetype,
      tone: input.blueprint.tone,
      affection_style: input.blueprint.affectionStyle,
      visual_aesthetic: input.blueprint.visualAesthetic,
      preference_hints: input.structuredProfile.freeformDetails,
      profile_tags: [
        `${CATALOG_PROFILE_KEY_TAG}:${input.blueprint.key}`,
        ...(input.persona.vibeTags ?? []).slice(0, 4),
      ],
      setup_completed: true,
      generation_status: 'generating',
      disclosure_label: 'AI-generated companion',
      is_discoverable: true,
      is_active: false,
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};

const seedSingleCatalogCompanion = async (input: {
  token: string;
  systemUserId: string;
  blueprint: CatalogCompanionBlueprint;
}) => {
  const structuredProfile = buildStructuredProfile(input.blueprint);
  const persona = await generateVirtualGirlfriendPersona({
    name: input.blueprint.name,
    sex: structuredProfile.sex ?? undefined,
    archetype: input.blueprint.archetype,
    tone: input.blueprint.tone,
    affectionStyle: input.blueprint.affectionStyle,
    visualAesthetic: input.blueprint.visualAesthetic,
    personality: structuredProfile.personality ?? undefined,
    occupation: structuredProfile.occupation ?? undefined,
    sexuality: structuredProfile.sexuality ?? undefined,
    styleVibe: structuredProfile.styleVibe ?? undefined,
    freeformDetails: structuredProfile.freeformDetails ?? undefined,
    origin: structuredProfile.origin ?? undefined,
    hairColor: structuredProfile.hairColor ?? undefined,
    age: structuredProfile.age ?? undefined,
    bodyType: structuredProfile.bodyType ?? undefined,
  });

  const companion = await insertCatalogCompanion({
    systemUserId: input.systemUserId,
    blueprint: input.blueprint,
    persona,
    structuredProfile,
  });

  await generateAndPersistVirtualGirlfriendImagePack({
    token: input.token,
    userId: input.systemUserId,
    companion,
    setup: {
      origin: structuredProfile.origin ?? undefined,
      sex: structuredProfile.sex ?? undefined,
      age: structuredProfile.age ?? undefined,
      hairColor: structuredProfile.hairColor ?? undefined,
      hairLength: structuredProfile.hairLength ?? undefined,
      eyeColor: structuredProfile.eyeColor ?? undefined,
      skinTone: structuredProfile.skinTone ?? undefined,
      styleVibe: structuredProfile.styleVibe ?? undefined,
      bodyType: structuredProfile.bodyType ?? undefined,
      breastSize: structuredProfile.breastSize ?? undefined,
      archetype: structuredProfile.archetype,
      tone: structuredProfile.tone,
      affectionStyle: structuredProfile.affectionStyle,
      visualAesthetic: structuredProfile.visualAesthetic,
      occupation: structuredProfile.occupation ?? undefined,
      personality: structuredProfile.personality ?? undefined,
      preferenceHints: structuredProfile.preferenceHints ?? undefined,
      freeformDetails: structuredProfile.freeformDetails ?? undefined,
    },
  });

  await setVirtualGirlfriendGenerationStatus(input.token, input.systemUserId, companion.id, 'ready');
};

export const seedCatalogCompanions = async (options?: { maxToCreate?: number }): Promise<CatalogSeedResult> => {
  const token = requireServiceRoleKey();
  const systemUserId = resolveCatalogSystemUserId();
  const existingCount = await countCatalogCompanions();
  const existingKeys = await listExistingCatalogKeys();

  const remaining = Math.max(0, CATALOG_COMPANION_LIMIT - existingCount);
  const maxToCreate = Math.min(remaining, options?.maxToCreate ?? remaining);

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  if (maxToCreate <= 0) {
    return {
      ok: true,
      existingCount,
      created,
      skipped: CATALOG_COMPANION_BLUEPRINTS.map((blueprint) => blueprint.key),
      failed,
      target: CATALOG_COMPANION_LIMIT,
    };
  }

  let createdThisRun = 0;
  for (const blueprint of CATALOG_COMPANION_BLUEPRINTS) {
    if (createdThisRun >= maxToCreate) break;
    if (existingKeys.has(blueprint.key)) {
      skipped.push(blueprint.key);
      continue;
    }

    try {
      await seedSingleCatalogCompanion({ token, systemUserId, blueprint });
      created.push(blueprint.key);
      existingKeys.add(blueprint.key);
      createdThisRun += 1;
    } catch (error) {
      failed.push({
        key: blueprint.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: failed.length === 0,
    existingCount: existingCount + created.length,
    created,
    skipped,
    failed,
    target: CATALOG_COMPANION_LIMIT,
  };
};