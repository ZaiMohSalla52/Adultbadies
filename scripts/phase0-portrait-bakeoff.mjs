#!/usr/bin/env node
/**
 * Phase 0 — ModelsLab portrait model bake-off
 *
 * Usage:
 *   MODELSLAB_API_KEY=your-key node scripts/phase0-portrait-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_MODELS=flux,realvisxl-v30 node scripts/phase0-portrait-bakeoff.mjs
 *   BAKEOFF_SEEDS=111,222,333
 *   BAKEOFF_OUT=screenshots/bakeoff-phase0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY. Run:');
  console.error('  MODELSLAB_API_KEY=your-key node scripts/phase0-portrait-bakeoff.mjs');
  process.exit(1);
}

const DEFAULT_MODELS = [
  'flux',
  'realvisxl-v30',
  'aurelium-photorealistic-people-bysilas-v1-0-1771498462',
  'beautyfoolultrareal-v20',
  'sdxl',
];

const MODELS = (process.env.BAKEOFF_MODELS ?? DEFAULT_MODELS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const SEEDS = (process.env.BAKEOFF_SEEDS ?? '10101,20202,30303')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-phase0');

const NEGATIVE =
  'anime, cartoon, illustration, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

// Adult-leaning companion prompt — the kind that triggers moderation black cards.
const PORTRAIT_PROMPT = [
  'A real adult woman, age 24.',
  'Latina heritage, medium skin tone, long dark brown hair, brown eyes, curvy body.',
  'Close portrait, head and shoulders, face prominent.',
  'Urban street background with soft bokeh.',
  'Single person portrait photograph of a real human, centered frame.',
  'Warm golden natural window light, soft directional warmth.',
  'Sultry seductive gaze, parted lips, magnetic adult allure.',
  'Sultry seductive styling with adult glamour energy.',
  'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
  'Candid amateur photograph of a real person, natural available light, true-to-life skin tones.',
].join(' ');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveOutputUrl = (payload) => {
  const direct = payload.output?.[0];
  if (direct) return direct;
  const proxy = payload.proxy_links;
  if (Array.isArray(proxy)) return proxy[0] ?? null;
  if (proxy && typeof proxy === 'object') {
    const first = Object.values(proxy)[0];
    return typeof first === 'string' ? first : null;
  }
  return null;
};

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON (${response.status}): ${text.slice(0, 200)}`);
  }
  if (!response.ok || payload.status === 'error') {
    throw new Error(payload.message ?? payload.messege ?? `HTTP ${response.status}`);
  }
  return payload;
};

const pollResult = async (initial, label) => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${label}: unexpected status ${initial.status}`);
  }

  const requestId = String(initial.id);
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const waitMs = attempt === 0 && initial.eta ? Math.min(initial.eta * 1000, 4000) : 1500;
    await sleep(waitMs);
    const polled = await postJson('https://modelslab.com/api/v6/images/fetch', {
      key: API_KEY,
      request_id: requestId,
    });
    if (polled.status === 'success') return polled;
    if (polled.status === 'error') {
      throw new Error(polled.message ?? polled.messege ?? 'poll failed');
    }
  }
  throw new Error(`${label}: timed out`);
};

const isMostlyBlack = (bytes) => {
  if (!bytes?.byteLength) return true;
  if (bytes.byteLength < 12_000) return true;
  let dark = 0;
  let samples = 0;
  const start = Math.min(128, Math.floor(bytes.byteLength * 0.05));
  const end = Math.min(bytes.byteLength, 120_000);
  for (let i = start; i < end; i += 113) {
    samples += 1;
    if (bytes[i] < 6) dark += 1;
  }
  return samples > 0 && dark / samples >= 0.9;
};

const generateOne = async (modelId, seed) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: modelId,
    prompt: PORTRAIT_PROMPT,
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: 28,
    guidance_scale: 7.5,
    safety_checker: 'no',
    scheduler: 'DPMSolverMultistepScheduler',
    seed,
  });

  const result = await pollResult(initial, modelId);
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');

  const imageResponse = await fetch(url);
  if (!imageResponse.ok) throw new Error(`Download failed (${imageResponse.status})`);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';

  return {
    url,
    bytes,
    ext,
    nsfw: Boolean(result.nsfw_content_detected),
    generationTime: result.generationTime ?? null,
    meta: result.meta ?? null,
    black: isMostlyBlack(bytes),
  };
};

const safeFileName = (value) => value.replace(/[^a-z0-9._-]+/gi, '_');

await fs.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  prompt: PORTRAIT_PROMPT,
  models: MODELS,
  seeds: SEEDS,
  results: [],
};

console.log('\nPhase 0 portrait bake-off');
console.log('Models:', MODELS.join(', '));
console.log('Seeds:', SEEDS.join(', '));
console.log('Output:', OUT_DIR);
console.log('');

for (const modelId of MODELS) {
  const modelSummary = {
    modelId,
    attempts: [],
    success: 0,
    black: 0,
    nsfwFlagged: 0,
    failed: 0,
  };

  for (const seed of SEEDS) {
    const label = `${modelId} seed=${seed}`;
    process.stdout.write(`→ ${label} ... `);
    try {
      const generated = await generateOne(modelId, seed);
      const fileName = `${safeFileName(modelId)}_seed${seed}.${generated.ext}`;
      const filePath = path.join(OUT_DIR, fileName);
      await fs.writeFile(filePath, generated.bytes);

      modelSummary.success += 1;
      if (generated.black) modelSummary.black += 1;
      if (generated.nsfw) modelSummary.nsfwFlagged += 1;

      modelSummary.attempts.push({
        seed,
        ok: true,
        black: generated.black,
        nsfw: generated.nsfw,
        bytes: generated.bytes.byteLength,
        file: path.relative(ROOT, filePath),
        url: generated.url,
        generationTime: generated.generationTime,
      });

      const status = generated.black ? 'BLACK/blank' : generated.nsfw ? 'NSFW flagged' : 'OK';
      console.log(`${status} → ${fileName}`);
    } catch (error) {
      modelSummary.failed += 1;
      modelSummary.attempts.push({
        seed,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`FAIL — ${error instanceof Error ? error.message : error}`);
    }
  }

  report.results.push(modelSummary);
}

const reportPath = path.join(OUT_DIR, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===\n');
console.log('Model'.padEnd(52), 'OK', 'Black', 'NSFW', 'Fail');
console.log('-'.repeat(72));
for (const row of report.results) {
  console.log(
    row.modelId.padEnd(52),
    String(row.success).padStart(2),
    String(row.black).padStart(5),
    String(row.nsfwFlagged).padStart(4),
    String(row.failed).padStart(4),
  );
}

console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
console.log('\nPick the model with: 0 black, 0 fail, best visual diversity across 3 seeds.');
console.log('Open the images in', path.relative(ROOT, OUT_DIR), 'and compare faces side by side.\n');