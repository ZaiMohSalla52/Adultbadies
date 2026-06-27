#!/usr/bin/env node
/**
 * Pre-switch portrait bake-off: Aurelium (current) vs Flux vs Beautyfool.
 *
 * Tests both prompt profiles that matter in production:
 *   - blonde  — typical user setup (lookalike cluster risk)
 *   - latina  — adult glamour black-card stress test
 *
 * Usage:
 *   node scripts/phase0-portrait-switch-bakeoff.mjs
 *
 * Optional:
 *   BAKEOFF_MODELS=aurelium,flux,beautyfoolultrareal-v20
 *   BAKEOFF_PROMPTS=blonde,latina
 *   BAKEOFF_SEEDS=10101,30303
 *   BAKEOFF_OUT=screenshots/bakeoff-portrait-switch
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

const AURELIUM_MODEL = 'aurelium-photorealistic-people-bysilas-v1-0-1771498462';

const MODELS = (process.env.BAKEOFF_MODELS ?? 'aurelium,flux,beautyfoolultrareal-v20')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((key) => {
    if (key === 'aurelium') return { key: 'aurelium', modelId: AURELIUM_MODEL };
    return { key, modelId: key };
  });

const PROMPT_KEYS = (process.env.BAKEOFF_PROMPTS ?? 'blonde,latina')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const SEEDS = (process.env.BAKEOFF_SEEDS ?? '10101,30303')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value));

const OUT_DIR = path.resolve(ROOT, process.env.BAKEOFF_OUT ?? 'screenshots/bakeoff-portrait-switch');

const PROMPTS = {
  blonde: [
    'A real adult woman, age 24.',
    'Caucasian heritage, fair skin, long wavy blonde hair, blue eyes, slim athletic body.',
    'Close portrait, head and shoulders, face prominent, centered frame.',
    'Soft apartment background with gentle bokeh.',
    'Single person portrait photograph of a real human.',
    'Warm natural window light, soft directional warmth.',
    'Confident warm smile, magnetic adult presence.',
    'Sultry seductive styling with adult glamour energy.',
    'Face and body clearly lit — no underexposure, no silhouette.',
    'Candid amateur photograph of a real person, natural available light, true-to-life skin tones.',
    'Face DNA: oval face with balanced proportions, soft rounded jawline, straight refined nose bridge, medium lips with natural rose tint, arched brows with natural thickness, high prominent cheekbones, average eye spacing with almond eye shape.',
  ].join(' '),
  latina: [
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
};

const AURELIUM_NEGATIVE =
  'anime (child:1.5), ((((underage)))), ((((child)))), (((kid))), (((preteen))), (teen:1.5), wrinkles, aged skin, elderly face, sagging skin, crow feet, ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy';

const STANDARD_NEGATIVE =
  'anime, cartoon, illustration, child, teen, underage, worst quality, low quality, blurry, distorted, bad anatomy, watermark, text, logo, underexposure, too dark, black crush, silhouette, cloned face';

const AURELIUM_QUALITY_SUFFIX =
  'highly detailed, cinematic lighting, sharp focus, f/1.8, 85mm, centered composition, professionally color graded, soft diffused light, photorealistic HDR';

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

  const requestId = String(initial.id);
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const waitMs = attempt === 0 && initial.eta ? Math.min(initial.eta * 1000, 4000) : 1500;
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

const buildRequest = ({ modelKey, modelId, promptKey, corePrompt, seed }) => {
  if (modelKey === 'aurelium') {
    return {
      model_id: modelId,
      prompt: `Close portrait photorealistic seed ${seed} hyperrealistic, ${corePrompt}, ${AURELIUM_QUALITY_SUFFIX}`,
      negative_prompt: AURELIUM_NEGATIVE,
      enhance_prompt: 'yes',
      scheduler: 'UniPCMultistepScheduler',
      num_inference_steps: 28,
      guidance_scale: 7.5,
    };
  }

  if (/realistic-portrait/i.test(modelId)) {
    return {
      model_id: modelId,
      prompt: `R3alisticF, ${corePrompt}`,
      negative_prompt: STANDARD_NEGATIVE,
      enhance_prompt: false,
      scheduler: 'DPMSolverMultistepScheduler',
      num_inference_steps: 28,
      guidance_scale: 7.5,
    };
  }

  return {
    model_id: modelId,
    prompt: corePrompt,
    negative_prompt: STANDARD_NEGATIVE,
    enhance_prompt: false,
    scheduler: 'DPMSolverMultistepScheduler',
    num_inference_steps: 28,
    guidance_scale: 7.5,
  };
};

const generateOne = async ({ modelKey, modelId, promptKey, seed }) => {
  const corePrompt = PROMPTS[promptKey];
  if (!corePrompt) throw new Error(`Unknown prompt key: ${promptKey}`);

  const request = buildRequest({ modelKey, modelId, promptKey, corePrompt, seed });
  const initial = await postJson('https://modelslab.com/api/v6/images/text2img', {
    key: API_KEY,
    width: 768,
    height: 1024,
    samples: 1,
    safety_checker: 'no',
    seed,
    ...request,
  });

  const result = await pollResult(initial, `${modelKey}/${promptKey}/seed${seed}`);
  const url = resolveOutputUrl(result);
  if (!url) throw new Error('No output URL');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';

  return {
    url,
    bytes,
    ext,
    black: isMostlyBlack(bytes),
    nsfw: Boolean(result.nsfw_content_detected),
    generationTime: result.generationTime ?? null,
    prompt: request.prompt,
  };
};

await fsPromises.mkdir(OUT_DIR, { recursive: true });

const report = {
  ranAt: new Date().toISOString(),
  purpose: 'pre_switch_portrait_model',
  models: MODELS,
  prompts: PROMPT_KEYS,
  seeds: SEEDS,
  results: [],
  summary: {},
};

const totalJobs = MODELS.length * PROMPT_KEYS.length * SEEDS.length;
let jobIndex = 0;

console.log('\nPortrait switch bake-off');
console.log('Models:', MODELS.map((m) => m.key).join(', '));
console.log('Prompts:', PROMPT_KEYS.join(', '));
console.log('Seeds:', SEEDS.join(', '));
console.log('Jobs:', totalJobs);
console.log('Output:', OUT_DIR);
console.log('');

for (const model of MODELS) {
  const modelSummary = {
    modelKey: model.key,
    modelId: model.modelId,
    ok: 0,
    black: 0,
    nsfw: 0,
    failed: 0,
    attempts: [],
  };

  for (const promptKey of PROMPT_KEYS) {
    for (const seed of SEEDS) {
      jobIndex += 1;
      const label = `${model.key} / ${promptKey} / seed ${seed}`;
      process.stdout.write(`[${jobIndex}/${totalJobs}] ${label} ... `);

      try {
        const generated = await generateOne({
          modelKey: model.key,
          modelId: model.modelId,
          promptKey,
          seed,
        });

        const fileName = `${safeFileName(model.key)}_${promptKey}_seed${seed}.${generated.ext}`;
        const filePath = path.join(OUT_DIR, fileName);
        await fsPromises.writeFile(filePath, generated.bytes);

        modelSummary.ok += 1;
        if (generated.black) modelSummary.black += 1;
        if (generated.nsfw) modelSummary.nsfw += 1;

        const attempt = {
          ok: true,
          promptKey,
          seed,
          black: generated.black,
          nsfw: generated.nsfw,
          bytes: generated.bytes.byteLength,
          file: path.relative(ROOT, filePath),
          url: generated.url,
          generationTime: generated.generationTime,
        };
        modelSummary.attempts.push(attempt);
        report.results.push({ modelKey: model.key, modelId: model.modelId, ...attempt });

        const status = generated.black ? 'BLACK' : generated.nsfw ? 'NSFW' : 'OK';
        console.log(`${status} → ${fileName}`);
      } catch (error) {
        modelSummary.failed += 1;
        const attempt = {
          ok: false,
          promptKey,
          seed,
          error: error instanceof Error ? error.message : String(error),
        };
        modelSummary.attempts.push(attempt);
        report.results.push({ modelKey: model.key, modelId: model.modelId, ...attempt });
        console.log(`FAIL — ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  report.summary[model.key] = modelSummary;
}

const reportPath = path.join(OUT_DIR, 'report.json');
await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log('\n=== SAFETY SUMMARY ===\n');
console.log('Model'.padEnd(28), 'OK', 'Black', 'NSFW', 'Fail');
console.log('-'.repeat(56));
for (const model of MODELS) {
  const row = report.summary[model.key];
  console.log(
    model.key.padEnd(28),
    String(row.ok).padStart(2),
    String(row.black).padStart(5),
    String(row.nsfw).padStart(4),
    String(row.failed).padStart(4),
  );
}

console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
console.log('Run fingerprint analysis: npm run phase0:portrait-switch-fingerprint\n');