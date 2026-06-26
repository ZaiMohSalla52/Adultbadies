#!/usr/bin/env tsx
/**
 * Phase 0 — canonical face diversity baseline
 *
 * Measures pairwise visual similarity between companions that share a user account.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npm run phase0:face-baseline
 *
 * Optional:
 *   PHASE0_OUT=reports/phase0
 *   PHASE0_MAX_USERS=50
 *   PHASE0_PER_USER=8
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadLocalEnv } from './load-local-env';
import { adminSupabaseRest } from '../src/lib/virtual-girlfriend/phase0/admin-rest';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));
import {
  buildPairwiseSimilarities,
  fingerprintFromBytes,
  summarizeFaceDiversity,
  type CanonicalCompanionRow,
} from '../src/lib/virtual-girlfriend/phase0/face-diversity-baseline';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.PHASE0_OUT ?? 'reports/phase0');
const MAX_USERS = Number(process.env.PHASE0_MAX_USERS ?? 50);
const PER_USER = Number(process.env.PHASE0_PER_USER ?? 8);

type CompanionRow = {
  id: string;
  user_id: string;
  name: string;
  setup_completed: boolean;
  structured_profile: { origin?: string | null; age?: string | number | null } | null;
};

type VisualProfileRow = {
  companion_id: string;
  canonical_reference_image_id: string | null;
};

type ImageRow = {
  id: string;
  delivery_url: string;
  origin_mime_type: string | null;
};

const fetchCanonicalRows = async () => {
  const companions = await adminSupabaseRest<CompanionRow[]>('ai_companions', {
    searchParams: new URLSearchParams({
      select: 'id,user_id,name,setup_completed,structured_profile',
      setup_completed: 'eq.true',
      order: 'created_at.desc',
      limit: String(MAX_USERS * PER_USER),
    }),
  });

  const byUser = new Map<string, CompanionRow[]>();
  for (const companion of companions ?? []) {
    const bucket = byUser.get(companion.user_id) ?? [];
    if (bucket.length < PER_USER) bucket.push(companion);
    byUser.set(companion.user_id, bucket);
  }

  const selected = [...byUser.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .slice(0, MAX_USERS)
    .flatMap(([, rows]) => rows);

  if (!selected.length) return [] as CanonicalCompanionRow[];

  const companionIds = selected.map((row) => row.id);
  const profiles = await adminSupabaseRest<VisualProfileRow[]>('ai_companion_visual_profiles', {
    searchParams: new URLSearchParams({
      select: 'companion_id,canonical_reference_image_id',
      companion_id: `in.(${companionIds.join(',')})`,
      canonical_reference_image_id: 'not.is.null',
      order: 'created_at.desc',
    }),
  });

  const profileByCompanion = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (!profile.canonical_reference_image_id) continue;
    if (!profileByCompanion.has(profile.companion_id)) {
      profileByCompanion.set(profile.companion_id, profile.canonical_reference_image_id);
    }
  }

  const imageIds = [...new Set(profileByCompanion.values())];
  if (!imageIds.length) return [];

  const images = await adminSupabaseRest<ImageRow[]>('ai_companion_images', {
    searchParams: new URLSearchParams({
      select: 'id,delivery_url,origin_mime_type',
      id: `in.(${imageIds.join(',')})`,
    }),
  });
  const imageById = new Map((images ?? []).map((image) => [image.id, image]));

  const rows: CanonicalCompanionRow[] = [];
  for (const companion of selected) {
    const imageId = profileByCompanion.get(companion.id);
    if (!imageId) continue;
    const image = imageById.get(imageId);
    if (!image?.delivery_url) continue;
    rows.push({
      userId: companion.user_id,
      companionId: companion.id,
      companionName: companion.name,
      origin: companion.structured_profile?.origin ?? null,
      age: companion.structured_profile?.age ?? null,
      canonicalImageId: image.id,
      deliveryUrl: image.delivery_url,
      mimeType: image.origin_mime_type,
    });
  }

  return rows;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log('Phase 0 — face diversity baseline');
  console.log('Output:', OUT_DIR);
  console.log('');

  const canonicalRows = await fetchCanonicalRows();
  console.log(`Canonical companions with reference: ${canonicalRows.length}`);

  const fingerprintRows = [];
  for (const row of canonicalRows) {
    process.stdout.write(`→ ${row.companionName} (${row.companionId.slice(0, 8)}) ... `);
    try {
      const response = await fetch(row.deliveryUrl);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      fingerprintRows.push(fingerprintFromBytes(row, bytes));
      console.log(`OK (${bytes.byteLength} bytes)`);
    } catch (error) {
      console.log('SKIP', error instanceof Error ? error.message : error);
    }
  }

  const pairs = buildPairwiseSimilarities(fingerprintRows);
  const summary = summarizeFaceDiversity(pairs);

  const report = {
    ranAt: new Date().toISOString(),
    canonicalCount: fingerprintRows.length,
    summary,
    pairs,
    companions: fingerprintRows.map((row) => ({
      userId: row.userId,
      companionId: row.companionId,
      companionName: row.companionName,
      origin: row.origin,
      age: row.age,
      canonicalImageId: row.canonicalImageId,
      bytes: row.bytes,
    })),
  };

  const reportPath = path.join(OUT_DIR, 'face-diversity-baseline.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== SUMMARY ===\n');
  console.log('Companion fingerprints:', fingerprintRows.length);
  console.log('Pairwise comparisons:  ', summary.pairCount);
  console.log('Users w/ 2+ companions:', summary.usersWithMultipleCompanions);
  console.log('Near-duplicate pairs:  ', `${summary.nearDuplicatePairs} (${summary.pctNearDuplicate}%)`);
  console.log(`Cosine ≥ ${summary.threshold}:`.padEnd(24), `${summary.highCosinePairs} (${summary.pctHighCosine}%)`);
  console.log('\nGate:', summary.gateRecommendation);
  console.log(`\nReport: ${path.relative(ROOT, reportPath)}\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});