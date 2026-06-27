import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import {
  generateCanonicalImageWithFlux,
  generatePortraitPreviewImageWithFlux,
  generateGalleryImageFromReferenceWithFlux,
} from '@/lib/virtual-girlfriend/image-flux';
import {
  generateChatImageFromReferenceWithModelsLab,
  generateChatImageWithModelsLabFaceGen,
} from '@/lib/virtual-girlfriend/image-modelslab';
import {
  generateCanonicalImageWithTogether,
  generateGalleryImageFromReferenceWithTogether,
  generatePortraitPreviewImageWithTogether,
} from '@/lib/virtual-girlfriend/image-together';
import {
  assertTogetherApiKey,
  isTogetherGalleryEnabled,
  isTogetherPortraitEnabled,
} from '@/lib/virtual-girlfriend/together-image-config';
import { generateExplicitChatImageWithModelsLabFaceSwap } from '@/lib/virtual-girlfriend/image-faceswap';
import { generateExplicitChatImageWithModelsLabSdxl } from '@/lib/virtual-girlfriend/image-sdxl';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Hybrid image provider facade.
 *
 * Portrait → Together FLUX.2-max only (no ModelsLab fallback)
 * Gallery  → Together FLUX.1-kontext-max only (no ModelsLab fallback)
 * Explicit chat → ModelsLab Face Gen / face swap (unchanged)
 * Passive chat  → ModelsLab Kontext
 */

const hasModelsLabKey = () => Boolean(process.env.MODELSLAB_API_KEY?.trim());

export const generateCanonicalImage = async (prompt: string): Promise<GeneratedImage> => {
  if (isTogetherPortraitEnabled()) {
    assertTogetherApiKey();
    return generateCanonicalImageWithTogether(prompt);
  }
  if (resolveVgImageProvider() === 'flux') {
    return generateCanonicalImageWithFlux(prompt);
  }
  throw new Error('Portrait generation requires TOGETHER_API_KEY (Together FLUX.2-max).');
};

export const generatePortraitPreviewImage = async (
  prompt: string,
  seed?: number,
  minimalPrompt?: string,
): Promise<GeneratedImage> => {
  if (isTogetherPortraitEnabled()) {
    assertTogetherApiKey();
    return generatePortraitPreviewImageWithTogether(prompt, seed, minimalPrompt);
  }
  if (resolveVgImageProvider() === 'flux') {
    return generatePortraitPreviewImageWithFlux(prompt, seed);
  }
  throw new Error('Portrait generation requires TOGETHER_API_KEY (Together FLUX.2-max).');
};

export type PortraitReferenceImage =
  | { bytes: Buffer; mimeType: string; deliveryUrl?: string }
  | { url: string };

export const generateGalleryImageFromReference = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  referenceImageUrl?: string;
}): Promise<GeneratedImage> => {
  if (isTogetherGalleryEnabled()) {
    assertTogetherApiKey();
    return generateGalleryImageFromReferenceWithTogether(input);
  }
  if (resolveVgImageProvider() === 'flux') {
    return generateGalleryImageFromReferenceWithFlux(input);
  }
  throw new Error('Gallery generation requires TOGETHER_API_KEY (Together FLUX.1-kontext-max).');
};

export const generateChatImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
  explicitHighExposure?: boolean;
}): Promise<GeneratedImage> => {
  if (!hasModelsLabKey()) {
    throw new Error('Chat image generation requires MODELSLAB_API_KEY.');
  }
  return generateChatImageFromReferenceWithModelsLab(input);
};

export const generateChatImageFromReferenceFaceGen = (input: {
  userMessage: string;
  reference: PortraitReferenceImage;
  wardrobeContext?: import('@/lib/virtual-girlfriend/companion-wardrobe').WardrobeContext;
  numInferenceSteps?: number;
  wideFraming?: boolean | 'ultra';
}): Promise<GeneratedImage> => {
  if (!hasModelsLabKey()) {
    throw new Error('Face Gen chat images require ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateChatImageWithModelsLabFaceGen(input);
};

export const generateChatImageFromReferenceSdxl = (input: {
  prompt: string;
  userMessage?: string;
  reference: PortraitReferenceImage;
  numInferenceSteps?: number;
  guidanceScale?: number;
  highExposure?: boolean;
  exposureLevel?: import('@/lib/virtual-girlfriend/explicit-exposure').ExplicitExposureLevel | null;
}): Promise<GeneratedImage> => {
  if (!hasModelsLabKey()) {
    throw new Error('SDXL explicit chat images require ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateExplicitChatImageWithModelsLabSdxl(input);
};

export const generateChatImageFromReferenceFaceSwap = (input: {
  userMessage: string;
  reference: PortraitReferenceImage;
  wardrobeContext?: import('@/lib/virtual-girlfriend/companion-wardrobe').WardrobeContext;
}): Promise<GeneratedImage> => {
  if (!hasModelsLabKey()) {
    throw new Error('Face swap explicit chat requires ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateExplicitChatImageWithModelsLabFaceSwap(input);
};

/** @deprecated Use generateChatImageFromReferenceFaceGen */
export const generateExplicitChatImageFromReference = generateChatImageFromReferenceFaceGen;