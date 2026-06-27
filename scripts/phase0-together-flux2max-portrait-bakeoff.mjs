#!/usr/bin/env node
/**
 * Together AI FLUX.2-max portrait bake-off (same prompts/seeds as FLUX.2-pro run).
 *
 * Usage:
 *   node scripts/phase0-together-flux2max-portrait-bakeoff.mjs
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

const API_KEY = process.env.TOGETHER_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing TOGETHER_API_KEY in .env.local');
  process.exit(1);
}

const FLUX2_MAX = 'black-forest-labs/FLUX.2-max';
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-together-flux2max');
const TOGETHER_IMAGES_URL = 'https://api.together.xyz/v1/images/generations';
const STAGGER_MS = 2_000;

const PORTRAIT_PROFILES = [
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
  {
    id: 'latina_seductive',
    seed: 30303,
    prompt: [
      'A real adult woman, age 24.',
      'Latina heritage, medium tan skin, long dark brown hair, brown eyes, curvy body.',
      'Close portrait, head and shoulders, face prominent, centered frame.',
      'Urban street background with soft bokeh.',
      'Single person portrait photograph of a real human woman.',
      'Warm golden natural window light, soft directional warmth.',
      'Sultry seductive gaze, parted lips, magnetic adult allure.',
      'Sultry seductive styling with adult glamour energy.',
      'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
      'Candid amateur photograph, true-to-life skin tones and texture.',
    ].join(' '),
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const togetherGenerate = async (body, label, attempt = 1) => {
  let response;
  try {
    response = await fetch(TOGETHER_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (error) {
    if (attempt < 3) {
      await sleep(4_000 * attempt);
      return togetherGenerate(body, label, attempt + 1);
    }
    throw error;
  }

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`${label}: invalid JSON (${response.status}): ${raw.slice(0, 240)}`);
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? raw.slice(0, 240);
    throw new Error(`${label}: HTTP ${response.status} — ${message}`);
  }

  const item = payload?.data?.[0];
  if (!item) throw new Error(`${label}: empty data array`);

  let bytes = null;
  let mimeType = 'image/jpeg';
  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    const download = await fetch(item.url, { headers: { 'User-Agent': 'adult-badies-bakeoff/1.0' } });
    if (!download.ok) throw new Error(`${label}: download failed (${download.status})`);
    bytes = Buffer.from(await download.arrayBuffer());
    mimeType = download.headers.get('content-type') ?? 'image/jpeg';
  }

  if (!bytes?.byteLength) throw new Error(`${label}: no image bytes`);

  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const inferenceMs =
    item.timings?.inference != null
      ? Math.round(item.timings.inference < 250 ? item.timings.inference * 1000 : item.timings.inference)
      : null;

  return { bytes, ext, inferenceMs };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'together_flux2max_portrait_bakeoff',
  modelId: FLUX2_MAX,
  results: [],
};

console.log('\nTogether FLUX.2-max portrait bake-off');
console.log('Model:', FLUX2_MAX);
console.log('Output:', OUT_DIR);
console.log('');

let index = 0;
for (const profile of PORTRAIT_PROFILES) {
  index += 1;
  process.stdout.write(`[${index}/${PORTRAIT_PROFILES.length}] ${profile.id} ... `);
  try {
    const generated = await togetherGenerate(
      {
        model: FLUX2_MAX,
        prompt: profile.prompt,
        width: 768,
        height: 1024,
        seed: profile.seed,
        n: 1,
        response_format: 'url',
        output_format: 'jpeg',
        disable_safety_checker: true,
      },
      `flux2-max/portrait/${profile.id}`,
    );
    const black = isMostlyBlack(generated.bytes);
    const fileName = `flux2max_portrait_${profile.id}_seed${profile.seed}.${generated.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fsPromises.writeFile(filePath, generated.bytes);
    report.results.push({
      ok: true,
      modelKey: 'flux2-max',
      modelId: FLUX2_MAX,
      profileId: profile.id,
      seed: profile.seed,
      black,
      bytes: generated.bytes.byteLength,
      inferenceMs: generated.inferenceMs,
      file: path.relative(ROOT, filePath),
    });
    console.log(black ? 'BLACK' : 'OK', '→', fileName);
  } catch (error) {
    report.results.push({
      ok: false,
      modelKey: 'flux2-max',
      modelId: FLUX2_MAX,
      profileId: profile.id,
      seed: profile.seed,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('FAIL —', error instanceof Error ? error.message : error);
  }
  await sleep(STAGGER_MS);
}

const okRows = report.results.filter((row) => row.ok);
report.summary = {
  total: report.results.length,
  ok: okRows.length,
  blackCards: okRows.filter((row) => row.black).length,
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(`OK: ${report.summary.ok}/${report.summary.total}`);
console.log(`Black cards: ${report.summary.blackCards}`);
console.log(`Report: ${path.relative(ROOT, reportPath)}`);
console.log('Compare: npm run phase0:together-flux-portrait-compare\n');