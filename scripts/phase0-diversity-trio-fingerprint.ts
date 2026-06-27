#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '../src/lib/virtual-girlfriend/phase0/image-fingerprint';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-diversity-trio');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');

const main = () => {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as {
    results: Array<{
      ok: boolean;
      modelKey: string;
      profileId: string;
      file?: string;
    }>;
  };

  const ok = report.results.filter((row) => row.ok && row.file);
  const byModel = new Map<string, typeof ok>();
  for (const row of ok) {
    const bucket = byModel.get(row.modelKey) ?? [];
    bucket.push(row);
    byModel.set(row.modelKey, bucket);
  }

  console.log(`\nDiversity trio fingerprints (threshold ${PHASE0_FACE_SIMILARITY_THRESHOLD})\n`);

  const summary: Record<string, { pairs: Array<{ a: string; b: string; cosine: number; nearDuplicate: boolean }>; pctNearDup: number }> = {};

  for (const [modelKey, rows] of byModel) {
    console.log(`--- ${modelKey} ---`);
    const fps = rows.map((row) => ({
      profileId: row.profileId,
      fp: buildImageFingerprint(
        fs.readFileSync(path.join(ROOT, row.file!)),
        row.file!.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      ),
    }));

    const pairs: Array<{ a: string; b: string; cosine: number; nearDuplicate: boolean }> = [];
    for (let i = 0; i < fps.length; i += 1) {
      for (let j = i + 1; j < fps.length; j += 1) {
        const comparison = compareFingerprints(fps[i]!.fp, fps[j]!.fp);
        pairs.push({
          a: fps[i]!.profileId,
          b: fps[j]!.profileId,
          cosine: Number(comparison.cosine.toFixed(4)),
          nearDuplicate: comparison.nearDuplicate,
        });
        console.log(
          `  ${fps[i]!.profileId} vs ${fps[j]!.profileId}: cosine=${comparison.cosine.toFixed(3)} nearDup=${comparison.nearDuplicate}`,
        );
      }
    }

    const near = pairs.filter((pair) => pair.nearDuplicate).length;
    const pct = pairs.length ? Number(((near / pairs.length) * 100).toFixed(0)) : 0;
    console.log(`  => ${near}/${pairs.length} near-dup pairs (${pct}%)\n`);
    summary[modelKey] = { pairs, pctNearDup: pct };
  }

  const outPath = path.join(OUT_DIR, 'fingerprint-report.json');
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), summary }, null, 2));
  console.log(`Saved: ${path.relative(ROOT, outPath)}\n`);
};

main();