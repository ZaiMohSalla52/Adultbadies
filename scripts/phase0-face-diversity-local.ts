#!/usr/bin/env tsx
/**
 * Local fallback face diversity baseline (no Supabase service role).
 * Uses existing bakeoff screenshots to demonstrate the metric pipeline.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildPairwiseSimilarities,
  fingerprintFromBytes,
  summarizeFaceDiversity,
  type CanonicalCompanionRow,
} from '../src/lib/virtual-girlfriend/phase0/face-diversity-baseline';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.PHASE0_OUT ?? 'reports/phase0');

const LOCAL_SETS: Array<{ userId: string; files: string[] }> = [
  {
    userId: 'local-user-a',
    files: [
      'screenshots/bakeoff-epicrealism/portrait_aurelium_seed10101.png',
      'screenshots/bakeoff-epicrealism/portrait_epicrealism_seed10101.png',
      'screenshots/bakeoff-final-pick/aurelium_portrait.png',
    ],
  },
  {
    userId: 'local-user-b',
    files: [
      'screenshots/bakeoff-epicrealism/asian-outfit-test/00_user_reference.jpg',
      'screenshots/bakeoff-epicrealism/asian-outfit-test/03_base_text2img.jpg',
      'screenshots/bakeoff-epicrealism/asian-outfit-test/04_base_img2img.jpg',
    ],
  },
];

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const rows = [];

  for (const set of LOCAL_SETS) {
    for (const relative of set.files) {
      const filePath = path.join(ROOT, relative);
      try {
        const bytes = await fs.readFile(filePath);
        const baseName = path.basename(relative, path.extname(relative));
        rows.push(
          fingerprintFromBytes(
            {
              userId: set.userId,
              companionId: baseName,
              companionName: baseName,
              origin: 'local',
              age: null,
              canonicalImageId: baseName,
              deliveryUrl: filePath,
              mimeType: path.extname(relative).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
            },
            bytes,
          ),
        );
        console.log(`→ ${relative} OK`);
      } catch {
        console.log(`→ ${relative} SKIP (missing)`);
      }
    }
  }

  const pairs = buildPairwiseSimilarities(rows);
  const summary = summarizeFaceDiversity(pairs);
  const report = {
    ranAt: new Date().toISOString(),
    mode: 'local_screenshots',
    canonicalCount: rows.length,
    summary,
    pairs,
  };

  const reportPath = path.join(OUT_DIR, 'face-diversity-baseline-local.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\nLocal baseline complete');
  console.log('Pairs:', summary.pairCount, '| near-dup %:', summary.pctNearDuplicate);
  console.log('Report:', path.relative(ROOT, reportPath));
};

main();