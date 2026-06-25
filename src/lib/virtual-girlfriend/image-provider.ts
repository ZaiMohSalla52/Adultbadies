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
  generateExplicitChatImageWithModelsLabFaceGen,
} from '@/lib/virtual-girlfriend/image-modelslab';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Image provider facade.
 *
 * Routes to ModelsLab (default when MODELSLAB_API_KEY is set) or fal.ai Flux.
 * Canonical identity lock uses Flux Kontext pro on both providers via reference
 * image (init_image). No silent cross-provider fallback.
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

export const generateExplicitChatImageFromReference = (input: {
  userMessage: string;
  reference: PortraitReferenceImage;
  numInferenceSteps?: number;
}): Promise<GeneratedImage> => {
  if (!isModelsLabImageProvider()) {
    throw new Error('Face Gen explicit chat images require ModelsLab (MODELSLAB_API_KEY).');
  }
  return generateExplicitChatImageWithModelsLabFaceGen(input);
};