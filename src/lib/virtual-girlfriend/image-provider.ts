import { generateImageWithIdeogram } from '@/lib/virtual-girlfriend/image-ideogram';
import { generateImageWithOpenAI } from '@/lib/virtual-girlfriend/image-openai';

export type VirtualGirlfriendImageProvider = 'openai' | 'ideogram';

export type VirtualGirlfriendImageGenerationMode =
  | 'canonical'
  | 'gallery_from_canonical'
  | 'chat_from_canonical'
  | 'legacy_independent';

export type VirtualGirlfriendImageReference = {
  imageId?: string;
  imageUrl?: string;
};

export type VirtualGirlfriendImageGenerationRequest = {
  prompt: string;
  mode: VirtualGirlfriendImageGenerationMode;
  provider?: VirtualGirlfriendImageProvider;
  referenceImage?: VirtualGirlfriendImageReference;
  modelOptions?: Record<string, unknown>;
};

export type VirtualGirlfriendGeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  revisedPrompt: string | null;
  provider: VirtualGirlfriendImageProvider;
  providerModel: string;
  providerRequestId: string | null;
  providerJobId: string | null;
};

export const generateVirtualGirlfriendImage = async (
  input: VirtualGirlfriendImageGenerationRequest,
): Promise<VirtualGirlfriendGeneratedImage> => {
  const provider = input.provider ?? 'openai';

  if (provider === 'ideogram') {
    return generateImageWithIdeogram({
      prompt: input.prompt,
      referenceImageUrl: input.referenceImage?.imageUrl,
      mode: input.mode,
    });
  }

  const generated = await generateImageWithOpenAI(input.prompt);
  return {
    ...generated,
    provider: 'openai',
    providerModel: 'gpt-image-1',
    providerRequestId: null,
    providerJobId: null,
  };
};
