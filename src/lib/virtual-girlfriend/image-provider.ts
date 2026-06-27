import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import {
  generateCanonicalImageWithFlux,
  generatePortraitPreviewImageWithFlux,
  generateGalleryImageFromReferenceWithFlux,
  generateChatImageFromReferenceWithFlux,
} from '@/lib/virtual-girlfriend/image-flux';
import {
  generateCanonicalImageWithModelsLab,
  generatePortraitPreviewImageWithModelsLab,
  generateGalleryImageFromReferenceWithModelsLab,
  generateChatImageFromReferenceWithModelsLab,
  generateChatImageWithModelsLabFaceGen,
} from '@/lib/virtual-girlfriend/image-modelslab';
import {
  generateCanonicalImageWithTogether,
  generateGalleryImageFromReferenceWithTogether,
  generatePortraitPreviewImageWithTogether,
} from '@/lib/virtual-girlfriend/image-together';
import {
  isTogetherGalleryEnabled,
  isTogetherPortraitEnabled,
} from '@/lib/virtual-girlfriend/together-image-config';
import { generateExplicitChatImageWithModelsLabFaceSwap } from '@/lib/virtual-girlfriend/image-faceswap';
import { generateExplicitChatImageWithModelsLabSdxl } from '@/lib/virtual-girlfriend/image-sdxl';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Hybrid image provider facade.
 *
 * Portrait → Together FLUX.2-max (ModelsLab flux-2-pro fallback)
 * Gallery  → Together FLUX.1-kontext-max (ModelsLab kontext-pro fallback)
 * Explicit chat → ModelsLab Face Gen / face swap (unchanged)
 * Passive chat  → ModelsLab Kontext
 */

const hasModelsLabKey = () => Boolean(process.env.MODELSLAB_API_KEY?.trim());

const withModelsLabPortraitFallback = async (
  runTogether: () => Promise<GeneratedImage>,
  runModelsLab: () => Promise<GeneratedImage>,
  label: string,
): Promise<GeneratedImage> => {
  try {
    return await runTogether();
  } catch (error) {
    if (!hasModelsLabKey()) throw error;
    console.warn(`[virtual-girlfriend][image-provider] ${label} Together failed; ModelsLab fallback`, {
      reason: error instanceof Error ? error.message : String(error),
    });
    return runModelsLab();
  }
};

export const generateCanonicalImage = async (prompt: string): Promise<GeneratedImage> => {
  if (isTogetherPortraitEnabled()) {
    return withModelsLabPortraitFallback(
      () => generateCanonicalImageWithTogether(prompt),
      () => generateCanonicalImageWithModelsLab(prompt),
      'canonical',
    );
  }
  if (hasModelsLabKey() || resolveVgImageProvider() === 'modelslab') {
    return generateCanonicalImageWithModelsLab(prompt);
  }
  return generateCanonicalImageWithFlux(prompt);
};

export const generatePortraitPreviewImage = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => {
  if (isTogetherPortraitEnabled()) {
    return withModelsLabPortraitFallback(
      () => generatePortraitPreviewImageWithTogether(prompt, seed),
      () => generatePortraitPreviewImageWithModelsLab(prompt, seed),
      'portrait_preview',
    );
  }
  if (hasModelsLabKey() || resolveVgImageProvider() === 'modelslab') {
    return generatePortraitPreviewImageWithModelsLab(prompt, seed);
  }
  return generatePortraitPreviewImageWithFlux(prompt, seed);
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
    try {
      return await generateGalleryImageFromReferenceWithTogether(input);
    } catch (error) {
      if (!hasModelsLabKey()) throw error;
      console.warn('[virtual-girlfriend][image-provider] gallery Together failed; ModelsLab fallback', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return generateGalleryImageFromReferenceWithModelsLab(input);
    }
  }
  if (hasModelsLabKey() || resolveVgImageProvider() === 'modelslab') {
    return generateGalleryImageFromReferenceWithModelsLab(input);
  }
  return generateGalleryImageFromReferenceWithFlux(input);
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