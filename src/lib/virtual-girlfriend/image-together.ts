import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';
import { softenPreviewPromptForModeration } from '@/lib/virtual-girlfriend/preview-moderation';
import {
  assertTogetherApiKey,
  isTogetherNsfwModerationError,
  resolveTogetherGalleryModel,
  resolveTogetherPortraitFallbackModel,
  resolveTogetherPortraitModel,
} from '@/lib/virtual-girlfriend/together-image-config';

const TOGETHER_IMAGES_URL = 'https://api.together.xyz/v1/images/generations';

const DIMENSIONS_BY_ASPECT: Record<string, { width: number; height: number }> = {
  '1x1': { width: 1024, height: 1024 },
  '3x4': { width: 768, height: 1024 },
  '4x3': { width: 1024, height: 768 },
  '9x16': { width: 576, height: 1024 },
  '16x9': { width: 1024, height: 576 },
};

const KONTEXT_ASPECT_BY_SURFACE: Record<string, string> = {
  '1x1': '1:1',
  '3x4': '3:4',
  '4x3': '4:3',
  '9x16': '9:16',
  '16x9': '16:9',
};

type TogetherImagesResponse = {
  id?: string;
  model?: string;
  data?: Array<{
    url?: string;
    b64_json?: string;
    timings?: { inference?: number };
  }>;
  error?: { message?: string };
  message?: string;
};

const resolveDimensions = (aspectRatio: string) => DIMENSIONS_BY_ASPECT[aspectRatio] ?? DIMENSIONS_BY_ASPECT['3x4']!;
const resolveKontextAspect = (aspectRatio: string) => KONTEXT_ASPECT_BY_SURFACE[aspectRatio] ?? '3:4';

const callTogetherImages = async (
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<TogetherImagesResponse> => {
  const response = await fetch(TOGETHER_IMAGES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${assertTogetherApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(270_000),
  });

  const raw = await response.text();
  let payload: TogetherImagesResponse;
  try {
    payload = JSON.parse(raw) as TogetherImagesResponse;
  } catch {
    throw new Error(`${errorLabel}: ${raw.trim().slice(0, 180) || `HTTP ${response.status}`}`);
  }

  if (!response.ok) {
    const message = payload.error?.message ?? payload.message ?? `HTTP ${response.status}`;
    throw new Error(`${errorLabel}: ${message}`);
  }

  return payload;
};

const downloadTogetherImage = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'adult-badies/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Together image download failed (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength) {
    throw new Error('Together image download returned empty bytes.');
  }

  return {
    bytes,
    mimeType: response.headers.get('content-type') ?? 'image/jpeg',
  };
};

const extractTogetherImage = async (
  payload: TogetherImagesResponse,
  model: string,
  endpoint: string,
  options?: { skipDownload?: boolean; rejectBlankPortrait?: boolean },
): Promise<GeneratedImage> => {
  const item = payload.data?.[0];
  if (!item) {
    throw new Error('Together image generation returned no image data.');
  }

  let bytes = Buffer.alloc(0);
  let mimeType = 'image/jpeg';
  const temporaryUrl: string | null = item.url?.trim() || null;

  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, 'base64');
    mimeType = 'image/jpeg';
  } else if (temporaryUrl && !options?.skipDownload) {
    const downloaded = await downloadTogetherImage(temporaryUrl);
    bytes = downloaded.bytes;
    mimeType = downloaded.mimeType;
  }

  if (
    options?.rejectBlankPortrait
    && !options.skipDownload
    && bytes.byteLength > 0
    && !isUsablePortraitImageBytes(bytes)
  ) {
    throw new Error('Together portrait generation returned a blank or near-black image.');
  }

  return {
    bytes,
    mimeType,
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'together',
    model: payload.model ?? model,
    endpoint,
    requestId: payload.id ?? null,
    jobId: null,
    temporaryUrl,
  };
};

