#!/usr/bin/env tsx
/**
 * Fingerprint analysis for portrait-switch bakeoff report.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '../src/lib/virtual-girlfriend/phase0/image-fingerprint';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-portrait-switch');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');

type BakeoffAttempt = {
  ok: boolean;
  modelKey: string;
  promptKey: string;
  seed: number;
  file?: string;
};

const main = () => {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Missing report: ${REPORT_PATH}`);
    console.error('Run: node scripts/phase0-portrait-switch-bakeoff.mjs');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as {
    results: BakeoffAttempt[];
  };

  const okRows = report.results.filter((row) => row.ok && row.file);
  const fingerprints = okRows.map((row) => {
    const filePath = path.join(ROOT, row.file!);
    const bytes = fs.readFileSync(filePath);
    const mimeType = row.file!.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    return {
      ...row,
      fp: buildImageFingerprint(bytes, mimeType),
    };
  });

  console.log('\n=== FINGERPRINT ANALYSIS ===');
  console.log(`Threshold: ${PHASE0_FACE_SIMILARITY_THRESHOLD} (cosine >= threshold = near-duplicate)\n`);

  const byPrompt = new Map<string, typeof fingerprints>();
  for (const row of fingerprints) {
    const bucket = byPrompt.get(row.promptKey) ?? [];
    bucket.push(row);
    byPrompt.set(row.promptKey, bucket);
  }

  for (const [promptKey, rows] of byPrompt) {
    console.log(`--- Prompt: ${promptKey} ---`);

    const byModel = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = byModel.get(row.modelKey) ?? [];
      bucket.push(row);
      byModel.set(row.modelKey, bucket);
    }

    console.log('\nWithin-model seed diversity (lower avg cosine = better):');
    for (const [modelKey, modelRows] of byModel) {
      const pairs: number[] = [];
      let near = 0;
      for (let i = 0; i < modelRows.length; i += 1) {
        for (let j = i + 1; j < modelRows.length; j += 1) {
          const comparison = compareFingerprints(modelRows[i]!.fp, modelRows[j]!.fp);
          pairs.push(comparison.cosine);
          if (comparison.nearDuplicate) near += 1;
        }
      }
      if (!pairs.length) {
        console.log(`  ${modelKey.padEnd(20)} (single seed)`);
        continue;
      }
      const avg = pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
      console.log(
        `  ${modelKey.padEnd(20)} avgCosine=${avg.toFixed(3)} nearDup=${near}/${pairs.length}`,
      );
    }

    const aureliumRows = rows.filter((row) => row.modelKey === 'aurelium');
    if (aureliumRows.length) {
      const ref = aureliumRows[0]!;
      console.log('\nDistance from Aurelium (seed 10101 preferred):');
      const refRow = aureliumRows.find((row) => row.seed === 10101) ?? ref;
      for (const row of rows) {
        if (row.modelKey === 'aurelium') continue;
        const comparison = compareFingerprints(refRow.fp, row.fp);
        console.log(
          `  ${row.modelKey.padEnd(20)} seed ${String(row.seed).padEnd(5)} cosine=${comparison.cosine.toFixed(3)} distinct=${!comparison.nearDuplicate}`,
        );
      }
    }

    let totalPairs = 0;
    let nearPairs = 0;
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        totalPairs += 1;
        if (compareFingerprints(rows[i]!.fp, rows[j]!.fp).nearDuplicate) nearPairs += 1;
      }
    }
    console.log(
      `\nAll-model cluster: ${nearPairs}/${totalPairs} near-dup pairs (${totalPairs ? ((nearPairs / totalPairs) * 100).toFixed(0) : 0}%)\n`,
    );
  }

  const recommendation = {
    ranAt: new Date().toISOString(),
    threshold: PHASE0_FACE_SIMILARITY_THRESHOLD,
    fingerprinted: fingerprints.length,
    byPrompt: Object.fromEntries(
      [...byPrompt.entries()].map(([promptKey, rows]) => {
        const byModel = new Map<string, typeof rows>();
        for (const row of rows) {
          const bucket = byModel.get(row.modelKey) ?? [];
          bucket.push(row);
          byModel.set(row.modelKey, bucket);
        }

        const seedDiversity = Object.fromEntries(
          [...byModel.entries()].map(([modelKey, modelRows]) => {
            const cosines: number[] = [];
            let near = 0;
            let total = 0;
            for (let i = 0; i < modelRows.length; i += 1) {
              for (let j = i + 1; j < modelRows.length; j += 1) {
                const comparison = compareFingerprints(modelRows[i]!.fp, modelRows[j]!.fp);
                cosines.push(comparison.cosine);
                total += 1;
                if (comparison.nearDuplicate) near += 1;
              }
            }
            return [
              modelKey,
              {
                avgCosine: cosines.length
                  ? Number((cosines.reduce((s, v) => s + v, 0) / cosines.length).toFixed(4))
                  : null,
                nearDuplicatePairs: near,
                totalPairs: total,
              },
            ];
          }),
        );

        return [promptKey, { seedDiversity }];
      }),
    ),
  };

  const outPath = path.join(OUT_DIR, 'fingerprint-report.json');
  fs.writeFileSync(outPath, JSON.stringify(recommendation, null, 2));
  console.log(`Fingerprint report: ${path.relative(ROOT, outPath)}\n`);
};

main();