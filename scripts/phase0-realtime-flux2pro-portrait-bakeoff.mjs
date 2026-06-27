#!/usr/bin/env node
/**
 * Quick portrait bake-off: Aurelium (current) vs realtime_t2i + flux-2-pro.
 *
 * Usage:
 *   node scripts/phase0-realtime-flux2pro-portrait-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_SEED=10101
 *   BAKEOFF_OUT=screenshots/bakeoff-realtime-flux2pro
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const loadLocalEnv = () => {
  const envPath = path.join(ROOT, '.env.local');
  try {
    const content = require('node:fs').readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const sep = trimmed.indexOf('=');
      if (sep <= 0) continue;
      const key = trimmed.slice(0, sep).trim();
      let value = trimmed.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // ignore
  }
};

loadLocalEnv();

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY in .env.local');
  process.exit(1);
}

const AURELIUM_MODEL = 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';
const REALTIME_MODEL = 'realtime_t2i';
const REALTIME_LORA = 'flux-2-pro';
const SEED = Number(process.env.BAKEOFF_SEED ?? '10101');
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-realtime-flux2pro');

const AURELIUM_NEGATIVE =
  'anime (child:1.5), ((((underage)))), ((((child)))), (((kid))), (((preteen))), (teen:1.5), wrinkles, aged skin, elderly face, sagging skin, crow feet, ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy';

const REALTIME_NEGATIVE =
  '(worst quality:2), (low quality:2), blurry, duplicate, bad anatomy, disfigured, deformed, cloned face, watermark, text, logo, underexposed, overexposed, child, teen, underage';

// Production-style companion preview core (adult-leaning, distinct from generic bakeoff Latina prompt).
const CORE_PROMPT = [
  'A real adult woman, age 24.',
  'Caucasian heritage, fair skin, long wavy blonde hair, blue eyes, slim athletic body.',
  'Close portrait, head and shoulders, face prominent, centered frame.',
  'Soft apartment background with gentle bokeh.',
  'Single person portrait photograph of a real human.',
  'Warm natural window light, soft directional warmth.',
  'Confident warm smile, magnetic adult presence.',
  'Face and body clearly lit — no underexposure, no silhouette.',
  'Candid amateur photograph of a real person, natural available light, true-to-life skin tones.',
  'Face DNA: oval face with balanced proportions, soft rounded jawline, straight refined nose bridge, medium lips with natural rose tint, arched brows with natural thickness, high prominent cheekbones, average eye spacing with almond eye shape.',
].join(' ');

const AURELIUM_QUALITY_SUFFIX =
  'highly detailed, cinematic lighting, sharp focus, f/1.8, 85mm, centered composition, professionally color graded, soft diffused light, photorealistic HDR';

const buildAureliumPrompt = (seed) =>
  `Close portrait photorealistic seed ${seed} hyperrealistic, ${CORE_PROMPT}, ${AURELIUM_QUALITY_SUFFIX}`;

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
  if (!bytes?.byteLength || bytes.byteLength < 12_000) return true;
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

const downloadBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  return { bytes, ext, contentType };
};

const generateAurelium = async () => {
  const prompt = buildAureliumPrompt(SEED);
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: AURELIUM_MODEL,
    prompt,
    negative_prompt: AURELIUM_NEGATIVE,
    enhance_prompt: 'yes',
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: 28,
    guidance_scale: 7.5,
    safety_checker: 'no',
    scheduler: 'UniPCMultistepScheduler',
    seed: SEED,
  });
  const result = await pollResult(initial, 'aurelium');
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('Aurelium: no output URL');
  const downloaded = await downloadBytes(url);
  return {
    label: 'aurelium',
    modelId: AURELIUM_MODEL,
    endpoint: 'v6/images/text2img',
    prompt,
    url,
    ...downloaded,
    black: isMostlyBlack(downloaded.bytes),
    generationTime: result.generationTime ?? null,
    meta: result.meta ?? null,
  };
};

const generateRealtimeFlux2Pro = async () => {
  const prompt = CORE_PROMPT;
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: REALTIME_MODEL,
    lora_model: REALTIME_LORA,
    prompt,
    negative_prompt: REALTIME_NEGATIVE,
    width: 768,
    height: 1024,
    samples: 1,
    guidance_scale: 7.5,
    scheduler: 'DPMSolverMultistepScheduler',
    safety_checker: 'no',
    seed: SEED,
  });
  const result = await pollResult(initial, 'realtime_t2i+flux-2-pro');
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('realtime_t2i+flux-2-pro: no output URL');
  const downloaded = await downloadBytes(url);
  return {
    label: 'realtime_t2i_flux2pro',
    modelId: `${REALTIME_MODEL}+${REALTIME_LORA}`,
    endpoint: 'v6/images/text2img',
    prompt,
    url,
    ...downloaded,
    black: isMostlyBlack(downloaded.bytes),
    generationTime: result.generationTime ?? null,
    meta: result.meta ?? null,
  };
};

await fs.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  seed: SEED,
  corePrompt: CORE_PROMPT,
  comparisons: [],
  results: [],
};

console.log('\nPortrait bake-off: Aurelium vs realtime_t2i + flux-2-pro');
console.log('Seed:', SEED);
console.log('Output:', OUT_DIR);
console.log('');

const jobs = [
  { name: 'Aurelium (current production)', run: generateAurelium },
  { name: 'realtime_t2i + flux-2-pro', run: generateRealtimeFlux2Pro },
];

for (const job of jobs) {
  process.stdout.write(`→ ${job.name} ... `);
  try {
    const generated = await job.run();
    const fileName = `${generated.label}_seed${SEED}.${generated.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fs.writeFile(filePath, generated.bytes);

    report.results.push({
      ok: true,
      label: generated.label,
      modelId: generated.modelId,
      endpoint: generated.endpoint,
      black: generated.black,
      bytes: generated.bytes.byteLength,
      file: path.relative(ROOT, filePath),
      url: generated.url,
      generationTime: generated.generationTime,
      meta: generated.meta,
    });

    const status = generated.black ? 'BLACK/blank' : 'OK';
    console.log(`${status} → ${fileName} (${generated.generationTime ?? '?'}s)`);
  } catch (error) {
    report.results.push({
      ok: false,
      label: job.name,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`FAIL — ${error instanceof Error ? error.message : error}`);
  }
}

// Fingerprint cross-compare if both succeeded
const okResults = report.results.filter((row) => row.ok && row.file);
if (okResults.length === 2) {
  const { buildImageFingerprint, compareFingerprints, PHASE0_FACE_SIMILARITY_THRESHOLD } =
    await import('../src/lib/virtual-girlfriend/phase0/image-fingerprint.ts');

  const fingerprints = [];
  for (const row of okResults) {
    const bytes = await fs.readFile(path.join(ROOT, row.file));
    fingerprints.push({
      label: row.label,
      fp: buildImageFingerprint(bytes, row.file.endsWith('.jpg') ? 'image/jpeg' : 'image/png'),
    });
  }

  const comparison = compareFingerprints(fingerprints[0].fp, fingerprints[1].fp);
  report.comparisons.push({
    left: fingerprints[0].label,
    right: fingerprints[1].label,
    cosine: Number(comparison.cosine.toFixed(4)),
    dHashSimilarity: Number(comparison.dHashSimilarity.toFixed(4)),
    nearDuplicate: comparison.nearDuplicate,
    threshold: PHASE0_FACE_SIMILARITY_THRESHOLD,
  });

  console.log('\n=== FINGERPRINT (same prompt + seed) ===');
  console.log(
    `${fingerprints[0].label} vs ${fingerprints[1].label}: cosine=${comparison.cosine.toFixed(3)} dHash=${comparison.dHashSimilarity.toFixed(3)} nearDup=${comparison.nearDuplicate}`,
  );
  console.log(`(threshold ${PHASE0_FACE_SIMILARITY_THRESHOLD} — lower cosine = more distinct faces)`);
}

const reportPath = path.join(OUT_DIR, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
console.log('Open both images side-by-side in', path.relative(ROOT, OUT_DIR), '\n');