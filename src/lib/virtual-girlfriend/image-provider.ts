import { env } from '@/lib/env';
import type { GeneratedImage, ImageProviderName } from '@/lib/virtual-girlfriend/image-types';
import {
  generateCanonicalImageWithIdeogram,
  generatePortraitPreviewImageWithIdeogram,
  generatePreviewWithCharacterReference as generatePreviewWithCharacterReferenceIdeogram,
  generateCanonicalImageFromReferenceWithIdeogram,
  generateGalleryImageFromReferenceWithIdeogram,
  generateChatImageFromReferenceWithIdeogram,
} from '@/lib/virtual-girlfriend/image-ideogram';
import {
  generateCanonicalImageWithFlux,
  generatePortraitPreviewImageWithFlux,
  generatePreviewWithCharacterReferenceFlux,
  generateCanonicalImageFromReferenceWithFlux,
  generateGalleryImageFromReferenceWithFlux,
  generateChatImageFromReferenceWithFlux,
} from '@/lib/virtual-girlfriend/image-flux';

export type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * Single switch point for the image provider.
 *
 * IMAGE_PROVIDER=ideogram (default) keeps the existing Ideogram V3 pipeline.
 * IMAGE_PROVIDER=fal routes every surface to Flux (base) + Flux Kontext
 * (reference / identity-lock) via fal.ai.
 *
 * Every function below preserves the exact prompt (including the SFW negatives
 * baked into the prompt builders) and provider-default safety behavior. This
 * layer changes *which model renders*, not what is allowed to be rendered.
 */
export const getImageProvider = (): ImageProviderName =>
  env.IMAGE_PROVIDER?.toLowerCase() === 'fal' ? 'flux' : 'ideogram';

const usingFlux = () => getImageProvider() === 'flux';

export const generateCanonicalImage = (prompt: string): Promise<GeneratedImage> =>
  usingFlux() ? generateCanonicalImageWithFlux(prompt) : generateCanonicalImageWithIdeogram(prompt);

export const generatePortraitPreviewImage = (prompt: string, seed?: number): Promise<GeneratedImage> =>
  usingFlux()
    ? generatePortraitPreviewImageWithFlux(prompt, seed)
    : generatePortraitPreviewImageWithIdeogram(prompt, seed);

export const generatePreviewWithCharacterReference = (
  prompt: string,
  referenceImageBytes: Buffer,
  referenceMimeType: string,
  seed?: number,
): Promise<GeneratedImage> =>
  usingFlux()
    ? generatePreviewWithCharacterReferenceFlux(prompt, referenceImageBytes, referenceMimeType, seed)
    : generatePreviewWithCharacterReferenceIdeogram(prompt, referenceImageBytes, referenceMimeType, seed);

export const generateCanonicalImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  imageWeight?: number;
}): Promise<GeneratedImage> =>
  usingFlux()
    ? generateCanonicalImageFromReferenceWithFlux(input)
    : generateCanonicalImageFromReferenceWithIdeogram(input);

export const generateGalleryImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  usingFlux()
    ? generateGalleryImageFromReferenceWithFlux(input)
    : generateGalleryImageFromReferenceWithIdeogram(input);

export const generateChatImageFromReference = (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  usingFlux()
    ? generateChatImageFromReferenceWithFlux(input)
    : generateChatImageFromReferenceWithIdeogram(input);
