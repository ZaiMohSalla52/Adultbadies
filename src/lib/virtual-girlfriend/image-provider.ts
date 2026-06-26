import { env } from '@/lib/env';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import {
  generateCanonicalImageWithFlux,
  generatePortraitPreviewImageWithFlux,
  generatePreviewWithCharacterReferenceFlux,
  generateCanonicalImageFromReferenceWithFlux,
  generateGalleryImageFromReferenceWithFlux,
  generateChatImageFromReferenceWithFlux,
} from '@/lib/virtual-girlfriend/image-flux';
import {
  generateCanonicalImageWithModelsLab,
  generatePortraitPreviewImageWithModelsLab,
  generatePreviewWithCharacterReferenceModelsLab,
  generateCanonicalImageFromReferenceWithModelsLab,
  generateGalleryImageFromReferenceWithModelsLab,
  generateChatImageFromReferenceWithModelsLab,
  generateChatImageWithModelsLabFaceGen,
} from '@/lib/virtual-girlfriend/image-modelslab';
import { generateExplicitChatImageWithModelsLabSdxl } from '@/lib/virtual-girlfriend/image-sdxl';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Image provider facade.
 *
 * Routes to ModelsLab (default when MODELSLAB_API_KEY is set) or fal.ai Flux.
 * Canonical identity lock uses Flux Kontext pro on both providers via reference
 * image (init_image). No silent cross-provider fallback.
 */

const isModelsLabImageProvider = () => resolveVgImageProvider() === 'modelslab';

/** Companion text2img always prefers Flux Pro when fal is configured. */
const useFluxForCompanionSurfaces = () => Boolean(env.FLUX_API_KEY?.trim());

export const generateCanonicalImage = (prompt: string): Promise<GeneratedImage> =>
  useFluxForCompanionSurfaces()
    ? generateCanonicalImageWithFlux(prompt)
    : isModelsLabImageProvider()
      ? generateCanonicalImageWithModelsLab(prompt)
      : generateCanonicalImageWithFlux(prompt);

export const generatePortraitPreviewImage = (prompt: string, seed?: number): Promise<GeneratedImage> =>
  useFluxForCompanionSurfaces()
    ? generatePortraitPreviewImageWithFlux(prompt, seed)
    : isModelsLabImageProvider()
      ? generatePortraitPreviewImageWithModelsLab(prompt, seed)
      : generatePortraitPreviewImageWithFlux(prompt, seed);

export type PortraitReferenceImage =
  | { bytes: Buffer; mimeType: string }
  | { url: string };

export const generatePreviewWithCharacterReference = (
  prompt: string,
  reference: PortraitReferenceImage,
  seed?: number,
): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generatePreviewWithCharacterReferenceModelsLab(prompt, reference, seed)
    : generatePreviewWithCharacterReferenceFlux(prompt, reference, seed);

export const generateCanonicalImageFromReference = (input: {
  prompt: string;
  reference: PortraitReferenceImage;
  imageWeight?: number;
}): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generateCanonicalImageFromReferenceWithModelsLab(input)
    : generateCanonicalImageFromReferenceWithFlux(input);

export const generateGalleryImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generateGalleryImageFromReferenceWithModelsLab(input)
    : generateGalleryImageFromReferenceWithFlux(input);

export const generateChatImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
}): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generateChatImageFromReferenceWithModelsLab(input)
    : generateChatImageFromReferenceWithFlux(input);

export const generateChatImageFromReferenceFaceGen = (input: {
  userMessage: string;
  reference: PortraitReferenceImage;
  wardrobeContext?: import('@/lib/virtual-girlfriend/companion-wardrobe').WardrobeContext;
  numInferenceSteps?: number;
}): Promise<GeneratedImage> => {
  if (!isModelsLabImageProvider()) {
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
}): Promise<GeneratedImage> => {
  if (!env.MODELSLAB_API_KEY?.trim()) {
    throw new Error('SDXL explicit chat images require ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateExplicitChatImageWithModelsLabSdxl(input);
};

/** @deprecated Use generateChatImageFromReferenceFaceGen */
export const generateExplicitChatImageFromReference = generateChatImageFromReferenceFaceGen;