import { env } from '@/lib/env';

type IdeogramGeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  revisedPrompt: string | null;
  provider: 'ideogram';
  providerModel: string;
  providerRequestId: string | null;
  providerJobId: string | null;
};

const DEFAULT_IDEOGRAM_BASE_URL = 'https://api.ideogram.ai';

const getIdeogramConfig = () => {
  if (!env.IDEOGRAM_API_KEY) {
    throw new Error('IDEOGRAM_API_KEY is not configured.');
  }

  return {
    apiKey: env.IDEOGRAM_API_KEY,
    baseUrl: env.IDEOGRAM_BASE_URL || DEFAULT_IDEOGRAM_BASE_URL,
    model: env.IDEOGRAM_MODEL || 'V_3',
  };
};

export const generateImageWithIdeogram = async (input: {
  prompt: string;
  referenceImageUrl?: string;
  mode: 'canonical' | 'gallery_from_canonical' | 'chat_from_canonical' | 'legacy_independent';
}): Promise<IdeogramGeneratedImage> => {
  const config = getIdeogramConfig();
  void input;

  // Stage 1 scaffold only: provider wiring + typed contract.
  // Full request/response mapping and reference-driven generation will be implemented in the next stage.
  throw new Error(
    `Ideogram provider adapter scaffold is configured (base=${config.baseUrl}, model=${config.model}) but not enabled for generation in this stage.`,
  );
};
