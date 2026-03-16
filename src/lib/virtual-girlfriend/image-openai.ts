import { env } from '@/lib/env';

type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  revisedPrompt: string | null;
};

const OPENAI_URL = 'https://api.openai.com/v1';

const assertApiKey = () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return env.OPENAI_API_KEY;
};

export const generateImageWithOpenAI = async (prompt: string): Promise<GeneratedImage> => {
  const response = await fetch(`${OPENAI_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${assertApiKey()}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image generation failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };

  const image = payload.data?.[0]?.b64_json;
  if (!image) throw new Error('OpenAI image generation returned no image data.');

  return {
    bytes: Buffer.from(image, 'base64'),
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
    revisedPrompt: payload.data?.[0]?.revised_prompt ?? null,
  };
};
