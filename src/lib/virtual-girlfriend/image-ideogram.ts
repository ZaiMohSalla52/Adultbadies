import { env } from '@/lib/env';
import { buildPreviewNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';

export type IdeogramGeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  revisedPrompt: string | null;
  provider: 'ideogram';
  model: string;
  endpoint: string;
  requestId: string | null;
  jobId: string | null;
};

const IDEOGRAM_BASE_URL = env.IDEOGRAM_BASE_URL ?? 'https://api.ideogram.ai';
const IDEOGRAM_MODEL = 'V_3';
const IDEOGRAM_GENERATE_ENDPOINT = '/v1/ideogram-v3/generate';
const IDEOGRAM_REFERENCE_ENDPOINT = '/v1/ideogram-v3/remix';

const assertApiKey = () => {
  if (!env.IDEOGRAM_API_KEY) {
    throw new Error('IDEOGRAM_API_KEY is not configured.');
  }

  return env.IDEOGRAM_API_KEY;
};

const fetchIdeogram = async (endpoint: string, body: Record<string, unknown>, errorLabel: string) => {
  const response = await fetch(`${IDEOGRAM_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': assertApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${errorLabel} (${response.status}): ${await response.text()}`);
  }

  return response;
};

const extractGeneratedImage = async (response: Response, endpoint: string): Promise<IdeogramGeneratedImage> => {
  const payload = (await response.json()) as {
    data?: Array<{
      url?: string;
      image_url?: string;
      width?: number;
      height?: number;
      revised_prompt?: string;
      prompt?: string;
      id?: string;
      job_id?: string;
      request_id?: string;
    }>;
    id?: string;
    job_id?: string;
    request_id?: string;
  };

  const generated = payload.data?.[0];
  const temporaryUrl = generated?.url ?? generated?.image_url;
  if (!temporaryUrl) {
    throw new Error('Ideogram image generation returned no temporary image URL.');
  }

  const imageResponse = await fetch(temporaryUrl);
  if (!imageResponse.ok) {
    throw new Error(`Ideogram temporary image download failed (${imageResponse.status}).`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();

  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: imageResponse.headers.get('content-type') ?? 'image/png',
    width: generated?.width ?? null,
    height: generated?.height ?? null,
    revisedPrompt: generated?.revised_prompt ?? generated?.prompt ?? null,
    provider: 'ideogram',
    model: IDEOGRAM_MODEL,
    endpoint,
    requestId: generated?.request_id ?? payload.request_id ?? null,
    jobId: generated?.job_id ?? generated?.id ?? payload.job_id ?? payload.id ?? null,
  };
};

export const generateCanonicalImageWithIdeogram = async (prompt: string): Promise<IdeogramGeneratedImage> => {
  const canonicalParams = SURFACE_PARAMS.canonical;

  const response = await fetchIdeogram(
    IDEOGRAM_GENERATE_ENDPOINT,
    {
      prompt,
      aspect_ratio: canonicalParams.aspect_ratio,
      model: IDEOGRAM_MODEL,
      num_images: canonicalParams.num_images,
      magic_prompt_option: canonicalParams.magic_prompt_option,
      style_type: canonicalParams.style_type,
      rendering_speed: canonicalParams.rendering_speed,
    },
    'Ideogram image generation failed',
  );

  return extractGeneratedImage(response, IDEOGRAM_GENERATE_ENDPOINT);
};

export const generatePortraitPreviewImageWithIdeogram = async (prompt: string, seed?: number): Promise<IdeogramGeneratedImage> => {
  const previewParams = SURFACE_PARAMS.preview;

  const response = await fetchIdeogram(
    IDEOGRAM_GENERATE_ENDPOINT,
    {
      prompt,
      negative_prompt: buildPreviewNegativePrompt(),
      ...(seed !== undefined ? { seed } : {}),
      aspect_ratio: previewParams.aspect_ratio,
      model: IDEOGRAM_MODEL,
      num_images: previewParams.num_images,
      magic_prompt_option: previewParams.magic_prompt_option,
      style_type: previewParams.style_type,
      rendering_speed: previewParams.rendering_speed,
    },
    'Ideogram portrait preview generation failed',
  );

  return extractGeneratedImage(response, IDEOGRAM_GENERATE_ENDPOINT);
};

const generateReferenceImageWithIdeogram = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  surface: 'canonical' | 'gallery' | 'chat';
  imageWeight: number;
  errorLabel: string;
}): Promise<IdeogramGeneratedImage> => {
  const surfaceParams = SURFACE_PARAMS[input.surface];

  const response = await fetchIdeogram(
    IDEOGRAM_REFERENCE_ENDPOINT,
    {
      prompt: input.prompt,
      model: IDEOGRAM_MODEL,
      num_images: surfaceParams.num_images,
      aspect_ratio: surfaceParams.aspect_ratio,
      magic_prompt_option: surfaceParams.magic_prompt_option,
      style_type: surfaceParams.style_type,
      rendering_speed: surfaceParams.rendering_speed,
      image_data: input.referenceImageBytes.toString('base64'),
      image_mime_type: input.referenceMimeType,
      image_weight: input.imageWeight,
    },
    input.errorLabel,
  );

  return extractGeneratedImage(response, IDEOGRAM_REFERENCE_ENDPOINT);
};

export const generateCanonicalImageFromReferenceWithIdeogram = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  imageWeight?: number;
}): Promise<IdeogramGeneratedImage> =>
  generateReferenceImageWithIdeogram({
    ...input,
    surface: 'canonical',
    imageWeight: input.imageWeight ?? 92,
    errorLabel: 'Ideogram canonical generation with selected portrait reference failed',
  });

export const generateGalleryImageFromReferenceWithIdeogram = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<IdeogramGeneratedImage> =>
  generateReferenceImageWithIdeogram({
    ...input,
    surface: 'gallery',
    imageWeight: 85,
    errorLabel: 'Ideogram reference gallery generation failed',
  });

export const generateChatImageFromReferenceWithIdeogram = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<IdeogramGeneratedImage> =>
  generateReferenceImageWithIdeogram({
    ...input,
    surface: 'chat',
    imageWeight: 85,
    errorLabel: 'Ideogram reference chat generation failed',
  });
