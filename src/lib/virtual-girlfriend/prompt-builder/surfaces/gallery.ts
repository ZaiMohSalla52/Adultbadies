import type { CompanionTraits } from '../../types/traits';

export interface GalleryPromptInput {
  traits: CompanionTraits;
}

export const GALLERY_PROMPT_VERSION = 'gallery.v1' as const;

export function buildGalleryPrompt(input: GalleryPromptInput): string {
  const { traits } = input;
  return [
    `adult ${traits.sex}`,
    `${traits.age} years old`,
    `${traits.origin} origin`,
    `${traits.hairLength} ${traits.hairColor} hair`,
    `${traits.eyeColor} eyes`,
    `${traits.bodyType} body type`,
  ].join(', ');
}
