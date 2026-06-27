#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '../src/lib/virtual-girlfriend/phase0/image-fingerprint';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');

type BakeoffRow = {
  ok: boolean;
  modelKey: string;
  phase?: string;
  profileId?: string;
  black?: boolean;
  bytes?: number;
  inferenceMs?: number | null;
  file?: string;
  error?: string;
};

type ModelBucket = {
  key: string;
  label: string;
  reportPath: string;
  outDir: string;
};

const MODELS: ModelBucket[] = [
  {
    key: 'together-flux2-pro',
    label: 'Together FLUX.2-pro',
    reportPath: 'screenshots/bakeoff-together-flux/report.json',
    outDir: 'screenshots/bakeoff-together-flux',
  },
  {
    key: 'together-flux2-max',
    label: 'Together FLUX.2-max',
    reportPath: 'screenshots/bakeoff-together-flux2max/report.json',
    outDir: 'screenshots/bakeoff-together-flux2max',
  },
  {
    key: 'modelslab-flux2-pro',
    label: 'ModelsLab flux-2-pro',
    reportPath: 'screenshots/bakeoff-diversity-trio/report.json',
    outDir: 'screenshots/bakeoff-diversity-trio',
  },
];

const readPortraitRows = (bucket: ModelBucket): BakeoffRow[] => {
  const reportPath = path.join(ROOT, bucket.reportPath);
  if (!fs.existsSync(reportPath)) return [];

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as { results: BakeoffRow[] };
  return report.results.filter((row) => {
    if (!row.ok || !row.file) return false;
    if (bucket.key === 'modelslab-flux2-pro') return row.modelKey === 'flux2pro';
    if (bucket.key === 'together-flux2-pro') return row.phase === 'portrait' || row.modelKey === 'flux2-pro';
    return row.modelKey === 'flux2-max';
  });
};

const detectMimeType = (filePath: string, bytes: Buffer) => {
  if (bytes[0] === 0x89) return 'image/png';
  if (bytes[0] === 0xff) return 'image/jpeg';
  return filePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
};

const fingerprintForRow = (row: BakeoffRow) => {
  const filePath = path.join(ROOT, row.file!);
  const bytes = fs.readFileSync(filePath);
  return buildImageFingerprint(bytes, detectMimeType(filePath, bytes));
};

const main = () => {
  console.log(`\nPortrait model compare (near-dup threshold ${PHASE0_FACE_SIMILARITY_THRESHOLD})\n`);

  const loaded = MODELS.map((bucket) => ({
    bucket,
    rows: readPortraitRows(bucket),
  }));

  const compareReport: Record<string, unknown> = {
    ranAt: new Date().toISOString(),
    threshold: PHASE0_FACE_SIMILARITY_THRESHOLD,
    models: {} as Record<string, unknown>,
    winner: null as string | null,
  };

  const scores: Array<{
    key: string;
    label: string;
    ok: number;
    total: number;
    blackCards: number;
    pctNearDup: number;
    avgInferenceMs: number | null;
    score: number;
  }> = [];

  for (const entry of loaded) {
    const { bucket, rows } = entry;
    console.log(`--- ${bucket.label} (${rows.length} portraits) ---`);
    if (!rows.length) {
      console.log('  (no results — run bakeoff first)\n');
      continue;
    }

    const fps = rows.map((row) => ({
      profileId: row.profileId ?? 'unknown',
      black: row.black ?? false,
      inferenceMs: row.inferenceMs ?? null,
      fp: fingerprintForRow(row),
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
    const pctNearDup = pairs.length ? Number(((near / pairs.length) * 100).toFixed(0)) : 0;
    const blackCards = fps.filter((row) => row.black).length;
    const inferenceValues = fps.map((row) => row.inferenceMs).filter((value): value is number => value != null);
    const avgInferenceMs = inferenceValues.length
      ? Math.round(inferenceValues.reduce((sum, value) => sum + value, 0) / inferenceValues.length)
      : null;

    console.log(`  => black cards: ${blackCards}`);
    console.log(`  => near-dup pairs: ${near}/${pairs.length} (${pctNearDup}%)`);
    if (avgInferenceMs != null) console.log(`  => avg inference: ${avgInferenceMs}ms`);
    console.log('');

    const maxPairCosine = pairs.length ? Math.max(...pairs.map((pair) => pair.cosine)) : 0;

    const score =
      (rows.length >= 4 ? 20 : rows.length * 5)
      - blackCards * 25
      - pctNearDup * 0.5
      - near * 8
      - maxPairCosine * 5;

    scores.push({
      key: bucket.key,
      label: bucket.label,
      ok: rows.length,
      total: 4,
      blackCards,
      pctNearDup,
      maxPairCosine: Number(maxPairCosine.toFixed(4)),
      avgInferenceMs,
      score,
    });

    (compareReport.models as Record<string, unknown>)[bucket.key] = {
      portraits: rows.length,
      blackCards,
      pctNearDup,
      maxPairCosine: Number(maxPairCosine.toFixed(4)),
      nearDupPairs: near,
      pairCount: pairs.length,
      avgInferenceMs,
      pairs,
      files: rows.map((row) => row.file),
    };
  }

  scores.sort((left, right) => right.score - left.score);
  const winner = scores[0] ?? null;
  compareReport.winner = winner?.key ?? null;
  compareReport.scores = scores;

  console.log('--- Scoreboard (higher is better) ---');
  for (const row of scores) {
    console.log(
      `  ${row.label}: score=${row.score.toFixed(1)} | ok=${row.ok}/4 | black=${row.blackCards} | nearDup=${row.pctNearDup}% | maxCos=${row.maxPairCosine.toFixed(3)} | avgMs=${row.avgInferenceMs ?? 'n/a'}`,
    );
  }

  if (winner) {
    console.log(`\nWinner: ${winner.label}\n`);
  }

  const outPath = path.join(ROOT, 'screenshots/bakeoff-together-flux2max/compare-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(compareReport, null, 2));
  console.log(`Saved: ${path.relative(ROOT, outPath)}\n`);
};

main();