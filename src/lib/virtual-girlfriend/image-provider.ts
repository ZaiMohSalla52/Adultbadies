import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';
import {
  generateCanonicalImageWithFlux,
  generatePortraitPreviewImageWithFlux,
  generatePreviewWithCharacterReferenceFlux,
  generateCanonicalImageFromReferenceWithFlux,
  generateGalleryImageFromReferenceWithFlux,
  generateChatImageFromReferenceWithFlux,
  type KontextGenerationOptions,
} from '@/lib/virtual-girlfriend/image-flux';

export type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * Image provider facade.
 *
 * Flux (fal.ai) is the sole image provider. This thin layer keeps the image
 * machine decoupled from the concrete provider module so a future provider can
 * be swapped in one place. There is intentionally no silent fallback: if
 * FLUX_API_KEY is missing, generation fails loudly rather than degrading.
 */

export const generateCanonicalImage = (prompt: string): Promise<GeneratedImage> =>
  generateCanonicalImageWithFlux(prompt);

export const generatePortraitPreviewImage = (prompt: string, seed?: number): Promise<GeneratedImage> =>
  generatePortraitPreviewImageWithFlux(prompt, seed);

export const generatePreviewWithCharacterReference = (
  prompt: string,
  referenceImageBytes: Buffer,
  referenceMimeType: string,
  seed?: number,
): Promise<GeneratedImage> =>
  generatePreviewWithCharacterReferenceFlux(prompt, referenceImageBytes, referenceMimeType, seed);

export const generateCanonicalImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  imageWeight?: number;
}): Promise<GeneratedImage> => generateCanonicalImageFromReferenceWithFlux(input);

export const generateGalleryImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> => generateGalleryImageFromReferenceWithFlux(input);

export const generateChatImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
}): Promise<GeneratedImage> => generateChatImageFromReferenceWithFlux(input);
