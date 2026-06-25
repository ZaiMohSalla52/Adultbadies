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
} from '@/lib/virtual-girlfriend/image-modelslab';

export type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Image provider facade.
 *
 * Routes to ModelsLab (default when MODELSLAB_API_KEY is set) or fal.ai Flux.
 * Canonical identity lock uses Flux Kontext pro on both providers via reference
 * image (init_image). No silent cross-provider fallback.
 */

const useModelsLabImages = () => resolveVgImageProvider() === 'modelslab';

export const generateCanonicalImage = (prompt: string): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generateCanonicalImageWithModelsLab(prompt)
    : generateCanonicalImageWithFlux(prompt);

export const generatePortraitPreviewImage = (prompt: string, seed?: number): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generatePortraitPreviewImageWithModelsLab(prompt, seed)
    : generatePortraitPreviewImageWithFlux(prompt, seed);

export const generatePreviewWithCharacterReference = (
  prompt: string,
  referenceImageBytes: Buffer,
  referenceMimeType: string,
  seed?: number,
): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generatePreviewWithCharacterReferenceModelsLab(prompt, referenceImageBytes, referenceMimeType, seed)
    : generatePreviewWithCharacterReferenceFlux(prompt, referenceImageBytes, referenceMimeType, seed);

export const generateCanonicalImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  imageWeight?: number;
}): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generateCanonicalImageFromReferenceWithModelsLab(input)
    : generateCanonicalImageFromReferenceWithFlux(input);

export const generateGalleryImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generateGalleryImageFromReferenceWithModelsLab(input)
    : generateGalleryImageFromReferenceWithFlux(input);

export const generateChatImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
}): Promise<GeneratedImage> =>
  useModelsLabImages()
    ? generateChatImageFromReferenceWithModelsLab(input)
    : generateChatImageFromReferenceWithFlux(input);