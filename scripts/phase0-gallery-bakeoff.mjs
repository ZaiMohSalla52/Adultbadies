#!/usr/bin/env node
/**
 * Phase 0d — Gallery img2img bake-off: Aurelium vs SDXL
 *
 * Compares face-locked gallery generation from the canonical portrait using
 * both checkpoints at multiple strength values.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/phase0-gallery-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_STRENGTHS=0.50,0.58          # default: 0.50,0.58
 *   BAKEOFF_OUT=screenshots/bakeoff-gallery-sdxl-vs-aurelium
 *   BAKEOFF_REFERENCE_URL=https://...    # skip upload (phase0 CDN URL)
 *   BAKEOFF_SCENARIOS=rooftop,apartment  # default: both prompts
 *   BAKEOFF_MODELS=aurelium,sdxl         # default: both
 *   node scripts/phase0-gallery-bakeoff.mjs --preflight
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FETCH_TIMEOUT_MS = Number(process.env.BAKEOFF_FETCH_TIMEOUT_MS ?? 180_000);
const apiFetch = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

const API_KEY = process.env.MODELSLAB_API_KEY?.trim();
if (!API_KEY) {
  console.error('Missing MODELSLAB_API_KEY. Run:');
  console.error('  export $(grep -v "^#" .env.local | xargs)');
  console.error('  node scripts/phase0-gallery-bakeoff.mjs');
  process.exit(1);
}

const OUT_DIR = path.resolve(
  ROOT,
  process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-gallery-sdxl-vs-aurelium',
);

const AURELIUM_MODEL =
  process.env.MODELSLAB_PORTRAIT_MODEL?.trim()
  || 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';
const SDXL_MODEL = process.env.MODELSLAB_SDXL_MODEL?.trim() || 'sdxl';

const DEFAULT_REFERENCE_FILE =
  'screenshots/bakeoff-phase0/aurelium-photorealistic-people-bysilas-v1-0-1771498462_seed10101.png';

const STRENGTHS = (process.env.BAKEOFF_STRENGTHS ?? '0.50,0.58')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0 && value < 1);

const GUIDANCE = Number(process.env.BAKEOFF_GUIDANCE ?? 5.5);
const STEPS = Number(process.env.BAKEOFF_STEPS ?? 32);

const NEGATIVE =
  'anime, cartoon, illustration, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

const GALLERY_PROMPTS = {
  rooftop: {
    id: 'rooftop',
    label: 'Urban rooftop at golden hour, satin slip dress',
    text: [
      'Portrait photograph of an adult woman.',
      'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
      'Scene: urban rooftop at golden hour, city skyline bokeh, wind in hair.',
      'Wardrobe: fitted satin slip dress, sultry evening look.',
      'Lighting: warm sunset rim light, seductive confident expression.',
      'Three-quarter waist-up framing. Real-world environment with depth. Candid real-photo feel.',
      'Gallery variant. Vary scene, angle, and outfit while preserving identity.',
      'Candid amateur photograph of a real person, true-to-life skin tones.',
      'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
    ].join(' '),
  },
  apartment: {
    id: 'apartment',
    label: 'Cozy apartment evening, oversized white shirt',
    text: [
      'Portrait photograph of an adult woman.',
      'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
      'Scene: cozy apartment living room, soft lamp light, evening indoors.',
      'Wardrobe: oversized white shirt, relaxed intimate styling.',
      'Lighting: warm indoor ambient light, soft natural expression.',
      'Three-quarter waist-up framing. Candid real-photo feel.',
      'Gallery variant. Preserve the same face and identity.',
      'True-to-life skin tones. Face clearly lit — no silhouette.',
    ].join(' '),
  },
};

const MODELS = {
  aurelium: { id: 'aurelium', modelId: AURELIUM_MODEL, label: 'Aurelium' },
  sdxl: { id: 'sdxl', modelId: SDXL_MODEL, label: 'SDXL' },
};

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

const withRetries = async (label, run, attempts = 4) => {
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
  });

const pollResult = async (initial, label) => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${label}: unexpected status ${initial.status}`);
  }

  const requestId = String(initial.id);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const waitMs = attempt === 0 && initial.eta ? Math.min(initial.eta * 1000, 4000) : 2000;
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
    // optional
  }
  return null;
};

const resolveInitImage = async () => {
  const explicitUrl = process.env.BAKEOFF_REFERENCE_URL?.trim();
  if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) {
    return { initImage: explicitUrl, method: 'BAKEOFF_REFERENCE_URL' };
  }

  const fromReport = await loadPhase0ReportUrl(
    process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE,
  );
  if (fromReport) {
    return { initImage: fromReport, method: 'phase0_report_url' };
  }

  const file = path.resolve(ROOT, process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE);
  const bytes = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const payload = await postJson('https://modelslab.com/api/v6/base64_to_url', {
    key: API_KEY,
    base64_string: `data:${mimeType};base64,${bytes.toString('base64')}`,
  });
  const url = resolveOutputUrl(payload);
  if (!url) throw new Error('Reference upload returned no URL');
  return { initImage: url, method: 'upload' };
};

const preflightCheck = async () => {
  console.log('Preflight: checking connectivity to modelslab.com ...');
  const response = await apiFetch('https://modelslab.com/', { method: 'GET' });
  console.log(`  modelslab.com reachable (HTTP ${response.status})`);
};

const runImg2Img = async (scenario) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/img2img', {
    key: API_KEY,
    model_id: scenario.modelId,
    prompt: scenario.prompt,
    negative_prompt: NEGATIVE,
    init_image: scenario.initImage,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: STEPS,
    guidance: GUIDANCE,
    strength: scenario.strength,
    safety_checker: 'no',
    enhance_prompt: false,
  });
  return pollResult(initial, scenario.id);
};

const safeFileName = (value) => value.replace(/[^a-z0-9._-]+/gi, '_');

if (process.argv.includes('--preflight')) {
  await preflightCheck();
  console.log('\nPreflight passed. Run without --preflight to start.\n');
  process.exit(0);
}

await preflightCheck();

const promptFilter = (process.env.BAKEOFF_SCENARIOS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const modelFilter = (process.env.BAKEOFF_MODELS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const prompts = promptFilter.length
  ? promptFilter.map((id) => GALLERY_PROMPTS[id]).filter(Boolean)
  : Object.values(GALLERY_PROMPTS);

const models = modelFilter.length
  ? modelFilter.map((id) => MODELS[id]).filter(Boolean)
  : Object.values(MODELS);

if (!prompts.length || !models.length || !STRENGTHS.length) {
  console.error('Invalid BAKEOFF_SCENARIOS, BAKEOFF_MODELS, or BAKEOFF_STRENGTHS');
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });

const referenceFile = path.resolve(
  ROOT,
  process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE,
);
const referenceBytes = await fs.readFile(referenceFile);
const referenceCopy = path.join(OUT_DIR, '00_canonical_reference.png');
await fs.writeFile(referenceCopy, referenceBytes);

const { initImage, method: initMethod } = await resolveInitImage();

const scenarios = [];
for (const model of models) {
  for (const prompt of prompts) {
    for (const strength of STRENGTHS) {
      const strengthLabel = String(strength).replace('.', '');
      scenarios.push({
        id: `${model.id}_${prompt.id}_s${strengthLabel}`,
        modelKey: model.id,
        modelId: model.modelId,
        modelLabel: model.label,
        promptId: prompt.id,
        promptLabel: prompt.label,
        prompt: prompt.text,
        strength,
        initImage,
      });
    }
  }
}

console.log('\nPhase 0d — Gallery bake-off: Aurelium vs SDXL');
console.log('Aurelium model:', AURELIUM_MODEL);
console.log('SDXL model:    ', SDXL_MODEL);
console.log('Strengths:     ', STRENGTHS.join(', '));
console.log('Init image:    ', initMethod);
console.log('Scenarios:     ', scenarios.length);
console.log('Output:        ', OUT_DIR);
console.log('');

const report = {
  ranAt: new Date().toISOString(),
  aureliumModel: AURELIUM_MODEL,
  sdxlModel: SDXL_MODEL,
  strengths: STRENGTHS,
  guidance: GUIDANCE,
  steps: STEPS,
  reference: {
    file: path.relative(ROOT, referenceCopy),
    initImage,
    initMethod,
  },
  results: [],
  verdict: null,
};

for (const scenario of scenarios) {
  process.stdout.write(`→ ${scenario.id} ... `);
  const attempt = {
    id: scenario.id,
    modelKey: scenario.modelKey,
    modelId: scenario.modelId,
    promptId: scenario.promptId,
    promptLabel: scenario.promptLabel,
    strength: scenario.strength,
    ok: false,
  };

  try {
    const result = await withRetries(scenario.id, () => runImg2Img(scenario));
    const url = resolveOutputUrl(result);
    if (!url) throw new Error('No output URL');

    const response = await apiFetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    const black = isMostlyBlack(bytes);

    const fileName = `${safeFileName(scenario.id)}.${ext}`;
    const filePath = path.join(OUT_DIR, fileName);
    await fs.writeFile(filePath, bytes);

    attempt.ok = true;
    attempt.black = black;
    attempt.nsfw = Boolean(result.nsfw_content_detected);
    attempt.bytes = bytes.byteLength;
    attempt.file = path.relative(ROOT, filePath);
    attempt.url = url;
    attempt.verdict = classifyAttempt(attempt);

    console.log(`${attempt.verdict} → ${fileName}`);
  } catch (error) {
    attempt.error = formatError(error);
    attempt.timedOut = isTimeoutError(error);
    attempt.verdict = classifyAttempt(attempt);
    console.log(`${attempt.verdict} — ${attempt.error}`);
  }

  report.results.push(attempt);
}

const capable = report.results.filter((row) => row.verdict === 'CAPABLE');
const byModel = (key) => capable.filter((row) => row.modelKey === key);

const scoreModel = (key) => {
  const rows = report.results.filter((row) => row.modelKey === key);
  return {
    capable: rows.filter((row) => row.verdict === 'CAPABLE').length,
    black: rows.filter((row) => row.verdict === 'BLACK_CARD').length,
    failed: rows.filter((row) => row.verdict === 'FAILED' || row.verdict === 'TIMEOUT').length,
    total: rows.length,
  };
};

const aureliumScore = scoreModel('aurelium');
const sdxlScore = scoreModel('sdxl');

let galleryWinner = 'inconclusive';
if (aureliumScore.capable > sdxlScore.capable) galleryWinner = 'aurelium';
else if (sdxlScore.capable > aureliumScore.capable) galleryWinner = 'sdxl';
else if (aureliumScore.capable === sdxlScore.capable && aureliumScore.capable > 0) {
  galleryWinner = 'tie_review_visually';
}

report.verdict = {
  aurelium: aureliumScore,
  sdxl: sdxlScore,
  galleryWinner,
  phase1Recommendation:
    galleryWinner === 'aurelium'
      ? `Set gallery img2img to Aurelium (${AURELIUM_MODEL}) at winning strength.`
      : galleryWinner === 'sdxl'
        ? `Set gallery img2img to SDXL (${SDXL_MODEL}) at winning strength.`
        : galleryWinner === 'tie_review_visually'
          ? 'Both models tied on automated checks — pick by visual face lock + scene variety.'
          : 'Neither model passed — fix network or retry before Phase 1.',
  compareVisually: [
    path.relative(ROOT, referenceCopy),
    ...capable.map((row) => row.file).filter(Boolean),
  ],
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===\n');
console.log('Scenario'.padEnd(34), 'Model'.padEnd(10), 'Str'.padEnd(6), 'Verdict'.padEnd(12), 'Bytes');
console.log('-'.repeat(78));
for (const row of report.results) {
  console.log(
    row.id.padEnd(34),
    row.modelKey.padEnd(10),
    String(row.strength).padEnd(6),
    (row.verdict ?? '—').padEnd(12),
    String(row.bytes ?? 0).padStart(6),
  );
}

console.log('\n=== MODEL SCORES ===\n');
console.log('Aurelium:', `${aureliumScore.capable}/${aureliumScore.total} capable`, `| ${aureliumScore.black} black | ${aureliumScore.failed} failed`);
console.log('SDXL:    ', `${sdxlScore.capable}/${sdxlScore.total} capable`, `| ${sdxlScore.black} black | ${sdxlScore.failed} failed`);

console.log('\n=== VERDICT ===\n');
console.log('Gallery winner (automated):', galleryWinner);
console.log(report.verdict.phase1Recommendation);
console.log('\nCompare face vs reference, then scene variety (rooftop / apartment):');
for (const file of report.verdict.compareVisually) {
  console.log(`  - ${file}`);
}
console.log(`\nReport: ${path.relative(ROOT, reportPath)}\n`);