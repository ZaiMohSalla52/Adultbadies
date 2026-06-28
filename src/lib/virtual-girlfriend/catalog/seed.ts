import { env } from '@/lib/env';
import { adminSupabaseRest, requireServiceRoleKey } from '@/lib/virtual-girlfriend/phase0/admin-rest';
import { generateVirtualGirlfriendPersona } from '@/lib/virtual-girlfriend/persona';
import { setVirtualGirlfriendGenerationStatus } from '@/lib/virtual-girlfriend/data';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';
import { generateAndPersistVirtualGirlfriendImagePack } from '@/lib/virtual-girlfriend/visual-identity';
import type { VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';
import { mergeCatalogFreeformDetails } from '@/lib/virtual-girlfriend/catalog/distinctness';
import { CATALOG_COMPANION_BLUEPRINTS, type CatalogCompanionBlueprint } from '@/lib/virtual-girlfriend/catalog/profiles';

export type { CatalogCompanionBlueprint };
import { CATALOG_COMPANION_LIMIT, CATALOG_PROFILE_KEY_TAG } from '@/lib/virtual-girlfriend/catalog/constants';

export type CatalogSeedResult = {
  ok: boolean;
  existingCount: number;
  created: string[];
  skipped: string[];
  resumed: string[];
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

const listExistingCatalogCompanions = async () =>
  adminSupabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', {
    searchParams: new URLSearchParams({
      select: '*',
      source: 'eq.catalog',
      order: 'created_at.asc',
      limit: String(CATALOG_COMPANION_LIMIT + 10),
    }),
  });

const buildStructuredProfile = (
  blueprint: CatalogCompanionBlueprint,
  siblings: VirtualGirlfriendCompanionRecord[],
): VirtualGirlfriendStructuredProfile => {
  const freeformDetails = mergeCatalogFreeformDetails(blueprint, siblings);
  return {
    schemaVersion: 1,
    name: blueprint.name,
    archetype: blueprint.archetype,
    tone: blueprint.tone,
    affectionStyle: blueprint.affectionStyle,
    visualAesthetic: blueprint.visualAesthetic,
    ...blueprint.profile,
    freeformDetails,
    preferenceHints: freeformDetails,
  };
};

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

const resolveCatalogKeyFromTags = (profileTags: string[] | null | undefined) => {
  const tag = profileTags?.find((entry) => entry.startsWith(`${CATALOG_PROFILE_KEY_TAG}:`));
  return tag?.split(':')[1] ?? null;
};

const buildImagePackSetup = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  structuredProfile: VirtualGirlfriendStructuredProfile;
}) => ({
  origin: input.structuredProfile.origin ?? undefined,
  sex: input.structuredProfile.sex ?? undefined,
  age: input.structuredProfile.age ?? undefined,
  hairColor: input.structuredProfile.hairColor ?? undefined,
  hairLength: input.structuredProfile.hairLength ?? undefined,
  eyeColor: input.structuredProfile.eyeColor ?? undefined,
  skinTone: input.structuredProfile.skinTone ?? undefined,
  styleVibe: input.structuredProfile.styleVibe ?? undefined,
  bodyType: input.structuredProfile.bodyType ?? undefined,
  breastSize: input.structuredProfile.breastSize ?? undefined,
  archetype: input.structuredProfile.archetype,
  tone: input.structuredProfile.tone,
  affectionStyle: input.structuredProfile.affectionStyle,
  visualAesthetic: input.structuredProfile.visualAesthetic,
  occupation: input.structuredProfile.occupation ?? undefined,
  personality: input.structuredProfile.personality ?? undefined,
  preferenceHints: input.structuredProfile.preferenceHints ?? undefined,
  freeformDetails: input.structuredProfile.freeformDetails ?? undefined,
});

const finishCatalogCompanionImages = async (input: {
  token: string;
  systemUserId: string;
  companion: VirtualGirlfriendCompanionRecord;
}) => {
  const structuredProfile = input.companion.structured_profile;
  if (!structuredProfile) {
    throw new Error('Companion is missing structured_profile.');
  }

  await generateAndPersistVirtualGirlfriendImagePack({
    token: input.token,
    userId: input.systemUserId,
    companion: input.companion,
    setup: buildImagePackSetup({ companion: input.companion, structuredProfile }),
  });

  await setVirtualGirlfriendGenerationStatus(input.token, input.systemUserId, input.companion.id, 'ready');
};

const listIncompleteCatalogCompanions = async () =>
  adminSupabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', {
    searchParams: new URLSearchParams({
      select: '*',
      source: 'eq.catalog',
      generation_status: 'eq.generating',
      order: 'created_at.asc',
      limit: String(CATALOG_COMPANION_LIMIT + 10),
    }),
  });

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
  existingSiblings: VirtualGirlfriendCompanionRecord[];
}) => {
  const structuredProfile = buildStructuredProfile(input.blueprint, input.existingSiblings);
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

  await finishCatalogCompanionImages({
    token: input.token,
    systemUserId: input.systemUserId,
    companion,
  });
};

export const resumeCatalogCompanions = async (options?: { maxToResume?: number }): Promise<CatalogSeedResult> => {
  const token = requireServiceRoleKey();
  const systemUserId = resolveCatalogSystemUserId();
  const incomplete = await listIncompleteCatalogCompanions();
  const maxToResume = options?.maxToResume ?? incomplete.length;

  const resumed: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  for (const companion of incomplete.slice(0, maxToResume)) {
    const key = resolveCatalogKeyFromTags(companion.profile_tags) ?? companion.name;
    try {
      await finishCatalogCompanionImages({ token, systemUserId, companion });
      resumed.push(key);
      console.info(`[catalog-seed] resumed ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ key, error: message });
      console.error(`[catalog-seed] resume failed ${key}: ${message}`);
    }
  }

  const existingCount = await countCatalogCompanions();
  return {
    ok: failed.length === 0,
    existingCount,
    created: [],
    skipped: [],
    resumed,
    failed,
    target: CATALOG_COMPANION_LIMIT,
  };
};

export const seedCatalogCompanions = async (options?: {
  maxToCreate?: number;
  blueprints?: CatalogCompanionBlueprint[];
}): Promise<CatalogSeedResult> => {
  const token = requireServiceRoleKey();
  const systemUserId = resolveCatalogSystemUserId();
  const blueprintList = options?.blueprints ?? CATALOG_COMPANION_BLUEPRINTS;
  const existingCount = await countCatalogCompanions();
  const existingKeys = await listExistingCatalogKeys();

  const remaining = Math.max(0, CATALOG_COMPANION_LIMIT - existingCount);
  const maxToCreate = Math.min(remaining, options?.maxToCreate ?? remaining);

  const created: string[] = [];
  const skipped: string[] = [];
  const resumed: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  if (maxToCreate <= 0) {
    return {
      ok: true,
      existingCount,
      created,
      skipped: blueprintList.map((blueprint) => blueprint.key),
      resumed,
      failed,
      target: CATALOG_COMPANION_LIMIT,
    };
  }

  let createdThisRun = 0;
  for (const blueprint of blueprintList) {
    if (createdThisRun >= maxToCreate) break;
    if (existingKeys.has(blueprint.key)) {
      skipped.push(blueprint.key);
      continue;
    }

    try {
      const existingSiblings = await listExistingCatalogCompanions();
      await seedSingleCatalogCompanion({ token, systemUserId, blueprint, existingSiblings });
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
    resumed,
    failed,
    target: CATALOG_COMPANION_LIMIT,
  };
};