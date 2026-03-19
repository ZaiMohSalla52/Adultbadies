/*
 * GALLERY SURFACE — canonical-derived scene variants.
 * More expressive than canonical.
 * Must remain identity-anchored.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolvePhysicalTraitLine } from '../primitives/physical';
import { resolveSubject } from '../primitives/subject';
import { PROMPT_VERSION } from '../versions';

export interface GalleryPromptInput {
  sex: string;
  age: number;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  skinTone?: string;
  identityAnchors?: string[];
  sceneHint?: string;
}

export const buildGalleryPrompt = (input: GalleryPromptInput, variantIndex: number): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityAnchors ? `Identity anchors: ${identityAnchors}.` : null,
    input.sceneHint ? `Scene context: ${input.sceneHint}.` : null,
    `Variant ${variantIndex + 1}.`,
    getCompositionAnchor('gallery'),
    buildAllNegatives(),
  ]
    .filter(Boolean)
    .join(' ');
};

export const galleryPromptVersion: string = PROMPT_VERSION.gallery;