const callTogetherPortrait = async (
  model: string,
  prompt: string,
  surface: 'preview' | 'canonical',
  seed?: number,
): Promise<GeneratedImage> => {
  const params = SURFACE_PARAMS[surface];
  const { width, height } = resolveDimensions(params.aspect_ratio);

  const payload = await callTogetherImages(
    {
      model,
      prompt,
      width,
      height,
      ...(seed !== undefined ? { seed } : {}),
      n: 1,
      response_format: 'url',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    `Together ${surface} generation failed (${model})`,
  );

  return extractTogetherImage(payload, model, '/v1/images/generations', {
    skipDownload: surface === 'preview',
    rejectBlankPortrait: surface !== 'preview',
  });
};

const generateTogetherPortrait = async (
  prompt: string,
  surface: 'preview' | 'canonical',
  seed?: number,
  minimalPrompt?: string,
): Promise<GeneratedImage> => {
  const primaryModel = resolveTogetherPortraitModel();
  const fallbackModel = resolveTogetherPortraitFallbackModel();
  const softenedPrompt = softenPreviewPromptForModeration(prompt);

  const attempts: Array<{ model: string; prompt: string; label: string }> = [
    { model: primaryModel, prompt, label: 'primary' },
  ];

  if (softenedPrompt !== prompt) {
    attempts.push({ model: primaryModel, prompt: softenedPrompt, label: 'softened_primary' });
  }

  if (surface === 'preview' && minimalPrompt && minimalPrompt !== prompt && minimalPrompt !== softenedPrompt) {
    attempts.push({ model: primaryModel, prompt: minimalPrompt, label: 'minimal_fallback' });
  }

  // FLUX.2-pro uses stricter BFL moderation — only try it for non-NSFW failures elsewhere.
  if (surface !== 'preview' && fallbackModel !== primaryModel && softenedPrompt !== prompt) {
    attempts.push({ model: fallbackModel, prompt: softenedPrompt, label: 'softened_fallback' });
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await callTogetherPortrait(attempt.model, attempt.prompt, surface, seed);
    } catch (error) {
      lastError = error;
      if (!isTogetherNsfwModerationError(error)) {
        throw error;
      }
      console.warn('[virtual-girlfriend][image-together] portrait moderation block; trying next attempt', {
        surface,
        attempt: attempt.label,
        model: attempt.model,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Together portrait generation failed after moderation-safe retries.');
};

export const generatePortraitPreviewImageWithTogether = async (
  prompt: string,
  seed?: number,
  minimalPrompt?: string,
): Promise<GeneratedImage> => generateTogetherPortrait(prompt, 'preview', seed, minimalPrompt);

export const generateCanonicalImageWithTogether = async (prompt: string): Promise<GeneratedImage> =>
  generateTogetherPortrait(prompt, 'canonical');

const resolveGalleryReferenceUrl = (input: {
  referenceImageUrl?: string;
}) => {
  const hosted = input.referenceImageUrl?.trim();
  if (hosted && /^https?:\/\//i.test(hosted)) {
    return hosted;
  }

  throw new Error(
    'Together gallery requires a public reference URL (canonical delivery_url). Ensure R2_PUBLIC_BASE_URL is configured.',
  );
};

export const generateGalleryImageFromReferenceWithTogether = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  referenceImageUrl?: string;
}): Promise<GeneratedImage> => {
  const model = resolveTogetherGalleryModel();
  const imageUrl = resolveGalleryReferenceUrl(input);
  const aspectRatio = resolveKontextAspect(SURFACE_PARAMS.gallery.aspect_ratio);

  const payload = await callTogetherImages(
    {
      model,
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      image_url: imageUrl,
      steps: 28,
      n: 1,
      response_format: 'base64',
      output_format: 'jpeg',
      disable_safety_checker: true,
    },
    `Together gallery generation failed (${model})`,
  );

  return extractTogetherImage(payload, model, '/v1/images/generations');
};