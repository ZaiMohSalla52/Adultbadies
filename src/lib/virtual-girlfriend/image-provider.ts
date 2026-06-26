import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import { resolveModelsLabPortraitModel } from '@/lib/virtual-girlfriend/modelslab-image-config';
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
import { generateExplicitChatImageWithModelsLabSdxl } from '@/lib/virtual-girlfriend/image-sdxl';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Image provider facade — ModelsLab-first (Phase 1).
 *
 * Portrait text2img → Aurelium. Canonical from setup portrait → direct persist
 * (image-machine). Gallery → Kontext Pro. Explicit chat → SDXL / Face Gen.
 *
 * fal.ai Flux remains an emergency fallback when VG_IMAGE_PROVIDER=flux.
 */

const isModelsLabImageProvider = () => resolveVgImageProvider() === 'modelslab';

export const generateCanonicalImage = (prompt: string): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generateCanonicalImageWithModelsLab(prompt)
    : generateCanonicalImageWithFlux(prompt);

export const generatePortraitPreviewImage = (prompt: string, seed?: number): Promise<GeneratedImage> =>
  isModelsLabImageProvider()
    ? generatePortraitPreviewImageWithModelsLab(prompt, seed)
    : generatePortraitPreviewImageWithFlux(prompt, seed);

export type PortraitReferenceImage =
  | { bytes: Buffer; mimeType: string }
  | { url: string };

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
  if (!isModelsLabImageProvider()) {
    throw new Error('SDXL explicit chat images require ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateExplicitChatImageWithModelsLabSdxl(input);
};

/** @deprecated Use generateChatImageFromReferenceFaceGen */
export const generateExplicitChatImageFromReference = generateChatImageFromReferenceFaceGen;