#!/usr/bin/env node
/**
 * Together FLUX.1-kontext-max wardrobe gallery bake-off.
 * Three distinct outfits from one canonical portrait — checks black cards and moderation rejects.
 *
 * Usage:
 *   node scripts/phase0-together-kontextmax-wardrobe-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_REFERENCE_URL=https://...
 *   BAKEOFF_OUT=screenshots/bakeoff-kontextmax-wardrobe
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

const KONTEXT_MAX = 'black-forest-labs/FLUX.1-kontext-max';
const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-kontextmax-wardrobe');
const TOGETHER_IMAGES_URL = 'https://api.together.xyz/v1/images/generations';
const STAGGER_MS = 2_500;

const REFERENCE_PROMPT = [
  'A real adult woman, age 24.',
  'Caucasian European heritage, fair skin with light freckles, long wavy blonde hair, bright blue eyes, slim body.',
  'Close portrait, head and shoulders only, one single person, face prominent, centered frame.',
  'Soft apartment background with gentle bokeh.',
  'Single person portrait photograph of a real human woman.',
  'Warm natural window light, soft directional warmth.',
  'Soft confident smile, magnetic adult presence.',
  'Face clearly lit — no underexposure, no silhouette.',
  'Candid amateur photograph, true-to-life skin tones and texture.',
].join(' ');

const WARDROBE_LOOKS = [
  {
    id: 'casual_street',
    seed: 60101,
    label: 'Casual streetwear',
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
    label: 'Lingerie boudoir',
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Lace lingerie set in a soft bedroom interior, intimate confident adult pose.',
      'Warm golden boudoir lighting, face and body clearly lit.',
      'Waist-up to three-quarter framing, tasteful adult editorial realism.',
      'No underexposure, no black crush, no silhouette.',
    ].join(' '),
  },
  {
    id: 'bikini_beach',
    seed: 60303,
    label: 'Bikini beach',
    prompt: [
      'Portrait photograph of the same woman from the reference image.',
      'Preserve exact same face, identity, hair color, and eye color.',
      'Stylish bikini at the beach, sun-kissed skin, confident sensual pose.',
      'Bright beach daylight, face and body clearly lit.',
      'Three-quarter framing, photorealistic lifestyle photograph.',
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

const isModerationReject = (message) =>
  /moderation|flagged|rejected|nsfw|safety|content policy|invalid content/i.test(message);

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
    const error = new Error(`${label}: HTTP ${response.status} — ${message}`);
    error.moderation = isModerationReject(message);
    throw error;
  }

  const item = payload?.data?.[0];
  if (!item) throw new Error(`${label}: empty data array`);

  let bytes = null;
  let mimeType = 'image/jpeg';
  const sourceUrl = item.url ?? null;

  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, 'base64');
  } else if (sourceUrl) {
    const download = await fetch(sourceUrl, { headers: { 'User-Agent': 'adult-badies-bakeoff/1.0' } });
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

  return { bytes, ext, inferenceMs, sourceUrl };
};

const loadReferenceUrl = () => {
  const fromEnv = process.env.BAKEOFF_REFERENCE_URL?.trim();
  if (fromEnv) return fromEnv;

  const fluxReport = path.join(ROOT, 'screenshots/bakeoff-together-flux/report.json');
  if (fs.existsSync(fluxReport)) {
    const report = JSON.parse(fs.readFileSync(fluxReport, 'utf8'));
    const caucasian = report.results?.find(
      (row) => row.ok && row.profileId === 'caucasian' && row.sourceUrl,
    );
    if (caucasian?.sourceUrl) return caucasian.sourceUrl;
  }

  return null;
};

const mintReferencePortrait = async () => {
  console.log('Minting reference portrait (FLUX.2-max caucasian seed 22202) ...');
  const generated = await togetherGenerate(
    {
      model: 'black-forest-labs/FLUX.2-max',
      prompt: REFERENCE_PROMPT,
      width: 768,
      height: 1024,
      seed: 22202,
      n: 1,
      response_format: 'url',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    'reference/portrait',
  );

  const filePath = path.join(OUT_DIR, '00_reference_portrait.jpg');
  await fsPromises.writeFile(filePath, generated.bytes);
  if (!generated.sourceUrl) throw new Error('Reference portrait returned no URL for kontext image_url');
  return { referenceUrl: generated.sourceUrl, referenceFile: filePath };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

let referenceUrl = loadReferenceUrl();
let referenceFile = null;

if (!referenceUrl) {
  const minted = await mintReferencePortrait();
  referenceUrl = minted.referenceUrl;
  referenceFile = minted.referenceFile;
} else {
  console.log(`Using reference URL: ${referenceUrl.slice(0, 72)}...`);
}

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'kontext_max_wardrobe_gallery_bakeoff',
  modelId: KONTEXT_MAX,
  referenceUrl,
  referenceFile: referenceFile ? path.relative(ROOT, referenceFile) : null,
  wardrobeLooks: WARDROBE_LOOKS.map((look) => ({ id: look.id, label: look.label, seed: look.seed })),
  results: [],
};

console.log('\nKontext Max wardrobe bake-off');
console.log('Model:', KONTEXT_MAX);
console.log('Looks: casual, lingerie, bikini');
console.log('Output:', OUT_DIR);
console.log('');

let index = 0;
for (const look of WARDROBE_LOOKS) {
  index += 1;
  process.stdout.write(`[${index}/${WARDROBE_LOOKS.length}] ${look.id} ... `);
  try {
    const generated = await togetherGenerate(
      {
        model: KONTEXT_MAX,
        prompt: look.prompt,
        aspect_ratio: '3:4',
        image_url: referenceUrl,
        seed: look.seed,
        steps: 28,
        n: 1,
        response_format: 'base64',
        output_format: 'jpeg',
        disable_safety_checker: true,
      },
      `kontext-max/${look.id}`,
    );

    const black = isMostlyBlack(generated.bytes);
    const fileName = `kontextmax_${look.id}_seed${look.seed}.${generated.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fsPromises.writeFile(filePath, generated.bytes);

    report.results.push({
      ok: true,
      lookId: look.id,
      label: look.label,
      seed: look.seed,
      black,
      moderated: false,
      bytes: generated.bytes.byteLength,
      inferenceMs: generated.inferenceMs,
      file: path.relative(ROOT, filePath),
    });
    console.log(black ? 'BLACK' : 'OK', '→', fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.results.push({
      ok: false,
      lookId: look.id,
      label: look.label,
      seed: look.seed,
      moderated: Boolean(error?.moderation),
      error: message,
    });
    console.log(error?.moderation ? 'MODERATED' : 'FAIL', '—', message.slice(0, 120));
  }
  await sleep(STAGGER_MS);
}

const okRows = report.results.filter((row) => row.ok);
report.summary = {
  total: report.results.length,
  ok: okRows.length,
  failed: report.results.length - okRows.length,
  blackCards: okRows.filter((row) => row.black).length,
  moderated: report.results.filter((row) => row.moderated).length,
  verdict:
    okRows.length === WARDROBE_LOOKS.length && okRows.every((row) => !row.black)
      ? 'PASS — all wardrobe looks delivered'
      : report.results.some((row) => row.moderated)
        ? 'PARTIAL — moderation blocked some looks'
        : okRows.some((row) => row.black)
          ? 'PARTIAL — black cards detected'
          : 'FAIL — generation errors',
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(`Verdict: ${report.summary.verdict}`);
console.log(`OK: ${report.summary.ok}/${report.summary.total}`);
console.log(`Black cards: ${report.summary.blackCards}`);
console.log(`Moderation rejects: ${report.summary.moderated}`);
console.log(`Report: ${path.relative(ROOT, reportPath)}\n`);