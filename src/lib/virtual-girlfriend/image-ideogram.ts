import { env } from '@/lib/env';

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
  const response = await fetchIdeogram(
    IDEOGRAM_GENERATE_ENDPOINT,
    {
      prompt,
      aspect_ratio: '1x1',
      model: IDEOGRAM_MODEL,
      num_images: 1,
      magic_prompt_option: 'AUTO',
      style_type: 'AUTO',
      rendering_speed: 'DEFAULT',
    },
    'Ideogram image generation failed',
  );

  return extractGeneratedImage(response, IDEOGRAM_GENERATE_ENDPOINT);
};

export const generateGalleryImageFromReferenceWithIdeogram = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<IdeogramGeneratedImage> => {
  const response = await fetchIdeogram(
    IDEOGRAM_REFERENCE_ENDPOINT,
    {
      prompt: input.prompt,
      model: IDEOGRAM_MODEL,
      num_images: 1,
      aspect_ratio: '1x1',
      magic_prompt_option: 'AUTO',
      style_type: 'AUTO',
      rendering_speed: 'DEFAULT',
      image_data: input.referenceImageBytes.toString('base64'),
      image_mime_type: input.referenceMimeType,
      image_weight: 85,
    },
    'Ideogram reference gallery generation failed',
  );

  return extractGeneratedImage(response, IDEOGRAM_REFERENCE_ENDPOINT);
};


export const generateImageWithIdeogram = async (input: {
  prompt: string;
  referenceImageUrl?: string;
  mode?: 'canonical' | 'gallery_from_canonical' | 'chat_from_canonical' | 'legacy_independent';
}) => {
  const shouldUseReference =
    (input.mode === 'gallery_from_canonical' || input.mode === 'chat_from_canonical') && Boolean(input.referenceImageUrl);

  const generated = shouldUseReference
    ? await (async () => {
        const referenceResponse = await fetch(input.referenceImageUrl as string);
        if (!referenceResponse.ok) {
          throw new Error(`Ideogram reference image download failed (${referenceResponse.status}).`);
        }

        const referenceArrayBuffer = await referenceResponse.arrayBuffer();
        return generateGalleryImageFromReferenceWithIdeogram({
          prompt: input.prompt,
          referenceImageBytes: Buffer.from(referenceArrayBuffer),
          referenceMimeType: referenceResponse.headers.get('content-type') ?? 'image/png',
        });
      })()
    : await generateCanonicalImageWithIdeogram(input.prompt);

  return {
    ...generated,
    providerModel: generated.model,
    providerRequestId: generated.requestId,
    providerJobId: generated.jobId,
  };
};
