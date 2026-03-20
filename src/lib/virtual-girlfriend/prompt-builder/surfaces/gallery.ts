/*
 * GALLERY SURFACE — canonical-derived scene variants.
 * More expressive than canonical.
 * Must remain identity-anchored.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolveEthnicityNegative, resolvePhysicalTraitLine } from '../primitives/physical';
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
  coreLook?: string[];
  wardrobeDirection?: string;
  lightingMood?: string;
  cameraPreferences?: string[];
  realismLevel?: string;
  negativeConstraints?: string[];
  sceneHint?: string;
}

export const buildGalleryPrompt = (input: GalleryPromptInput, variantIndex: number): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');
  const coreLook = input.coreLook?.filter(Boolean).join(', ');
  const negConstraints = input.negativeConstraints?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityAnchors ? `Identity anchors: ${identityAnchors}.` : null,
    coreLook ? `Core appearance: ${coreLook}.` : null,
    input.wardrobeDirection ? `Wardrobe: ${input.wardrobeDirection}.` : null,
    input.lightingMood ? `Lighting: ${input.lightingMood}.` : null,
    input.sceneHint ? `Scene: ${input.sceneHint}.` : null,
    `Gallery variant ${variantIndex + 1}. Vary scene, angle, and outfit while preserving identity.`,
    getCompositionAnchor('gallery'),
    'Best quality, ultra realistic, intricate details, professional photography, 8k.',
    buildAllNegatives(),
    resolveEthnicityNegative(input.origin) ?? null,
    negConstraints ? `Also avoid: ${negConstraints}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
};

export const galleryPromptVersion: string = PROMPT_VERSION.gallery;
