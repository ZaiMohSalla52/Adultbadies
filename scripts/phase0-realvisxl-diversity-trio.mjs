#!/usr/bin/env node
/**
 * RealVisXL-v30 diversity trio — 3 distinct girls (black, caucasian, asian).
 *
 * Usage:
 *   node scripts/phase0-realvisxl-diversity-trio.mjs
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

const MODEL_ID = 'realvisxl-v30';
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-realvisxl-diversity');

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

const pollResult = async (initial, label) => {
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

const generateOne = async (profile) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: MODEL_ID,
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
  const result = await pollResult(initial, `${MODEL_ID}/${profile.id}`);
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  return { url, bytes, ext, generationTime: result.generationTime ?? null };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  modelId: MODEL_ID,
  profiles: PROFILES.map((p) => ({ id: p.id, seed: p.seed })),
  results: [],
};

console.log('\nRealVisXL-v30 diversity trio (3 images)');
console.log('Profiles: black, caucasian, asian');
console.log('Output:', OUT_DIR);
console.log('');

for (let i = 0; i < PROFILES.length; i += 1) {
  const profile = PROFILES[i];
  process.stdout.write(`[${i + 1}/3] ${profile.id} ... `);
  try {
    const generated = await generateOne(profile);
    const black = isMostlyBlack(generated.bytes);
    const fileName = `realvisxl-v30_${profile.id}_seed${profile.seed}.${generated.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fsPromises.writeFile(filePath, generated.bytes);
    report.results.push({
      ok: true,
      profileId: profile.id,
      seed: profile.seed,
      black,
      bytes: generated.bytes.byteLength,
      file: path.relative(ROOT, filePath),
      url: generated.url,
      generationTime: generated.generationTime,
    });
    console.log(black ? 'BLACK' : 'OK', '→', fileName);
  } catch (error) {
    report.results.push({
      ok: false,
      profileId: profile.id,
      seed: profile.seed,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('FAIL —', error instanceof Error ? error.message : error);
  }
}

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
console.log('Compare: npm run phase0:realvisxl-diversity-compare\n');