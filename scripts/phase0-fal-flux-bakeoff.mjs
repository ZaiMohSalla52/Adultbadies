#!/usr/bin/env node
/**
 * fal.ai Flux portrait + gallery bake-off.
 *
 * Portrait (text2img):
 *   - fal-ai/flux-pro/v1.1  (safety_tolerance 6)
 *   - fal-ai/flux/dev       (enable_safety_checker: false)
 *
 * Gallery (img2img from canonical reference):
 *   - fal-ai/flux-pro/kontext
 *   - fal-ai/flux-kontext/dev (enable_safety_checker: false)
 *
 * Usage:
 *   node scripts/phase0-fal-flux-bakeoff.mjs
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

const API_KEY = process.env.FLUX_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing FLUX_API_KEY in .env.local');
  process.exit(1);
}

const FAL_BASE_URL = (process.env.FLUX_BASE_URL?.trim() || 'https://fal.run').replace(/\/$/, '');
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-fal-flux');
const STAGGER_MS = 2_000;

const PORTRAIT_MODELS = [
  {
    key: 'flux-pro-v1.1',
    endpoint: 'fal-ai/flux-pro/v1.1',
    kind: 'portrait',
    buildBody: ({ prompt, seed }) => ({
      prompt,
      image_size: 'portrait_4_3',
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: 6,
      ...(seed !== undefined ? { seed } : {}),
    }),
  },
  {
    key: 'flux-dev',
    endpoint: 'fal-ai/flux/dev',
    kind: 'portrait',
    buildBody: ({ prompt, seed }) => ({
      prompt,
      image_size: 'portrait_4_3',
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: false,
      ...(seed !== undefined ? { seed } : {}),
    }),
  },
];

const GALLERY_MODELS = [
  {
    key: 'flux-pro-kontext',
    endpoint: 'fal-ai/flux-pro/kontext',
    kind: 'gallery',
    buildBody: ({ prompt, imageUrl, seed }) => ({
      prompt,
      image_url: imageUrl,
      aspect_ratio: '3:4',
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true,
      ...(seed !== undefined ? { seed } : {}),
    }),
  },
  {
    key: 'flux-kontext-dev',
    endpoint: 'fal-ai/flux-kontext/dev',
    kind: 'gallery',
    buildBody: ({ prompt, imageUrl, seed }) => ({
      prompt,
      image_url: imageUrl,
      aspect_ratio: '3:4',
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: false,
      ...(seed !== undefined ? { seed } : {}),
    }),
  },
];

const PORTRAIT_PROFILES = [
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

const GALLERY_LOOKS = [
  {
    id: 'casual_street',
    seed: 60101,
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Fitted crop top, high-waist jeans, candid daytime street style, playful flirty energy.',
      'Bright natural daylight, face and outfit clearly lit.',
      'Waist-up framing, photorealistic amateur photograph.',
      'No underexposure, no black crush, no silhouette.',
    ].join(' '),
  },
  {
    id: 'lingerie_boudoir',
    seed: 60202,
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Lace lingerie set in a soft bedroom interior, intimate confident adult pose.',
      'Warm golden boudoir lighting, face and body clearly lit.',
      'Waist-up to three-quarter framing, tasteful adult editorial realism.',
      'No underexposure, no black crush, no silhouette.',
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

const toDataUri = (bytes, mimeType) => `data:${mimeType || 'image/jpeg'};base64,${bytes.toString('base64')}`;

const falGenerate = async (endpoint, body, label, attempt = 1) => {
  let response;
  try {
    response = await fetch(`${FAL_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (error) {
    if (attempt < 3) {
      await sleep(4_000 * attempt);
      return falGenerate(endpoint, body, label, attempt + 1);
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
    const message = payload?.detail ?? payload?.message ?? raw.slice(0, 240);
    throw new Error(`${label}: HTTP ${response.status} — ${message}`);
  }

  if (payload?.has_nsfw_concepts?.[0]) {
    throw new Error(`${label}: moderated (has_nsfw_concepts=true)`);
  }

  const item = payload?.images?.[0];
  if (!item?.url) throw new Error(`${label}: empty images array`);

  const download = await fetch(item.url, { headers: { 'User-Agent': 'adult-badies-bakeoff/1.0' } });
  if (!download.ok) throw new Error(`${label}: download failed (${download.status})`);
  const bytes = Buffer.from(await download.arrayBuffer());
  const mimeType = item.content_type ?? download.headers.get('content-type') ?? 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const inferenceMs =
    payload?.timings?.inference != null
      ? Math.round(payload.timings.inference < 250 ? payload.timings.inference * 1000 : payload.timings.inference)
      : null;

  return { bytes, ext, mimeType, inferenceMs, requestId: payload.request_id ?? null };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'fal_flux_portrait_gallery_bakeoff',
  falBaseUrl: FAL_BASE_URL,
  portraitModels: PORTRAIT_MODELS.map((model) => ({ key: model.key, endpoint: model.endpoint })),
  galleryModels: GALLERY_MODELS.map((model) => ({ key: model.key, endpoint: model.endpoint })),
  results: [],
};

console.log('\nfal.ai Flux bake-off');
console.log('Portrait models:', PORTRAIT_MODELS.map((m) => m.endpoint).join(', '));
console.log('Gallery models:', GALLERY_MODELS.map((m) => m.endpoint).join(', '));
console.log('Output:', OUT_DIR);
console.log('');

const portraitReferences = new Map();

for (const model of PORTRAIT_MODELS) {
  for (const profile of PORTRAIT_PROFILES) {
    const label = `${model.key}/portrait/${profile.id}`;
    process.stdout.write(`[portrait] ${label} ... `);
    try {
      const generated = await falGenerate(
        model.endpoint,
        model.buildBody({ prompt: profile.prompt, seed: profile.seed }),
        label,
      );
      const black = isMostlyBlack(generated.bytes);
      const fileName = `${model.key}_portrait_${profile.id}_seed${profile.seed}.${generated.ext}`;
      const filePath = path.join(OUT_DIR, fileName);
      await fsPromises.writeFile(filePath, generated.bytes);
      const row = {
        ok: true,
        phase: 'portrait',
        modelKey: model.key,
        endpoint: model.endpoint,
        profileId: profile.id,
        seed: profile.seed,
        black,
        moderated: false,
        bytes: generated.bytes.byteLength,
        inferenceMs: generated.inferenceMs,
        requestId: generated.requestId,
        file: path.relative(ROOT, filePath),
      };
      report.results.push(row);
      portraitReferences.set(`${model.key}:${profile.id}`, {
        bytes: generated.bytes,
        mimeType: generated.mimeType,
        file: row.file,
      });
      console.log(black ? 'BLACK' : 'OK', '→', fileName);
    } catch (error) {
      report.results.push({
        ok: false,
        phase: 'portrait',
        modelKey: model.key,
        endpoint: model.endpoint,
        profileId: profile.id,
        seed: profile.seed,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log('FAIL —', error instanceof Error ? error.message : error);
    }
    await sleep(STAGGER_MS);
  }
}

const referenceKey =
  portraitReferences.has('flux-pro-v1.1:caucasian')
    ? 'flux-pro-v1.1:caucasian'
    : [...portraitReferences.keys()][0] ?? null;

if (!referenceKey) {
  console.error('\nNo portrait reference available — skipping gallery phase.');
} else {
  const reference = portraitReferences.get(referenceKey);
  const referenceUrl = toDataUri(reference.bytes, reference.mimeType);
  console.log(`\nGallery reference: ${referenceKey} (${reference.file})\n`);

  for (const model of GALLERY_MODELS) {
    for (const look of GALLERY_LOOKS) {
      const label = `${model.key}/gallery/${look.id}`;
      process.stdout.write(`[gallery] ${label} ... `);
      try {
        const generated = await falGenerate(
          model.endpoint,
          model.buildBody({ prompt: look.prompt, imageUrl: referenceUrl, seed: look.seed }),
          label,
        );
        const black = isMostlyBlack(generated.bytes);
        const fileName = `${model.key}_gallery_${look.id}_seed${look.seed}.${generated.ext}`;
        const filePath = path.join(OUT_DIR, fileName);
        await fsPromises.writeFile(filePath, generated.bytes);
        report.results.push({
          ok: true,
          phase: 'gallery',
          modelKey: model.key,
          endpoint: model.endpoint,
          lookId: look.id,
          referenceKey,
          seed: look.seed,
          black,
          moderated: false,
          bytes: generated.bytes.byteLength,
          inferenceMs: generated.inferenceMs,
          requestId: generated.requestId,
          file: path.relative(ROOT, filePath),
        });
        console.log(black ? 'BLACK' : 'OK', '→', fileName);
      } catch (error) {
        report.results.push({
          ok: false,
          phase: 'gallery',
          modelKey: model.key,
          endpoint: model.endpoint,
          lookId: look.id,
          referenceKey,
          seed: look.seed,
          error: error instanceof Error ? error.message : String(error),
        });
        console.log('FAIL —', error instanceof Error ? error.message : error);
      }
      await sleep(STAGGER_MS);
    }
  }
}

const portraitRows = report.results.filter((row) => row.phase === 'portrait');
const galleryRows = report.results.filter((row) => row.phase === 'gallery');

const scoreModel = (rows, modelKey) => {
  const mine = rows.filter((row) => row.modelKey === modelKey);
  const ok = mine.filter((row) => row.ok);
  return {
    modelKey,
    total: mine.length,
    ok: ok.length,
    blackCards: ok.filter((row) => row.black).length,
    failures: mine.filter((row) => !row.ok).length,
    avgInferenceMs:
      ok.length > 0
        ? Math.round(ok.reduce((sum, row) => sum + (row.inferenceMs ?? 0), 0) / ok.length)
        : null,
    usable: ok.filter((row) => !row.black).length,
  };
};

report.summary = {
  referenceKey,
  portrait: PORTRAIT_MODELS.map((model) => scoreModel(portraitRows, model.key)),
  gallery: GALLERY_MODELS.map((model) => scoreModel(galleryRows, model.key)),
};

const portraitWinner = [...report.summary.portrait].sort((a, b) => b.usable - a.usable || b.ok - a.ok)[0];
const galleryWinner = [...report.summary.gallery].sort((a, b) => b.usable - a.usable || b.ok - a.ok)[0];
report.recommendation = {
  portrait: portraitWinner?.usable > 0 ? portraitWinner.modelKey : null,
  gallery: galleryWinner?.usable > 0 ? galleryWinner.modelKey : null,
  env: {
    FLUX_COMPANION_MODEL: portraitWinner?.modelKey === 'flux-dev' ? 'fal-ai/flux/dev' : 'fal-ai/flux-pro/v1.1',
    FLUX_COMPANION_SAFETY_TOLERANCE: '6',
    FLUX_KONTEXT_MODEL:
      galleryWinner?.modelKey === 'flux-kontext-dev' ? 'fal-ai/flux-kontext/dev' : 'fal-ai/flux-pro/kontext',
    VG_PORTRAIT_PROVIDER: 'flux',
    VG_GALLERY_PROVIDER: 'flux',
  },
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
for (const row of report.summary.portrait) {
  console.log(`Portrait ${row.modelKey}: ${row.usable}/${row.total} usable (${row.failures} failed, ${row.blackCards} black)`);
}
for (const row of report.summary.gallery) {
  console.log(`Gallery ${row.modelKey}: ${row.usable}/${row.total} usable (${row.failures} failed, ${row.blackCards} black)`);
}
console.log(`\nRecommended portrait: ${report.recommendation.portrait ?? 'none'}`);
console.log(`Recommended gallery: ${report.recommendation.gallery ?? 'none'}`);
console.log(`Report: ${path.relative(ROOT, reportPath)}\n`);