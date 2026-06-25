import { env } from '@/lib/env';

const MODELSLAB_V6_BASE = 'https://modelslab.com/api/v6';
const MODELSLAB_V7_BASE = 'https://modelslab.com/api/v7/images';

export type ModelsLabApiResponse = {
  status: 'success' | 'processing' | 'error';
  output?: string[];
  proxy_links?: string[] | Record<string, string>;
  id?: number;
  message?: string;
  messege?: string;
  eta?: number;
  generationTime?: number;
  meta?: Record<string, unknown>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const assertModelsLabApiKey = () => {
  const key = env.MODELSLAB_API_KEY?.trim();
  if (!key) {
    throw new Error('MODELSLAB_API_KEY is not configured.');
  }
  return key;
};

export const toDataUri = (bytes: Buffer, mimeType: string) =>
  `data:${mimeType || 'image/png'};base64,${bytes.toString('base64')}`;

const resolveOutputUrl = (payload: ModelsLabApiResponse) => {
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

export const postModelsLabJson = async (
  url: string,
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<ModelsLabApiResponse> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: ModelsLabApiResponse;
  try {
    payload = JSON.parse(raw) as ModelsLabApiResponse;
  } catch {
    throw new Error(`${errorLabel}: ${raw.trim().slice(0, 180) || `HTTP ${response.status}`}`);
  }

  if (!response.ok || payload.status === 'error') {
    const message = payload.message ?? payload.messege ?? `HTTP ${response.status}`;
    throw new Error(`${errorLabel}: ${message}`);
  }

  return payload;
};

export const uploadReferenceImageUrl = async (bytes: Buffer, mimeType: string) => {
  const key = assertModelsLabApiKey();
  const payload = await postModelsLabJson(
    `${MODELSLAB_V6_BASE}/base64_to_url`,
    {
      key,
      base64_string: toDataUri(bytes, mimeType),
    },
    'ModelsLab reference upload failed',
  );

  const url = resolveOutputUrl(payload);
  if (!url) {
    throw new Error('ModelsLab reference upload returned no URL.');
  }

  return url;
};

const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_ATTEMPTS = 45;

export const awaitModelsLabImageResult = async (
  initial: ModelsLabApiResponse,
  errorLabel: string,
): Promise<ModelsLabApiResponse> => {
  if (initial.status === 'success') return initial;
  if (initial.status !== 'processing' || initial.id == null) {
    throw new Error(`${errorLabel}: unexpected ModelsLab response status.`);
  }

  const key = assertModelsLabApiKey();
  const requestId = String(initial.id);

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const waitMs = initial.eta && attempt === 0 ? Math.min(initial.eta * 1_000, 5_000) : POLL_INTERVAL_MS;
    await sleep(waitMs);

    const polled = await postModelsLabJson(
      `${MODELSLAB_V6_BASE}/images/fetch`,
      { key, request_id: requestId },
      errorLabel,
    );

    if (polled.status === 'success') return polled;
    if (polled.status === 'error') {
      throw new Error(`${errorLabel}: ${polled.message ?? polled.messege ?? 'poll failed'}`);
    }
  }

  throw new Error(`${errorLabel}: timed out waiting for ModelsLab image generation.`);
};

export const downloadModelsLabImage = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ModelsLab image download failed (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') ?? 'image/png',
  };
};

export const callModelsLabV6Images = async (
  path: string,
  body: Record<string, unknown>,
  errorLabel: string,
) => {
  const key = assertModelsLabApiKey();
  const initial = await postModelsLabJson(`${MODELSLAB_V6_BASE}/images/${path}`, { key, ...body }, errorLabel);
  return awaitModelsLabImageResult(initial, errorLabel);
};

export const callModelsLabV7ImageToImage = async (body: Record<string, unknown>, errorLabel: string) => {
  const key = assertModelsLabApiKey();
  const initial = await postModelsLabJson(`${MODELSLAB_V7_BASE}/image-to-image`, { key, ...body }, errorLabel);
  return awaitModelsLabImageResult(initial, errorLabel);
};