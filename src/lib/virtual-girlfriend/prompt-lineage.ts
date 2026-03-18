import { env } from '@/lib/env';

type ImageLineageRow = {
  id: string;
  companion_id: string;
  prompt_text: string | null;
  prompt_version: string | null;
  surface_type: string | null;
  created_at: string;
};

type ProfileSeedRow = {
  id: string;
  seed_prompt: string | null;
  prompt_version: string | null;
  surface_type: string | null;
};

type CompanionHistoryRow = {
  id: string;
  surface_type: string | null;
  prompt_version: string | null;
  created_at: string;
};

const fetchLineageRows = async <T>(path: string): Promise<T[]> => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Prompt lineage query failed (${response.status}).`);
  }

  return (await response.json()) as T[];
};

export const getImageLineage = async (imageId: string) => {
  const safeImageId = encodeURIComponent(imageId);
  const rows = await fetchLineageRows<ImageLineageRow>(
    `ai_companion_images?select=id,companion_id,prompt_text,prompt_version,surface_type,created_at&id=eq.${safeImageId}&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;

  return {
    imageId: row.id,
    companionId: row.companion_id,
    promptText: row.prompt_text,
    promptVersion: row.prompt_version,
    surfaceType: row.surface_type,
    generatedAt: row.created_at,
  };
};

export const getProfileSeedPrompt = async (visualProfileId: string) => {
  const safeVisualProfileId = encodeURIComponent(visualProfileId);
  const rows = await fetchLineageRows<ProfileSeedRow>(
    `ai_companion_visual_profiles?select=id,seed_prompt,prompt_version,surface_type&id=eq.${safeVisualProfileId}&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;

  return {
    profileId: row.id,
    seedPrompt: row.seed_prompt,
    promptVersion: row.prompt_version,
    surfaceType: row.surface_type,
  };
};

export const getCompanionGenerationHistory = async (companionId: string, limit = 20) => {
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  const safeCompanionId = encodeURIComponent(companionId);
  const rows = await fetchLineageRows<CompanionHistoryRow>(
    `ai_companion_images?select=id,surface_type,prompt_version,created_at&companion_id=eq.${safeCompanionId}&order=created_at.desc&limit=${cappedLimit}`,
  );

  return rows.map((row) => ({
    imageId: row.id,
    surfaceType: row.surface_type,
    promptVersion: row.prompt_version,
    generatedAt: row.created_at,
  }));
};
