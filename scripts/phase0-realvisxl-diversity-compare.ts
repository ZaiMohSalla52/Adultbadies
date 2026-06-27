#!/usr/bin/env tsx
/**
 * Compare diversity trio fingerprints: realvisxl-v30 vs flux2pro vs epicrealism.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '../src/lib/virtual-girlfriend/phase0/image-fingerprint';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');

const SEEDS = { black: 11101, caucasian: 22202, asian: 33303 } as const;

const MODEL_SETS = [
  {
    key: 'realvisxl-v30',
    dir: 'screenshots/bakeoff-realvisxl-diversity',
    prefix: 'realvisxl-v30',
  },
  {
    key: 'flux2pro',
    dir: 'screenshots/bakeoff-diversity-trio',
    prefix: 'flux2pro',
  },
  {
    key: 'epicrealism',
    dir: 'screenshots/bakeoff-diversity-trio',
    prefix: 'epicrealism',
  },
] as const;

const mimeFor = (filePath: string, bytes: Buffer) => {
  if (filePath.endsWith('.jpg') || (bytes[0] === 0xff && bytes[1] === 0xd8)) return 'image/jpeg';
  return 'image/png';
};

const loadTrio = (set: (typeof MODEL_SETS)[number]) => {
  const rows: Array<{ profileId: string; file: string; fp: ReturnType<typeof buildImageFingerprint> }> = [];
  for (const profileId of ['black', 'caucasian', 'asian'] as const) {
    const seed = SEEDS[profileId];
    const base = path.join(ROOT, set.dir, `${set.prefix}_${profileId}_seed${seed}.png`);
    const altJpg = base.replace(/\.png$/, '.jpg');
    const filePath = fs.existsSync(base) ? base : fs.existsSync(altJpg) ? altJpg : null;
    if (!filePath) continue;
    const bytes = fs.readFileSync(filePath);
    rows.push({
      profileId,
      file: path.relative(ROOT, filePath),
      fp: buildImageFingerprint(bytes, mimeFor(filePath, bytes)),
    });
  }
  return rows;
};

const summarizeTrio = (key: string, rows: ReturnType<typeof loadTrio>) => {
  const pairs: Array<{ a: string; b: string; cosine: number; nearDuplicate: boolean }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const comparison = compareFingerprints(rows[i]!.fp, rows[j]!.fp);
      pairs.push({
        a: rows[i]!.profileId,
        b: rows[j]!.profileId,
        cosine: Number(comparison.cosine.toFixed(4)),
        nearDuplicate: comparison.nearDuplicate,
      });
    }
  }
  const near = pairs.filter((pair) => pair.nearDuplicate).length;
  const avg = pairs.length
    ? Number((pairs.reduce((sum, pair) => sum + pair.cosine, 0) / pairs.length).toFixed(4))
    : null;
  return { key, imageCount: rows.length, pairs, nearDuplicatePairs: near, totalPairs: pairs.length, avgCosine: avg, pctNearDup: pairs.length ? Math.round((near / pairs.length) * 100) : null };
};

const main = () => {
  console.log(`\nDiversity trio comparison (threshold ${PHASE0_FACE_SIMILARITY_THRESHOLD})\n`);

  const summaries = MODEL_SETS.map((set) => summarizeTrio(set.key, loadTrio(set)));

  for (const summary of summaries) {
    console.log(`--- ${summary.key} (${summary.imageCount}/3 images) ---`);
    if (summary.imageCount < 3) {
      console.log('  incomplete set — run bakeoff first\n');
      continue;
    }
    for (const pair of summary.pairs) {
      console.log(
        `  ${pair.a} vs ${pair.b}: cosine=${pair.cosine.toFixed(3)} nearDup=${pair.nearDuplicate}`,
      );
    }
    console.log(
      `  => ${summary.nearDuplicatePairs}/${summary.totalPairs} near-dup (${summary.pctNearDup}%) avgCosine=${summary.avgCosine}\n`,
    );
  }

  const complete = summaries.filter((s) => s.imageCount === 3 && s.avgCosine != null);
  if (complete.length) {
    const bestDiversity = [...complete].sort((a, b) => (a.avgCosine ?? 1) - (b.avgCosine ?? 1))[0];
    const worstDiversity = [...complete].sort((a, b) => (b.avgCosine ?? 0) - (a.avgCosine ?? 0))[0];
    console.log('Ranking (lower avg cosine = more diverse):');
    for (const row of [...complete].sort((a, b) => (a.avgCosine ?? 1) - (b.avgCosine ?? 1))) {
      console.log(`  ${row.key.padEnd(16)} avgCosine=${row.avgCosine} nearDup=${row.pctNearDup}%`);
    }
    console.log(`\nMost diverse: ${bestDiversity?.key}`);
    console.log(`Most homogenized: ${worstDiversity?.key}\n`);
  }

  const outPath = path.join(ROOT, 'screenshots/bakeoff-realvisxl-diversity', 'compare-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), summaries }, null, 2));
  console.log(`Saved: ${path.relative(ROOT, outPath)}\n`);
};

main();