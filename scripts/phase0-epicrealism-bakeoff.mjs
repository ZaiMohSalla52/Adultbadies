#!/usr/bin/env node
/**
 * Phase 0e — epiCRealism XL bake-off vs Aurelium
 *
 * Tests portrait (text2img), body (text2img), and gallery wardrobe (img2img)
 * before switching MODELSLAB_PORTRAIT_MODEL or gallery checkpoint.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/phase0-epicrealism-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_OUT=screenshots/bakeoff-epicrealism
 *   BAKEOFF_SEEDS=10101
 *   BAKEOFF_STRENGTHS=0.50
 *   BAKEOFF_SCENARIOS=portrait,body,rooftop,apartment
 *   BAKEOFF_MODELS=epicrealism,aurelium
 *   node scripts/phase0-epicrealism-bakeoff.mjs --preflight
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
  console.error('  node scripts/phase0-epicrealism-bakeoff.mjs');
  process.exit(1);
}

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-epicrealism');

const EPICREALISM_MODEL =
  process.env.MODELSLAB_EPICREALISM_MODEL?.trim() || 'epicrealism-xl-vxv-anewstory-realism';
const AURELIUM_MODEL =
  process.env.MODELSLAB_PORTRAIT_MODEL?.trim()
  || 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';

const REALISTIC_PREFIX = 'R3alisticF, ';

const DEFAULT_REFERENCE_FILE =
  'screenshots/bakeoff-phase0/aurelium-photorealistic-people-bysilas-v1-0-1771498462_seed10101.png';

const SEEDS = (process.env.BAKEOFF_SEEDS ?? '10101')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));

const STRENGTHS = (process.env.BAKEOFF_STRENGTHS ?? '0.50')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0 && value < 1);

const GUIDANCE = Number(process.env.BAKEOFF_GUIDANCE ?? 7.5);
const STEPS = Number(process.env.BAKEOFF_STEPS ?? 28);
const IMG2IMG_GUIDANCE = Number(process.env.BAKEOFF_IMG2IMG_GUIDANCE ?? 5.5);
const IMG2IMG_STEPS = Number(process.env.BAKEOFF_IMG2IMG_STEPS ?? 32);

const NEGATIVE =
  'anime, cartoon, illustration, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette';

const PROMPTS = {
  portrait: {
    id: 'portrait',
    surface: 'portrait',
    mode: 'text2img',
    label: 'Setup portrait — head and shoulders, adult glamour',
    text: [
      'A real adult woman, age 24.',
      'Latina heritage, medium skin tone, long dark brown hair, brown eyes, curvy body.',
      'Close portrait, head and shoulders, face prominent.',
      'Urban street background with soft bokeh.',
      'Single person portrait photograph of a real human, centered frame.',
      'Warm golden natural window light, soft directional warmth.',
      'Sultry seductive gaze, parted lips, magnetic adult allure.',
      'Sultry seductive styling with adult glamour energy.',
      'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
      'Candid amateur photograph of a real person, natural available light, true-to-life skin tones.',
    ].join(' '),
  },
  body: {
    id: 'body',
    surface: 'body',
    mode: 'text2img',
    label: 'Gallery body — three-quarter waist-up, urban golden hour',
    text: [
      'Portrait photograph of an adult woman.',
      'Latina woman with warm medium-tan skin, age 24, long dark brown hair, brown eyes, curvy body.',
      'Scene: urban street at golden hour, soft city bokeh behind subject.',
      'Wardrobe: fitted casual top, flattering neckline, smart evening styling.',
      'Three-quarter waist-up framing, natural standing pose, confident expression.',
      'Warm sunset rim light on face and torso. Real-world environment with depth.',
      'Candid amateur photograph of a real person, true-to-life skin tones.',
      'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.',
    ].join(' '),
  },
  rooftop: {
    id: 'rooftop',
    surface: 'wardrobe',
    mode: 'img2img',
    label: 'Wardrobe — urban rooftop satin slip dress',
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
    surface: 'wardrobe',
    mode: 'img2img',
    label: 'Wardrobe — cozy apartment oversized white shirt',
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
  epicrealism: { id: 'epicrealism', modelId: EPICREALISM_MODEL, label: 'epiCRealism XL' },
  aurelium: { id: 'aurelium', modelId: AURELIUM_MODEL, label: 'Aurelium' },
};

const needsRealisticPrefix = (modelId) =>
  /realistic-portrait|realism/i.test(modelId) && !/aurelium/i.test(modelId);

const applyModelPrompt = (prompt, modelId) => {
  if (needsRealisticPrefix(modelId)) return `${REALISTIC_PREFIX}${prompt}`;
  return prompt;
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

  const refFile = process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE;
  const fromReport = await loadPhase0ReportUrl(refFile);
  if (fromReport) {
    return { initImage: fromReport, method: 'phase0_report_url' };
  }

  const file = path.resolve(ROOT, refFile);
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

const runText2Img = async (scenario) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    model_id: scenario.modelId,
    prompt: applyModelPrompt(scenario.prompt, scenario.modelId),
    negative_prompt: NEGATIVE,
    enhance_prompt: false,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: STEPS,
    guidance_scale: GUIDANCE,
    safety_checker: 'no',
    scheduler: 'DPMSolverMultistepScheduler',
    seed: scenario.seed,
  });
  return pollResult(initial, scenario.id);
};

const runImg2Img = async (scenario) => {
  const initial = await postJson('https://modelslab.com/api/v6/images/img2img', {
    key: API_KEY,
    model_id: scenario.modelId,
    prompt: applyModelPrompt(scenario.prompt, scenario.modelId),
    negative_prompt: NEGATIVE,
    init_image: scenario.initImage,
    width: 768,
    height: 1024,
    samples: 1,
    num_inference_steps: IMG2IMG_STEPS,
    guidance: IMG2IMG_GUIDANCE,
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
  ? promptFilter.map((id) => PROMPTS[id]).filter(Boolean)
  : Object.values(PROMPTS);

const models = modelFilter.length
  ? modelFilter.map((id) => MODELS[id]).filter(Boolean)
  : Object.values(MODELS);

if (!prompts.length || !models.length) {
  console.error('Invalid BAKEOFF_SCENARIOS or BAKEOFF_MODELS');
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });

const referenceFile = path.resolve(
  ROOT,
  process.env.BAKEOFF_REFERENCE_FILE?.trim() || DEFAULT_REFERENCE_FILE,
);
let initImage = null;
let initMethod = null;
const needsImg2Img = prompts.some((prompt) => prompt.mode === 'img2img');

if (needsImg2Img) {
  try {
    const referenceBytes = await fs.readFile(referenceFile);
    const referenceCopy = path.join(OUT_DIR, '00_canonical_reference.png');
    await fs.writeFile(referenceCopy, referenceBytes);
    const resolved = await resolveInitImage();
    initImage = resolved.initImage;
    initMethod = resolved.method;
  } catch (error) {
    console.error(`Could not load reference for img2img: ${formatError(error)}`);
    console.error('Run phase0-portrait-bakeoff first or set BAKEOFF_REFERENCE_URL.');
    process.exit(1);
  }
}

const scenarios = [];
for (const model of models) {
  for (const prompt of prompts) {
    if (prompt.mode === 'text2img') {
      for (const seed of SEEDS) {
        scenarios.push({
          id: `${prompt.id}_${model.id}_seed${seed}`,
          modelKey: model.id,
          modelId: model.modelId,
          modelLabel: model.label,
          promptId: prompt.id,
          surface: prompt.surface,
          mode: prompt.mode,
          promptLabel: prompt.label,
          prompt: prompt.text,
          seed,
        });
      }
    } else {
      for (const strength of STRENGTHS) {
        const strengthLabel = String(strength).replace('.', '');
        scenarios.push({
          id: `${prompt.id}_${model.id}_s${strengthLabel}`,
          modelKey: model.id,
          modelId: model.modelId,
          modelLabel: model.label,
          promptId: prompt.id,
          surface: prompt.surface,
          mode: prompt.mode,
          promptLabel: prompt.label,
          prompt: prompt.text,
          strength,
          initImage,
        });
      }
    }
  }
}

console.log('\nPhase 0e — epiCRealism XL bake-off');
console.log('epiCRealism:  ', EPICREALISM_MODEL);
console.log('Aurelium:     ', AURELIUM_MODEL);
console.log('Seeds:        ', SEEDS.join(', '));
console.log('Strengths:    ', STRENGTHS.join(', '));
if (initMethod) console.log('Init image:   ', initMethod);
console.log('Scenarios:    ', scenarios.length);
console.log('Output:       ', OUT_DIR);
console.log('');

const report = {
  ranAt: new Date().toISOString(),
  epicrealismModel: EPICREALISM_MODEL,
  aureliumModel: AURELIUM_MODEL,
  seeds: SEEDS,
  strengths: STRENGTHS,
  reference: initImage ? { initImage, initMethod } : null,
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
    surface: scenario.surface,
    mode: scenario.mode,
    promptLabel: scenario.promptLabel,
    seed: scenario.seed ?? null,
    strength: scenario.strength ?? null,
    ok: false,
  };

  try {
    const result = await withRetries(
      scenario.id,
      () => (scenario.mode === 'text2img' ? runText2Img(scenario) : runImg2Img(scenario)),
    );
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
    attempt.generationTime = result.generationTime ?? null;
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

const scoreModel = (key) => {
  const rows = report.results.filter((row) => row.modelKey === key);
  const bySurface = (surface) => rows.filter((row) => row.surface === surface);
  return {
    capable: rows.filter((row) => row.verdict === 'CAPABLE').length,
    black: rows.filter((row) => row.verdict === 'BLACK_CARD').length,
    nsfw: rows.filter((row) => row.verdict === 'NSFW_FLAGGED').length,
    failed: rows.filter((row) => row.verdict === 'FAILED' || row.verdict === 'TIMEOUT').length,
    total: rows.length,
    portrait: bySurface('portrait').map((row) => row.verdict),
    body: bySurface('body').map((row) => row.verdict),
    wardrobe: bySurface('wardrobe').map((row) => row.verdict),
  };
};

const epicScore = scoreModel('epicrealism');
const aureliumScore = scoreModel('aurelium');

const pickWinner = (epic, aurelium) => {
  if (epic.capable > aurelium.capable) return 'epicrealism';
  if (aurelium.capable > epic.capable) return 'aurelium';
  if (epic.capable === aurelium.capable && epic.capable > 0) return 'tie_review_visually';
  return 'inconclusive';
};

report.verdict = {
  epicrealism: epicScore,
  aurelium: aureliumScore,
  overallWinner: pickWinner(epicScore, aureliumScore),
  deployRecommendation:
    epicScore.capable >= aureliumScore.capable && epicScore.failed === 0 && epicScore.black === 0
      ? 'epiCRealism passed automated checks — review images visually before setting MODELSLAB_PORTRAIT_MODEL.'
      : aureliumScore.capable > epicScore.capable
        ? 'Keep Aurelium as default — epiCRealism did not beat it on automated checks.'
        : 'Mixed results — compare images side by side before deploy.',
  compareVisually: report.results.filter((row) => row.ok).map((row) => row.file).filter(Boolean),
};

const reportPath = path.join(OUT_DIR, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===\n');
console.log('Scenario'.padEnd(38), 'Model'.padEnd(12), 'Surface'.padEnd(10), 'Verdict'.padEnd(12), 'Bytes');
console.log('-'.repeat(86));
for (const row of report.results) {
  console.log(
    row.id.padEnd(38),
    row.modelKey.padEnd(12),
    row.surface.padEnd(10),
    (row.verdict ?? '—').padEnd(12),
    String(row.bytes ?? 0).padStart(6),
  );
}

console.log('\n=== MODEL SCORES ===\n');
console.log(
  'epiCRealism:',
  `${epicScore.capable}/${epicScore.total} capable`,
  `| ${epicScore.black} black | ${epicScore.nsfw} nsfw | ${epicScore.failed} failed`,
);
console.log(
  'Aurelium:   ',
  `${aureliumScore.capable}/${aureliumScore.total} capable`,
  `| ${aureliumScore.black} black | ${aureliumScore.nsfw} nsfw | ${aureliumScore.failed} failed`,
);

console.log('\n=== VERDICT ===\n');
console.log('Overall winner (automated):', report.verdict.overallWinner);
console.log(report.verdict.deployRecommendation);
console.log('\nOpen these side by side (portrait / body / rooftop / apartment):');
for (const file of report.verdict.compareVisually) {
  console.log(`  - ${file}`);
}
console.log(`\nReport: ${path.relative(ROOT, reportPath)}\n`);