#!/usr/bin/env node
/**
 * Diversity trio bake-off — 3 distinct girls × 2 models (no Aurelium).
 *
 * Models:
 *   - epicrealism-xl-vxv-anewstory-realism (v6 text2img)
 *   - flux-2-pro (v7 text-to-image)
 *
 * Usage:
 *   node scripts/phase0-diversity-trio-bakeoff.mjs
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const loadLocalEnv = () => {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
};

loadLocalEnv();

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY in .env.local');
  process.exit(1);
}

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-diversity-trio');
const EPIC_MODEL = 'epicrealism-xl-vxv-anewstory-realism';
const FLUX2_MODEL = 'flux-2-pro';

const NEGATIVE =
  'anime, cartoon, illustration, child, teen, underage, two faces, duplicate face, multiple people, twins, cloned face, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

const PROFILES = [
  {
    id: 'black',
    seed: 11101,
    prompt: [
      'A real adult woman, age 24.',
      'Black African-American heritage, rich dark brown skin, natural black curly hair, deep brown eyes, athletic curvy body.',
      'Close portrait, head and shoulders only, one single person, face prominent, centered frame.',
      'Soft studio apartment background with gentle bokeh.',
      'Single person portrait photograph of a real human woman.',
      'Warm natural window light, soft directional warmth.',
      'Confident warm smile, magnetic adult presence.',
      'Face clearly lit — no underexposure, no silhouette.',
      'Candid amateur photograph, true-to-life skin tones and texture.',
    ].join(' '),
  },
  {
    id: 'caucasian',
    seed: 22202,
    prompt: [
      'A real adult woman, age 24.',
      'Caucasian European heritage, fair skin with light freckles, long wavy blonde hair, bright blue eyes, slim body.',
      'Close portrait, head and shoulders only, one single person, face prominent, centered frame.',
      'Soft apartment background with gentle bokeh.',
      'Single person portrait photograph of a real human woman.',
      'Warm natural window light, soft directional warmth.',
      'Soft confident smile, magnetic adult presence.',
      'Face clearly lit — no underexposure, no silhouette.',
      'Candid amateur photograph, true-to-life skin tones and texture.',
    ].join(' '),
  },
  {
    id: 'asian',
    seed: 33303,
    prompt: [
      'A real adult woman, age 24.',
      'East Asian Korean heritage, light warm skin, straight jet-black hair with bangs, dark brown eyes, petite slim body.',
      'Close portrait, head and shoulders only, one single person, face prominent, centered frame.',
      'Soft cafe interior background with gentle bokeh.',
      'Single person portrait photograph of a real human woman.',
      'Warm natural window light, soft directional warmth.',
      'Gentle smile, magnetic adult presence.',
      'Face clearly lit — no underexposure, no silhouette.',
      'Candid amateur photograph, true-to-life skin tones and texture.',
    ].join(' '),
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeFileName = (value) => value.replace(/[^a-z0-9._-]+/gi, '_');

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

const pollV6 = async (initial, label) => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${label}: unexpected status ${initial.status}`);
  }
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const waitMs = attempt === 0 && initial.eta ? Math.min(initial.eta * 1000, 4000) : 1500;
    await sleep(waitMs);
    const polled = await postJson('https://modelslab.com/api/v6/images/fetch', {
      key: API_KEY,
      request_id: String(initial.id),
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

const download = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  return { bytes, ext, contentType };
};

const generateEpic = async (profile) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: EPIC_MODEL,
    prompt: profile.prompt,
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: 28,
    guidance_scale: 7.5,
    safety_checker: 'no',
    scheduler: 'DPMSolverMultistepScheduler',
    seed: profile.seed,
  });
  const result = await pollV6(initial, `epic/${profile.id}`);
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');
  const file = await download(url);
  return { url, ...file, generationTime: result.generationTime ?? null };
};

const generateFlux2Pro = async (profile) => {
  const initial = await postJson('https://modelslab.com/api/v7/images/text-to-image', {
    key: API_KEY,
    model_id: FLUX2_MODEL,
    prompt: profile.prompt,
    width: 768,
    height: 1024,
    seed: profile.seed,
  });
  const result = await pollV6(initial, `flux2pro/${profile.id}`);
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');
  const file = await download(url);
  return { url, ...file, generationTime: result.generationTime ?? null };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'diversity_trio_epicrealism_vs_flux2pro',
  profiles: PROFILES.map((p) => ({ id: p.id, seed: p.seed })),
  results: [],
};

const jobs = [
  { modelKey: 'epicrealism', modelId: EPIC_MODEL, run: generateEpic },
  { modelKey: 'flux2pro', modelId: FLUX2_MODEL, run: generateFlux2Pro },
];

console.log('\nDiversity trio bake-off (6 images total)');
console.log('Profiles: black, caucasian, asian');
console.log('Models: epicrealism, flux-2-pro');
console.log('Output:', OUT_DIR);
console.log('');

let index = 0;
const total = jobs.length * PROFILES.length;

for (const job of jobs) {
  for (const profile of PROFILES) {
    index += 1;
    const label = `${job.modelKey} / ${profile.id}`;
    process.stdout.write(`[${index}/${total}] ${label} ... `);
    try {
      const generated = await job.run(profile);
      const black = isMostlyBlack(generated.bytes);
      const fileName = `${safeFileName(job.modelKey)}_${profile.id}_seed${profile.seed}.${generated.ext}`;
      const filePath = path.join(OUT_DIR, fileName);
      await fsPromises.writeFile(filePath, generated.bytes);

      const row = {
        ok: true,
        modelKey: job.modelKey,
        modelId: job.modelId,
        profileId: profile.id,
        seed: profile.seed,
        black,
        bytes: generated.bytes.byteLength,
        file: path.relative(ROOT, filePath),
        url: generated.url,
        generationTime: generated.generationTime,
      };
      report.results.push(row);
      console.log(black ? 'BLACK' : 'OK', '→', fileName);
    } catch (error) {
      report.results.push({
        ok: false,
        modelKey: job.modelKey,
        modelId: job.modelId,
        profileId: profile.id,
        seed: profile.seed,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log('FAIL —', error instanceof Error ? error.message : error);
    }
  }
}

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
console.log('Fingerprint: npm run phase0:diversity-trio-fingerprint\n');