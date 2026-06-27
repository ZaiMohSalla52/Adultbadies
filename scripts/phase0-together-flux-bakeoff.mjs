#!/usr/bin/env node
/**
 * Together AI portrait + gallery bake-off.
 *
 * Models:
 *   1. black-forest-labs/FLUX.2-pro        — setup portrait (text-to-image)
 *   2. black-forest-labs/FLUX.1-kontext-max — gallery from canonical (image_url)
 *   3. black-forest-labs/FLUX.2-pro        — gallery identity lock (reference_images)
 *
 * Usage:
 *   node scripts/phase0-together-flux-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_OUT=screenshots/bakeoff-together-flux
 *   BAKEOFF_SKIP_GALLERY=1
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

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-together-flux');
const SKIP_GALLERY = process.env.BAKEOFF_SKIP_GALLERY === '1';

const FLUX2_PRO = 'black-forest-labs/FLUX.2-pro';
const KONTEXT_MAX = 'black-forest-labs/FLUX.1-kontext-max';

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

const GALLERY_SCENES = [
  {
    id: 'seductive_apartment',
    seed: 40404,
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Sultry boudoir glamour in a soft apartment interior, lace-forward intimate styling.',
      'Warm golden-hour window light, face and body clearly lit.',
      'Waist-up candid framing, magnetic adult presence.',
      'No underexposure, no black crush, no silhouette.',
      'Photorealistic amateur photograph, true-to-life skin tones.',
    ].join(' '),
  },
  {
    id: 'rooftop_evening',
    seed: 50505,
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Body-hugging evening dress on a city rooftop at dusk, confident seductive pose.',
      'Soft golden-hour lighting, face clearly lit.',
      'Three-quarter portrait framing, high fashion drama.',
      'No underexposure, no black crush, no silhouette.',
      'Photorealistic amateur photograph, true-to-life skin tones.',
    ].join(' '),
  },
];

const TOGETHER_IMAGES_URL = 'https://api.together.xyz/v1/images/generations';
const STAGGER_MS = 2_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeFileName = (value) => value.replace(/[^a-z0-9._-]+/gi, '_');

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

const tinyBytes = (bytes) => !bytes?.byteLength || bytes.byteLength < 8_000;

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
  if (!item) {
    throw new Error(`${label}: empty data array`);
  }

  let bytes = null;
  let mimeType = 'image/jpeg';
  let sourceUrl = item.url ?? null;

  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, 'base64');
    mimeType = body.output_format === 'png' ? 'image/png' : 'image/jpeg';
  } else if (sourceUrl) {
    const download = await fetch(sourceUrl, { headers: { 'User-Agent': 'adult-badies-bakeoff/1.0' } });
    if (!download.ok) {
      throw new Error(`${label}: download failed (${download.status})`);
    }
    bytes = Buffer.from(await download.arrayBuffer());
    mimeType = download.headers.get('content-type') ?? 'image/jpeg';
  }

  if (!bytes?.byteLength) {
    throw new Error(`${label}: no image bytes in response`);
  }

  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const inferenceMs =
    item.timings?.inference != null
      ? Math.round(item.timings.inference < 250 ? item.timings.inference * 1000 : item.timings.inference)
      : null;

  return { bytes, ext, mimeType, sourceUrl, inferenceMs, model: payload.model ?? body.model };
};

const generateFlux2Portrait = async (profile) =>
  togetherGenerate(
    {
      model: FLUX2_PRO,
      prompt: profile.prompt,
      width: 768,
      height: 1024,
      seed: profile.seed,
      n: 1,
      response_format: 'url',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    `flux2-pro/portrait/${profile.id}`,
  );

const generateKontextMaxGallery = async (scene, referenceUrl) =>
  togetherGenerate(
    {
      model: KONTEXT_MAX,
      prompt: scene.prompt,
      aspect_ratio: '3:4',
      image_url: referenceUrl,
      seed: scene.seed,
      steps: 28,
      n: 1,
      response_format: 'base64',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    `kontext-max/gallery/${scene.id}`,
  );

const generateFlux2Gallery = async (scene, referenceUrl) =>
  togetherGenerate(
    {
      model: FLUX2_PRO,
      prompt: scene.prompt,
      width: 768,
      height: 1024,
      reference_images: [referenceUrl],
      seed: scene.seed,
      n: 1,
      response_format: 'base64',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    `flux2-pro/gallery/${scene.id}`,
  );

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'together_flux_portrait_gallery_bakeoff',
  models: {
    portrait: FLUX2_PRO,
    galleryKontextMax: KONTEXT_MAX,
    galleryFlux2Pro: FLUX2_PRO,
  },
  results: [],
};

const pushResult = (row) => {
  report.results.push(row);
  const flags = [
    row.black ? 'BLACK' : null,
    row.tiny ? 'TINY' : null,
    row.ok ? 'OK' : 'FAIL',
  ].filter(Boolean);
  console.log(flags.join(' '), row.ok && row.file ? `→ ${path.basename(row.file)}` : row.error ?? '');
};

let step = 0;
const totalPortrait = PORTRAIT_PROFILES.length;
const totalGallery = SKIP_GALLERY ? 0 : GALLERY_SCENES.length * 2;
const total = totalPortrait + totalGallery;

console.log('\nTogether AI FLUX bake-off');
console.log('Portrait:', FLUX2_PRO);
console.log('Gallery:', KONTEXT_MAX, '+', FLUX2_PRO, '(reference_images)');
console.log('Output:', OUT_DIR);
console.log('');

let referenceUrl = null;
let referenceFile = null;

for (const profile of PORTRAIT_PROFILES) {
  step += 1;
  process.stdout.write(`[${step}/${total}] portrait / ${profile.id} ... `);
  try {
    const generated = await generateFlux2Portrait(profile);
    const black = isMostlyBlack(generated.bytes);
    const tiny = tinyBytes(generated.bytes);
    const fileName = `flux2pro_portrait_${profile.id}_seed${profile.seed}.${generated.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fsPromises.writeFile(filePath, generated.bytes);

    if (profile.id === 'caucasian' && generated.sourceUrl) {
      referenceUrl = generated.sourceUrl;
      referenceFile = filePath;
    }

    pushResult({
      ok: true,
      phase: 'portrait',
      modelKey: 'flux2-pro',
      modelId: FLUX2_PRO,
      profileId: profile.id,
      seed: profile.seed,
      black,
      tiny,
      bytes: generated.bytes.byteLength,
      inferenceMs: generated.inferenceMs,
      file: path.relative(ROOT, filePath),
      sourceUrl: generated.sourceUrl,
    });
  } catch (error) {
    pushResult({
      ok: false,
      phase: 'portrait',
      modelKey: 'flux2-pro',
      modelId: FLUX2_PRO,
      profileId: profile.id,
      seed: profile.seed,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await sleep(STAGGER_MS);
}

if (!SKIP_GALLERY) {
  if (!referenceUrl) {
    const refRow = report.results.find((row) => row.ok && row.profileId === 'caucasian' && row.sourceUrl);
    referenceUrl = refRow?.sourceUrl ?? process.env.BAKEOFF_REFERENCE_URL?.trim() ?? null;
  }

  if (!referenceUrl) {
    const caucasian = PORTRAIT_PROFILES.find((profile) => profile.id === 'caucasian');
    if (caucasian) {
      console.log('\nNo caucasian sourceUrl yet — minting reference URL for gallery ...');
      try {
        const generated = await generateFlux2Portrait(caucasian);
        referenceUrl = generated.sourceUrl;
        if (referenceUrl) {
          console.log(`Reference URL: ${referenceUrl.slice(0, 72)}...`);
        }
      } catch (error) {
        console.log('Reference mint failed —', error instanceof Error ? error.message : error);
      }
    }
  }

  if (!referenceUrl) {
    console.log('\nSkipping gallery — no reference URL (set BAKEOFF_REFERENCE_URL or fix caucasian portrait).');
  } else {
    console.log(`\nGallery reference: ${referenceUrl.slice(0, 72)}...`);
    if (referenceFile) {
      console.log(`Local reference file: ${path.relative(ROOT, referenceFile)}`);
    }

    for (const scene of GALLERY_SCENES) {
      step += 1;
      process.stdout.write(`[${step}/${total}] kontext-max / ${scene.id} ... `);
      try {
        const generated = await generateKontextMaxGallery(scene, referenceUrl);
        const black = isMostlyBlack(generated.bytes);
        const tiny = tinyBytes(generated.bytes);
        const fileName = `kontextmax_gallery_${scene.id}_seed${scene.seed}.${generated.ext}`;
        const filePath = path.join(OUT_DIR, fileName);
        await fsPromises.writeFile(filePath, generated.bytes);
        pushResult({
          ok: true,
          phase: 'gallery',
          modelKey: 'kontext-max',
          modelId: KONTEXT_MAX,
          sceneId: scene.id,
          seed: scene.seed,
          black,
          tiny,
          bytes: generated.bytes.byteLength,
          inferenceMs: generated.inferenceMs,
          file: path.relative(ROOT, filePath),
          referenceUrl,
        });
      } catch (error) {
        pushResult({
          ok: false,
          phase: 'gallery',
          modelKey: 'kontext-max',
          modelId: KONTEXT_MAX,
          sceneId: scene.id,
          seed: scene.seed,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(STAGGER_MS);

      step += 1;
      process.stdout.write(`[${step}/${total}] flux2-pro gallery / ${scene.id} ... `);
      try {
        const generated = await generateFlux2Gallery(scene, referenceUrl);
        const black = isMostlyBlack(generated.bytes);
        const tiny = tinyBytes(generated.bytes);
        const fileName = `flux2pro_gallery_${scene.id}_seed${scene.seed}.${generated.ext}`;
        const filePath = path.join(OUT_DIR, fileName);
        await fsPromises.writeFile(filePath, generated.bytes);
        pushResult({
          ok: true,
          phase: 'gallery',
          modelKey: 'flux2-pro-gallery',
          modelId: FLUX2_PRO,
          sceneId: scene.id,
          seed: scene.seed,
          black,
          tiny,
          bytes: generated.bytes.byteLength,
          inferenceMs: generated.inferenceMs,
          file: path.relative(ROOT, filePath),
          referenceUrl,
        });
      } catch (error) {
        pushResult({
          ok: false,
          phase: 'gallery',
          modelKey: 'flux2-pro-gallery',
          modelId: FLUX2_PRO,
          sceneId: scene.id,
          seed: scene.seed,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(STAGGER_MS);
    }
  }
}

const okRows = report.results.filter((row) => row.ok);
const blackRows = okRows.filter((row) => row.black);
const tinyRows = okRows.filter((row) => row.tiny);

report.summary = {
  total: report.results.length,
  ok: okRows.length,
  failed: report.results.length - okRows.length,
  blackCards: blackRows.length,
  tinyImages: tinyRows.length,
  portraitOk: okRows.filter((row) => row.phase === 'portrait').length,
  galleryOk: okRows.filter((row) => row.phase === 'gallery').length,
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(`OK: ${report.summary.ok}/${report.summary.total}`);
console.log(`Black cards: ${report.summary.blackCards}`);
console.log(`Tiny images: ${report.summary.tinyImages}`);
console.log(`Report: ${path.relative(ROOT, reportPath)}`);
console.log('Fingerprint: npm run phase0:together-flux-fingerprint\n');