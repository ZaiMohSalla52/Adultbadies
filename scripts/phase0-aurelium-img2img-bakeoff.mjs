#!/usr/bin/env node
/**
 * Phase 0c — Aurelium img2img bake-off (canonical + gallery)
 *
 * Tests the all-Aurelium path (no Kontext):
 *   portrait → canonical (img2img OR direct persist) → gallery (img2img)
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/phase0-aurelium-img2img-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_REFERENCE_FILE=screenshots/bakeoff-phase0/aurelium-..._seed10101.png
 *   BAKEOFF_REFERENCE_URL=https://...   # skips ModelsLab upload (use if upload fails)
 *   BAKEOFF_GENERATE_REFERENCE=1
 *   BAKEOFF_SKIP_UPLOAD=1               # use phase0 report URL or BAKEOFF_REFERENCE_URL only
 *   BAKEOFF_OUT=screenshots/bakeoff-aurelium-img2img
 *   BAKEOFF_SCENARIOS=canonical_img2img,gallery_from_canonical,gallery_from_portrait
 *   BAKEOFF_STRENGTH=0.45
 *   BAKEOFF_RETRIES=4
 *   node scripts/phase0-aurelium-img2img-bakeoff.mjs --preflight   # test network only
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FETCH_TIMEOUT_MS = Number(process.env.BAKEOFF_FETCH_TIMEOUT_MS ?? 180_000);

const apiFetch = (url, init = {}) => {
  const signals = [];
  if (init.signal) signals.push(init.signal);
  signals.push(AbortSignal.timeout(FETCH_TIMEOUT_MS));
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  return fetch(url, { ...init, signal });
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY. Run:');
  console.error('  export $(grep -v "^#" .env.local | xargs)');
  console.error('  node scripts/phase0-aurelium-img2img-bakeoff.mjs');
  process.exit(1);
}

const OUT_DIR = path.resolve(
  ROOT,
  process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-aurelium-img2img',
);
const AURELIUM_MODEL =
  process.env.MODELSLAB_PORTRAIT_MODEL?.trim()
  || 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';
const DEFAULT_REFERENCE_FILE =
  'screenshots/bakeoff-phase0/aurelium-photorealistic-people-bysilas-v1-0-1771498462_seed10101.png';

const STRENGTH = Number(process.env.BAKEOFF_STRENGTH ?? 0.45);
const GUIDANCE_CANONICAL = Number(process.env.BAKEOFF_GUIDANCE_CANONICAL ?? 5);
const GUIDANCE_GALLERY = Number(process.env.BAKEOFF_GUIDANCE_GALLERY ?? 5);
const STEPS = Number(process.env.BAKEOFF_STEPS ?? 28);

const NEGATIVE =
  'anime, cartoon, illustration, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

const CANONICAL_PROMPT = [
  'Portrait photograph of an adult woman.',
  'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
  'Wardrobe: black lace camisole, sultry adult glamour styling.',
  'Lighting and mood: warm golden window light, seductive magnetic allure, parted lips, direct gaze.',
  'Upper body to waist portrait. Subject centered at natural eye-level. Flattering natural light, soft shallow depth of field, real-world background.',
  'Sharp lifelike face with natural skin texture.',
  'Candid amateur photograph of a real person, natural available light, true-to-life skin tones.',
  'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
].join(' ');

const GALLERY_PROMPT = [
  'Portrait photograph of an adult woman.',
  'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
  'Scene: urban rooftop at golden hour, city skyline bokeh, wind in hair.',
  'Wardrobe: fitted satin slip dress, sultry evening look.',
  'Lighting: warm sunset rim light, seductive confident expression.',
  'Three-quarter waist-up framing. Real-world environment with depth. Candid real-photo feel.',
  'Gallery variant. Vary scene, angle, and outfit while preserving identity.',
  'Candid amateur photograph of a real person, true-to-life skin tones.',
  'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
].join(' ');

const GALLERY_PROMPT_2 = [
  'Portrait photograph of an adult woman.',
  'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
  'Scene: cozy apartment living room, soft lamp light, evening indoors.',
  'Wardrobe: oversized white shirt, relaxed intimate styling.',
  'Lighting: warm indoor ambient light, soft natural expression.',
  'Three-quarter waist-up framing. Candid real-photo feel.',
  'Gallery variant 2. Preserve the same face and identity.',
  'True-to-life skin tones. Face clearly lit — no silhouette.',
].join(' ');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatError = (error) => {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  const causeText =
    cause && typeof cause === 'object'
      ? cause.code || cause.message || String(cause)
      : cause
        ? String(cause)
        : null;
  return causeText ? `${error.message} (${causeText})` : error.message;
};

const isFetchError = (error) =>
  error instanceof TypeError && /fetch failed/i.test(error.message);

const isTimeoutError = (error) =>
  error instanceof Error && /timed out/i.test(error.message);

const isRetryableNetworkError = (error) =>
  isFetchError(error)
  || isTimeoutError(error)
  || /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|Rate limit/i.test(formatError(error));

const withRetries = async (label, run, attempts = 3) => {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || i === attempts) break;
      const waitMs = Math.min(i * 3000, 15_000);
      console.log(`  ${label}: retry ${i}/${attempts - 1} in ${waitMs}ms — ${formatError(error)}`);
      await sleep(waitMs);
    }
  }
  throw lastError;
};

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

const postJson = async (url, body) =>
  withRetries('API', async () => {
    const response = await apiFetch(url, {
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
  }, Number(process.env.BAKEOFF_API_RETRIES ?? 4));

const pollResult = async (initial, label, options = {}) => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${label}: unexpected status ${initial.status}`);
  }

  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 2000;
  const requestId = String(initial.id);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const waitMs = attempt === 0 && initial.eta ? Math.min(initial.eta * 1000, 4000) : intervalMs;
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

const toDataUri = (bytes, mimeType) =>
  `data:${mimeType};base64,${bytes.toString('base64')}`;

const preflightCheck = async () => {
  console.log('Preflight: checking connectivity to modelslab.com ...');
  try {
    const response = await apiFetch('https://modelslab.com/', { method: 'GET' });
    console.log(`  modelslab.com reachable (HTTP ${response.status})`);
  } catch (error) {
    console.error(`  modelslab.com unreachable — ${formatError(error)}`);
    console.error('\nNetwork fixes to try on your Mac:');
    console.error('  1. Switch Wi‑Fi / disable VPN or iCloud Private Relay');
    console.error('  2. Flush DNS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder');
    console.error('  3. Retry in a few minutes (rate limits look like fetch errors sometimes)');
    console.error('  4. Run: node scripts/phase0-aurelium-img2img-bakeoff.mjs --preflight\n');
    throw error;
  }

  try {
    await postJson('https://modelslab.com/api/v6/images/fetch', {
      key: API_KEY,
      request_id: 'preflight-invalid',
    });
  } catch (error) {
    const msg = formatError(error);
    if (/invalid|not found|request/i.test(msg)) {
      console.log('  ModelsLab API reachable (auth OK)');
      return;
    }
    throw error;
  }
};

const uploadReference = async (bytes, mimeType) =>
  withRetries('upload', async () => {
    const payload = await postJson('https://modelslab.com/api/v6/base64_to_url', {
      key: API_KEY,
      base64_string: toDataUri(bytes, mimeType),
    });
    const url = resolveOutputUrl(payload);
    if (!url) throw new Error('Reference upload returned no URL');
    return url;
  });

const loadPhase0ReportUrl = async (relativeFile) => {
  const reportPath = path.resolve(ROOT, 'screenshots/bakeoff-phase0/report.json');
  try {
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    const needle = relativeFile.replace(/\\/g, '/');
    for (const model of report.results ?? []) {
      for (const attempt of model.attempts ?? []) {
        if (attempt.ok && attempt.file?.replace(/\\/g, '/') === needle && attempt.url) {
          return attempt.url;
        }
      }
    }
  } catch {
    // optional fallback
  }
  return null;
};

const resolvePortraitInitImage = async (reference) => {
  const explicitUrl = process.env.BAKEOFF_REFERENCE_URL?.trim();
  if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) {
    return { initImage: explicitUrl, method: 'BAKEOFF_REFERENCE_URL' };
  }

  const fromReport = await loadPhase0ReportUrl(
    process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE,
  );

  // Prefer hosted URL from Phase 0 — ModelsLab accepts init_image URLs; avoids base64 upload.
  if (fromReport && process.env.BAKEOFF_FORCE_UPLOAD !== '1') {
    return { initImage: fromReport, method: 'phase0_report_url' };
  }

  try {
    return { initImage: await uploadReference(reference.bytes, reference.mimeType), method: 'upload' };
  } catch (error) {
    if (fromReport) {
      console.log(
        `  Upload failed (${error instanceof Error ? error.message : error}) — using phase0 report URL instead.`,
      );
      return { initImage: fromReport, method: 'phase0_report_url_fallback' };
    }
    throw error;
  }
};

const loadReferenceBytes = async () => {
  const url = process.env.BAKEOFF_REFERENCE_URL?.trim();
  if (url) {
    const response = await apiFetch(url);
    if (!response.ok) throw new Error(`Reference URL download failed (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      bytes,
      mimeType: response.headers.get('content-type') ?? 'image/jpeg',
      source: url,
    };
  }

  const file = path.resolve(ROOT, process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE);
  const bytes = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { bytes, mimeType, source: path.relative(ROOT, file) };
};

const generateReferencePortrait = async () => {
  const prompt = [
    'A real adult woman, age 24.',
    'Latina heritage, medium skin tone, long dark brown hair, brown eyes, curvy body.',
    'Close portrait, head and shoulders, face prominent.',
    'Urban street background with soft bokeh.',
    'Warm golden natural window light.',
    'Sultry seductive gaze, parted lips.',
    'Candid amateur photograph, true-to-life skin tones.',
  ].join(' ');

  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: AURELIUM_MODEL,
    prompt,
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: STEPS,
    guidance_scale: 7.5,
    safety_checker: 'no',
    scheduler: 'DPMSolverMultistepScheduler',
    seed: 10101,
  });

  const result = await pollResult(initial, 'reference portrait');
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('Reference portrait returned no URL');

  const response = await apiFetch(url);
  if (!response.ok) throw new Error(`Reference portrait download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    mimeType: response.headers.get('content-type') ?? 'image/jpeg',
    source: `generated:${AURELIUM_MODEL}:seed10101`,
  };
};

const classifyAttempt = (attempt) => {
  if (!attempt.ok) {
    if (attempt.timedOut) return 'TIMEOUT';
    return 'FAILED';
  }
  if (attempt.black) return 'BLACK_CARD';
  if (attempt.nsfw) return 'NSFW_FLAGGED';
  if (attempt.bytes < 12_000) return 'TOO_SMALL';
  return 'CAPABLE';
};

const runAureliumImg2Img = async (input) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/img2img', {
    key: API_KEY,
    model_id: AURELIUM_MODEL,
    prompt: input.prompt,
    negative_prompt: NEGATIVE,
    init_image: input.initImage,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: STEPS,
    guidance: input.guidance,
    strength: input.strength,
    safety_checker: 'no',
    enhance_prompt: false,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
  });
  return pollResult(initial, input.label);
};

const downloadOutput = async (result) => {
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');
  const response = await apiFetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  return { url, bytes, ext, nsfw: Boolean(result.nsfw_content_detected) };
};

const runScenario = async (scenario, initImage) => {
  const maxAttempts = Number(process.env.BAKEOFF_RETRIES ?? 2) + 1;
  let result;
  let lastError;

  for (let run = 1; run <= maxAttempts; run += 1) {
    try {
      result = await runAureliumImg2Img({
        label: scenario.id,
        prompt: scenario.prompt,
        initImage,
        guidance: scenario.guidance,
        strength: scenario.strength,
        seed: scenario.seed,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || run === maxAttempts) throw error;
      process.stdout.write(`network retry ${run}/${maxAttempts - 1} ... `);
    }
  }

  if (!result) throw lastError ?? new Error('Generation failed');
  return downloadOutput(result);
};

if (process.argv.includes('--preflight')) {
  await preflightCheck();
  console.log('\nPreflight passed. Run without --preflight to start the bake-off.\n');
  process.exit(0);
}

const SCENARIO_FILTER = (process.env.BAKEOFF_SCENARIOS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

await fs.mkdir(OUT_DIR, { recursive: true });

let reference = await loadReferenceBytes().catch(() => null);
if (!reference || process.env.BAKEOFF_GENERATE_REFERENCE === '1') {
  console.log('Generating reference portrait with', AURELIUM_MODEL, '...');
  reference = await generateReferencePortrait();
}

const referenceFile = path.join(OUT_DIR, '00_portrait_reference.png');
const directCanonicalFile = path.join(OUT_DIR, '01_canonical_direct_persist.png');
await fs.writeFile(referenceFile, reference.bytes);
await fs.copyFile(referenceFile, directCanonicalFile);

await preflightCheck();

console.log('\nPhase 0c — Aurelium img2img bake-off (canonical + gallery)');
console.log('Model:    ', AURELIUM_MODEL);
console.log('Reference:', reference.source);
console.log('Strength: ', STRENGTH);
console.log('Output:   ', OUT_DIR);
console.log('');

let portraitInitImage;
let portraitInitMethod = 'unknown';
try {
  const resolved = await resolvePortraitInitImage(reference);
  portraitInitImage = resolved.initImage;
  portraitInitMethod = resolved.method;
  console.log('Portrait init_image:', portraitInitMethod);
} catch (error) {
  console.error('\nFailed to resolve portrait reference for img2img.');
  console.error(error instanceof Error ? error.message : error);
  console.error('\nWorkaround — pass the Phase 0 CDN URL directly (no upload):');
  console.error('  BAKEOFF_REFERENCE_URL="https://pub-3626123a908346a7a8be8d9295f44e26.r2.dev/generations/0-54c3acf3-5c3d-4af4-94fe-d1a2cd09597b.jpg" \\');
  console.error('  node scripts/phase0-aurelium-img2img-bakeoff.mjs\n');
  process.exit(1);
}

const report = {
  ranAt: new Date().toISOString(),
  model: AURELIUM_MODEL,
  strength: STRENGTH,
  reference: {
    source: reference.source,
    portraitFile: path.relative(ROOT, referenceFile),
    directCanonicalFile: path.relative(ROOT, directCanonicalFile),
    initImage: portraitInitImage,
    initImageMethod: portraitInitMethod,
  },
  results: [],
  verdict: null,
};

const recordResult = async (scenario, initImage, initLabel) => {
  const attempt = {
    id: scenario.id,
    label: scenario.label,
    surface: scenario.surface,
    initFrom: initLabel,
    prompt: scenario.prompt,
    strength: scenario.strength,
    guidance: scenario.guidance,
    ok: false,
  };

  process.stdout.write(`→ ${scenario.id} ... `);

  try {
    const output = await runScenario(scenario, initImage);
    const black = isMostlyBlack(output.bytes);
    const fileName = `${scenario.id}.${output.ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fs.writeFile(filePath, output.bytes);

    attempt.ok = true;
    attempt.black = black;
    attempt.nsfw = output.nsfw;
    attempt.bytes = output.bytes.byteLength;
    attempt.file = path.relative(ROOT, filePath);
    attempt.url = output.url;
    attempt.verdict = classifyAttempt(attempt);
    attempt.outputBytes = output.bytes;
    attempt.outputMimeType = output.ext === 'jpg' ? 'image/jpeg' : 'image/png';

    console.log(`${attempt.verdict} → ${fileName}`);
  } catch (error) {
    attempt.error = formatError(error);
    attempt.timedOut = isTimeoutError(error);
    attempt.verdict = classifyAttempt(attempt);
    console.log(`${attempt.verdict} — ${attempt.error}`);
  }

  const { outputBytes: _bytes, outputMimeType: _mime, ...stored } = attempt;
  report.results.push(stored);
  return attempt;
};

const ALL_SCENARIOS = [
  {
    id: 'canonical_img2img',
    label: 'Canonical — Aurelium img2img from selected portrait',
    surface: 'canonical',
    prompt: CANONICAL_PROMPT,
    strength: STRENGTH,
    guidance: GUIDANCE_CANONICAL,
    initFrom: 'portrait',
  },
  {
    id: 'gallery_from_portrait',
    label: 'Gallery — Aurelium img2img directly from portrait (shortcut)',
    surface: 'gallery',
    prompt: GALLERY_PROMPT,
    strength: STRENGTH,
    guidance: GUIDANCE_GALLERY,
    initFrom: 'portrait',
  },
  {
    id: 'gallery_from_canonical',
    label: 'Gallery — Aurelium img2img from canonical output (production chain)',
    surface: 'gallery',
    prompt: GALLERY_PROMPT,
    strength: STRENGTH,
    guidance: GUIDANCE_GALLERY,
    initFrom: 'canonical_img2img',
    chained: true,
  },
  {
    id: 'gallery_from_canonical_variant2',
    label: 'Gallery variant 2 — Aurelium img2img from canonical (different scene)',
    surface: 'gallery',
    prompt: GALLERY_PROMPT_2,
    strength: STRENGTH,
    guidance: GUIDANCE_GALLERY,
    initFrom: 'canonical_img2img',
    chained: true,
  },
];

const scenarios = SCENARIO_FILTER.length
  ? ALL_SCENARIOS.filter((scenario) => SCENARIO_FILTER.includes(scenario.id))
  : ALL_SCENARIOS;

console.log('01_canonical_direct_persist.png — baseline (no API call, portrait saved as canonical)');
console.log('Scenarios:', scenarios.map((scenario) => scenario.id).join(', '));
console.log('');

const byId = {};

for (const scenario of scenarios) {
  if (scenario.chained) continue;

  try {
    const initImage = scenario.initFrom === 'portrait' ? portraitInitImage : null;
    const attempt = await recordResult(scenario, initImage, scenario.initFrom);
    byId[scenario.id] = attempt;
  } catch (error) {
    console.error(`Unhandled error in ${scenario.id}:`, error instanceof Error ? error.message : error);
    report.results.push({
      id: scenario.id,
      verdict: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const canonicalAttempt = byId.canonical_img2img;

if (canonicalAttempt?.ok) {
  if (canonicalAttempt.url && /^https?:\/\//i.test(canonicalAttempt.url)) {
    report.reference.canonicalInitImage = canonicalAttempt.url;
    report.reference.canonicalInitMethod = 'generation_output_url';
  } else if (canonicalAttempt.outputBytes) {
    try {
      report.reference.canonicalInitImage = await uploadReference(
        canonicalAttempt.outputBytes,
        canonicalAttempt.outputMimeType ?? 'image/png',
      );
      report.reference.canonicalInitMethod = 'upload';
    } catch (error) {
      console.log(
        `\n⚠ Could not upload canonical output — chained gallery will use portrait reference (${
          error instanceof Error ? error.message : error
        }).\n`,
      );
    }
  }
} else if (scenarios.some((scenario) => scenario.chained)) {
  console.log('\n⚠ canonical_img2img failed — chained gallery will fall back to portrait reference.\n');
}

for (const scenario of scenarios) {
  if (!scenario.chained) continue;

  const initImage =
    canonicalAttempt?.ok && report.reference.canonicalInitImage
      ? report.reference.canonicalInitImage
      : portraitInitImage;
  const initLabel =
    canonicalAttempt?.ok && report.reference.canonicalInitImage
      ? 'canonical_img2img'
      : 'portrait_fallback';

  try {
    const attempt = await recordResult(scenario, initImage, initLabel);
    byId[scenario.id] = attempt;
  } catch (error) {
    console.error(`Unhandled error in ${scenario.id}:`, error instanceof Error ? error.message : error);
    report.results.push({
      id: scenario.id,
      verdict: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const get = (id) => report.results.find((row) => row.id === id);

const galleryFromCanonical = get('gallery_from_canonical');
const galleryFromPortrait = get('gallery_from_portrait');
const galleryVariant2 = get('gallery_from_canonical_variant2');

const galleryCapable =
  galleryFromCanonical?.verdict === 'CAPABLE'
  || galleryFromPortrait?.verdict === 'CAPABLE';

report.verdict = {
  directPersistCanonical: {
    capable: true,
    file: path.relative(ROOT, directCanonicalFile),
    note: 'Zero API risk — use selected Aurelium portrait as canonical.',
  },
  aureliumCanonicalImg2ImgCapable: get('canonical_img2img')?.verdict === 'CAPABLE',
  aureliumGalleryCapable: galleryCapable,
  results: Object.fromEntries(report.results.map((row) => [row.id, row.verdict])),
  phase1Recommendation:
    galleryFromCanonical?.verdict === 'CAPABLE' && get('canonical_img2img')?.verdict === 'CAPABLE'
      ? 'All-Aurelium img2img chain works. Phase 1: portrait text2img → direct canonical OR canonical img2img → gallery img2img. No Kontext.'
      : get('canonical_img2img')?.verdict !== 'CAPABLE' && galleryCapable
        ? 'Use direct-persist canonical (01_) + Aurelium gallery img2img from that file. Skip canonical img2img.'
        : galleryCapable
          ? 'Gallery works. Prefer direct-persist canonical + gallery img2img from canonical file.'
          : 'Aurelium img2img not ready — check errors before Phase 1.',
  compareVisually: [
    path.relative(ROOT, referenceFile),
    path.relative(ROOT, directCanonicalFile),
    get('canonical_img2img')?.file,
    galleryFromCanonical?.file,
    galleryFromPortrait?.file,
    galleryVariant2?.file,
  ].filter(Boolean),
};

const writeReport = async () => {
  const reportPath = path.join(OUT_DIR, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
};

let reportPath;
try {
  reportPath = await writeReport();
} catch (error) {
  console.error('Could not write report:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log('\n=== SUMMARY ===\n');
console.log('Scenario'.padEnd(36), 'Verdict'.padEnd(14), 'Init from'.padEnd(20), 'Bytes');
console.log('-'.repeat(80));
for (const row of report.results) {
  console.log(
    row.id.padEnd(36),
    (row.verdict ?? '—').padEnd(14),
    (row.initFrom ?? '—').padEnd(20),
    String(row.bytes ?? 0).padStart(6),
  );
}

console.log('\n=== VERDICT ===\n');
console.log('Direct-persist canonical:', report.verdict.directPersistCanonical.note);
console.log('Canonical img2img capable? ', report.verdict.aureliumCanonicalImg2ImgCapable ? 'YES' : 'NO');
console.log('Gallery img2img capable?     ', report.verdict.aureliumGalleryCapable ? 'YES' : 'NO');
console.log('\nPhase 1 recommendation:');
console.log(`  ${report.verdict.phase1Recommendation}`);
console.log('\nCompare these side-by-side (same face = pass):');
for (const file of report.verdict.compareVisually) {
  console.log(`  - ${file}`);
}
console.log(`\nReport: ${path.relative(ROOT, reportPath)}\n`);