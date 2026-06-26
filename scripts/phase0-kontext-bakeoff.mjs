#!/usr/bin/env node
/**
 * Phase 0b — Kontext Pro vs Dev identity-lock bake-off
 *
 * Tests whether flux-kontext-pro can handle canonical + gallery identity lock
 * on adult-leaning companion prompts (the path used after portrait selection).
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/phase0-kontext-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_REFERENCE_FILE=screenshots/bakeoff-phase0/aurelium-..._seed10101.png
 *   BAKEOFF_REFERENCE_URL=https://...
 *   BAKEOFF_GENERATE_REFERENCE=1          # text2img Aurelium if no reference
 *   BAKEOFF_OUT=screenshots/bakeoff-kontext
 *   BAKEOFF_SCENARIOS=canonical_pro,gallery_pro,canonical_dev_off
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY. Run:');
  console.error('  export $(grep -v "^#" .env.local | xargs)');
  console.error('  node scripts/phase0-kontext-bakeoff.mjs');
  process.exit(1);
}

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-kontext');
const PORTRAIT_MODEL =
  process.env.MODELSLAB_PORTRAIT_MODEL?.trim()
  || 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';
const KONTEXT_PRO = process.env.MODELSLAB_KONTEXT_PRO_MODEL?.trim() || 'flux-kontext-pro';
const KONTEXT_DEV = process.env.MODELSLAB_KONTEXT_DEV_MODEL?.trim() || 'flux-kontext-dev';

const DEFAULT_REFERENCE_FILE =
  'screenshots/bakeoff-phase0/aurelium-photorealistic-people-bysilas-v1-0-1771498462_seed10101.png';

const NEGATIVE =
  'anime, cartoon, illustration, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

// Mirrors setup canonical + gallery prompts for a sultry Latina companion.
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

const ALL_SCENARIOS = [
  {
    id: 'canonical_pro',
    label: 'Canonical identity lock — Kontext Pro (production v7 API)',
    surface: 'canonical',
    model: KONTEXT_PRO,
    api: 'v7',
    prompt: CANONICAL_PROMPT,
    safetyChecker: null,
    strength: 0.42,
    guidance: 5,
    productionPath: true,
  },
  {
    id: 'gallery_pro',
    label: 'Gallery from canonical — Kontext Pro (production v7 API)',
    surface: 'gallery',
    model: KONTEXT_PRO,
    api: 'v7',
    prompt: GALLERY_PROMPT,
    safetyChecker: null,
    strength: 0.42,
    guidance: 5,
    productionPath: true,
  },
  {
    id: 'canonical_dev_safety_on',
    label: 'Canonical — Kontext Dev, safety_checker=yes (prod dev default)',
    surface: 'canonical',
    model: KONTEXT_DEV,
    api: 'v6',
    prompt: CANONICAL_PROMPT,
    safetyChecker: true,
    strength: 0.42,
    guidance: 5,
    productionPath: false,
  },
  {
    id: 'canonical_dev_safety_off',
    label: 'Canonical — Kontext Dev, safety_checker=no (uncensored fallback)',
    surface: 'canonical',
    model: KONTEXT_DEV,
    api: 'v6',
    prompt: CANONICAL_PROMPT,
    safetyChecker: false,
    strength: 0.42,
    guidance: 5,
    productionPath: false,
  },
  {
    id: 'gallery_dev_safety_on',
    label: 'Gallery — Kontext Dev, safety_checker=yes',
    surface: 'gallery',
    model: KONTEXT_DEV,
    api: 'v6',
    prompt: GALLERY_PROMPT,
    safetyChecker: true,
    strength: 0.42,
    guidance: 5,
    productionPath: false,
  },
  {
    id: 'gallery_dev_safety_off',
    label: 'Gallery — Kontext Dev, safety_checker=no (uncensored fallback)',
    surface: 'gallery',
    model: KONTEXT_DEV,
    api: 'v6',
    prompt: GALLERY_PROMPT,
    safetyChecker: false,
    strength: 0.42,
    guidance: 5,
    productionPath: false,
  },
];

const SCENARIO_FILTER = (process.env.BAKEOFF_SCENARIOS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const SCENARIOS = SCENARIO_FILTER.length
  ? ALL_SCENARIOS.filter((scenario) => SCENARIO_FILTER.includes(scenario.id))
  : ALL_SCENARIOS;

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

const pollResult = async (initial, label, options = {}) => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${label}: unexpected status ${initial.status}`);
  }

  const maxAttempts = options.maxAttempts ?? 45;
  const intervalMs = options.intervalMs ?? 1500;
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

const uploadReference = async (bytes, mimeType) => {
  const payload = await postJson('https://modelslab.com/api/v6/base64_to_url', {
    key: API_KEY,
    base64_string: toDataUri(bytes, mimeType),
  });
  const url = resolveOutputUrl(payload);
  if (!url) throw new Error('Reference upload returned no URL');
  return url;
};

const loadReferenceBytes = async () => {
  const url = process.env.BAKEOFF_REFERENCE_URL?.trim();
  if (url) {
    const response = await fetch(url);
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
    model_id: PORTRAIT_MODEL,
    prompt,
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: 28,
    guidance_scale: 7.5,
    safety_checker: 'no',
    scheduler: 'DPMSolverMultistepScheduler',
    seed: 10101,
  });

  const result = await pollResult(initial, 'reference portrait');
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('Reference portrait returned no URL');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Reference portrait download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    mimeType: response.headers.get('content-type') ?? 'image/jpeg',
    source: `generated:${PORTRAIT_MODEL}:seed10101`,
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

const isTimeoutError = (error) =>
  error instanceof Error && /timed out/i.test(error.message);

const runKontextV7 = async (scenario, initImage) => {
  const initial = await postJson('https://modelslab.com/api/v7/images/image-to-image', {
    key: API_KEY,
    model_id: scenario.model,
    prompt: scenario.prompt,
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    init_image: initImage,
    aspect_ratio: '3:4',
  });
  // Kontext Pro v7 can run 3–8 min on busy queues.
  return pollResult(initial, scenario.id, { maxAttempts: 120, intervalMs: 2000 });
};

const runKontextV6 = async (scenario, initImage) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/img2img', {
    key: API_KEY,
    model_id: scenario.model,
    prompt: scenario.prompt,
    init_image: initImage,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: 28,
    guidance: scenario.guidance,
    strength: scenario.strength,
    safety_checker: scenario.safetyChecker ? 'yes' : 'no',
  });
  return pollResult(initial, scenario.id);
};

const downloadOutput = async (result) => {
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  return { url, bytes, ext, nsfw: Boolean(result.nsfw_content_detected) };
};

const safeFileName = (value) => value.replace(/[^a-z0-9._-]+/gi, '_');

await fs.mkdir(OUT_DIR, { recursive: true });

let reference = await loadReferenceBytes().catch(() => null);
if (!reference || process.env.BAKEOFF_GENERATE_REFERENCE === '1') {
  console.log('Generating reference portrait with', PORTRAIT_MODEL, '...');
  reference = await generateReferencePortrait();
}

const referenceFile = path.join(OUT_DIR, '00_reference_portrait.png');
await fs.writeFile(referenceFile, reference.bytes);
console.log('Reference:', reference.source);
console.log('Saved:  ', path.relative(ROOT, referenceFile));

const initImage = await uploadReference(reference.bytes, reference.mimeType);
console.log('Uploaded reference for img2img\n');

const report = {
  ranAt: new Date().toISOString(),
  reference: {
    source: reference.source,
    file: path.relative(ROOT, referenceFile),
    initImage,
  },
  kontextProModel: KONTEXT_PRO,
  kontextDevModel: KONTEXT_DEV,
  scenarios: SCENARIOS.map(({ id, label, productionPath }) => ({ id, label, productionPath })),
  results: [],
  verdict: null,
};

console.log('Phase 0b — Kontext identity-lock bake-off');
console.log('Scenarios:', SCENARIOS.map((scenario) => scenario.id).join(', '));
console.log('Output:  ', OUT_DIR);
console.log('');

for (const scenario of SCENARIOS) {
  process.stdout.write(`→ ${scenario.id} ... `);
  const attempt = {
    id: scenario.id,
    label: scenario.label,
    surface: scenario.surface,
    model: scenario.model,
    api: scenario.api,
    safetyChecker: scenario.safetyChecker,
    productionPath: scenario.productionPath,
    ok: false,
  };

  const maxAttempts = Number(process.env.BAKEOFF_RETRIES ?? 2) + 1;

  try {
    let result;
    let lastError;
    for (let run = 1; run <= maxAttempts; run += 1) {
      try {
        result =
          scenario.api === 'v7'
            ? await runKontextV7(scenario, initImage)
            : await runKontextV6(scenario, initImage);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (!isTimeoutError(error) || run === maxAttempts) throw error;
        process.stdout.write(`timeout (retry ${run}/${maxAttempts - 1}) ... `);
      }
    }
    if (!result) throw lastError ?? new Error('Generation failed');

    const output = await downloadOutput(result);
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

    console.log(`${attempt.verdict} → ${fileName}`);
  } catch (error) {
    attempt.error = error instanceof Error ? error.message : String(error);
    attempt.timedOut = isTimeoutError(error);
    attempt.verdict = classifyAttempt(attempt);
    console.log(`${attempt.verdict} — ${attempt.error}`);
  }

  report.results.push(attempt);
}

const byId = Object.fromEntries(report.results.map((row) => [row.id, row]));

const productionRows = report.results.filter((row) => row.productionPath);
const productionCapable = productionRows.every((row) => row.verdict === 'CAPABLE');
const productionBlocked = productionRows.some((row) =>
  row.verdict === 'BLACK_CARD' || row.verdict === 'NSFW_FLAGGED' || row.verdict === 'TOO_SMALL',
);
const productionInconclusive = productionRows.some((row) =>
  row.verdict === 'TIMEOUT' || row.verdict === 'FAILED',
);

const bestUncensoredCanonical = ['canonical_dev_safety_off', 'canonical_pro'].find(
  (id) => byId[id]?.verdict === 'CAPABLE',
);
const bestUncensoredGallery = ['gallery_dev_safety_off', 'gallery_pro'].find(
  (id) => byId[id]?.verdict === 'CAPABLE',
);

report.verdict = {
  kontextProProductionCapable: productionCapable,
  kontextProProductionBlocked: productionBlocked,
  kontextProProductionInconclusive: productionInconclusive && !productionBlocked,
  productionResults: Object.fromEntries(
    productionRows.map((row) => [row.id, row.verdict]),
  ),
  recommendedCanonicalModel:
    productionCapable && byId.canonical_pro?.verdict === 'CAPABLE'
      ? KONTEXT_PRO
      : bestUncensoredCanonical?.includes('dev')
        ? KONTEXT_DEV
        : bestUncensoredCanonical
          ? KONTEXT_PRO
          : null,
  recommendedGalleryModel:
    productionCapable && byId.gallery_pro?.verdict === 'CAPABLE'
      ? KONTEXT_PRO
      : bestUncensoredGallery?.includes('dev')
        ? KONTEXT_DEV
        : bestUncensoredGallery
          ? KONTEXT_PRO
          : null,
  phase1Action: productionCapable
    ? 'Keep flux-kontext-pro for canonical + gallery identity lock.'
    : productionBlocked
      ? 'Switch identity lock to flux-kontext-dev with safety_checker:no — Kontext Pro blanks or blocks adult canonical/gallery.'
      : productionInconclusive
        ? 'Re-run canonical_pro (timed out or failed) before Phase 1 — gallery_pro result alone is not enough.'
        : byId.canonical_dev_safety_off?.verdict === 'CAPABLE' || byId.gallery_dev_safety_off?.verdict === 'CAPABLE'
          ? 'Switch identity lock to flux-kontext-dev with safety_checker:no — Kontext Pro did not pass all production scenarios.'
          : 'Neither Kontext model passed — revise canonical/gallery prompts or pick a different img2img model before Phase 1.',
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===\n');
console.log('Scenario'.padEnd(34), 'Verdict'.padEnd(14), 'Black', 'NSFW', 'Bytes');
console.log('-'.repeat(72));
for (const row of report.results) {
  console.log(
    row.id.padEnd(34),
    (row.verdict ?? '—').padEnd(14),
    String(row.black ? 1 : 0).padStart(5),
    String(row.nsfw ? 1 : 0).padStart(4),
    String(row.bytes ?? 0).padStart(6),
  );
}

console.log('\n=== VERDICT ===\n');
if (productionCapable) {
  console.log('Kontext Pro production path capable? YES');
} else if (productionBlocked) {
  console.log('Kontext Pro production path capable? NO (blocked/black card)');
} else if (productionInconclusive) {
  console.log('Kontext Pro production path capable? INCONCLUSIVE (timeout/API error — re-run)');
} else {
  console.log('Kontext Pro production path capable? NO');
}
for (const [id, verdict] of Object.entries(report.verdict.productionResults)) {
  console.log(`  ${id}: ${verdict}`);
}
console.log('\nPhase 1 recommendation:');
console.log(`  ${report.verdict.phase1Action}`);
if (report.verdict.recommendedCanonicalModel) {
  console.log(`  Canonical model → ${report.verdict.recommendedCanonicalModel}`);
}
if (report.verdict.recommendedGalleryModel) {
  console.log(`  Gallery model     → ${report.verdict.recommendedGalleryModel}`);
}

console.log(`\nOpen side-by-side: ${path.relative(ROOT, referenceFile)} vs outputs in ${path.relative(ROOT, OUT_DIR)}/`);
console.log(`Report: ${path.relative(ROOT, reportPath)}\n`);