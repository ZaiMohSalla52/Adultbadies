#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '../src/lib/virtual-girlfriend/phase0/image-fingerprint';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-together-flux');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');

const main = () => {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Missing report: ${REPORT_PATH}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as {
    results: Array<{
      ok: boolean;
      phase?: string;
      modelKey?: string;
      profileId?: string;
      sceneId?: string;
      black?: boolean;
      file?: string;
    }>;
  };

  const portraitRows = report.results.filter((row) => row.ok && row.phase === 'portrait' && row.file);
  const galleryRows = report.results.filter((row) => row.ok && row.phase === 'gallery' && row.file);

  console.log(`\nTogether FLUX fingerprints (threshold ${PHASE0_FACE_SIMILARITY_THRESHOLD})\n`);

  const summary: Record<string, unknown> = { ranAt: new Date().toISOString() };

  if (portraitRows.length >= 2) {
    console.log('--- Portrait diversity (flux2-pro) ---');
    const fps = portraitRows.map((row) => ({
      id: row.profileId ?? 'unknown',
      black: row.black ?? false,
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
          a: fps[i]!.id,
          b: fps[j]!.id,
          cosine: Number(comparison.cosine.toFixed(4)),
          nearDuplicate: comparison.nearDuplicate,
        });
        console.log(
          `  ${fps[i]!.id} vs ${fps[j]!.id}: cosine=${comparison.cosine.toFixed(3)} nearDup=${comparison.nearDuplicate}`,
        );
      }
    }

    const near = pairs.filter((pair) => pair.nearDuplicate).length;
    const pct = pairs.length ? Number(((near / pairs.length) * 100).toFixed(0)) : 0;
    console.log(`  => ${near}/${pairs.length} near-dup pairs (${pct}%)\n`);
    summary.portrait = { pairs, pctNearDup: pct, blackProfiles: fps.filter((row) => row.black).map((row) => row.id) };
  }

  const galleryByModel = new Map<string, typeof galleryRows>();
  for (const row of galleryRows) {
    const key = row.modelKey ?? 'gallery';
    const bucket = galleryByModel.get(key) ?? [];
    bucket.push(row);
    galleryByModel.set(key, bucket);
  }

  const referencePath = portraitRows.find((row) => row.profileId === 'caucasian')?.file;
  if (referencePath) {
    const referenceFp = buildImageFingerprint(
      fs.readFileSync(path.join(ROOT, referencePath)),
      referencePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
    );

    for (const [modelKey, rows] of galleryByModel) {
      console.log(`--- Gallery identity lock (${modelKey} vs caucasian portrait) ---`);
      const identityPairs: Array<{ sceneId: string; cosine: number; nearDuplicate: boolean; black: boolean }> = [];
      for (const row of rows) {
        const fp = buildImageFingerprint(
          fs.readFileSync(path.join(ROOT, row.file!)),
          row.file!.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
        );
        const comparison = compareFingerprints(referenceFp, fp);
        identityPairs.push({
          sceneId: row.sceneId ?? 'unknown',
          cosine: Number(comparison.cosine.toFixed(4)),
          nearDuplicate: comparison.nearDuplicate,
          black: row.black ?? false,
        });
        console.log(
          `  caucasian vs ${row.sceneId}: cosine=${comparison.cosine.toFixed(3)} nearDup=${comparison.nearDuplicate} black=${row.black ? 'yes' : 'no'}`,
        );
      }
      summary[`gallery_${modelKey}`] = identityPairs;
      console.log('');
    }
  }

  const outPath = path.join(OUT_DIR, 'fingerprint-report.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`Saved: ${path.relative(ROOT, outPath)}\n`);
};

main();