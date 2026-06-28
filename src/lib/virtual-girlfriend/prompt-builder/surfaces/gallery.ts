/*
 * GALLERY SURFACE — canonical-derived scene variants.
 * More expressive than canonical.
 * Must remain identity-anchored.
 */

import { appendAureliumGalleryQuality } from '@/lib/virtual-girlfriend/modelslab-aurelium-template';
import { EXPOSURE_LIGHTING_TAIL, getCompositionAnchor, PHOTO_REALISM_TAIL } from '../primitives/composition';
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
  breastSize?: string;
  occupation?: string;
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

  const sceneDirective = input.sceneHint?.trim()
    ? `Restyle this exact person for a brand-new gallery photo: ${input.sceneHint}. Change wardrobe, pose, camera angle, and setting to match — even if the reference portrait shows different clothing or location. Gallery variant ${variantIndex + 1} must look visibly different from the profile portrait. Keep the same face and identity lock.`
    : `Gallery variant ${variantIndex + 1}. Vary scene, angle, and outfit while preserving identity.`;

  const base = [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    input.occupation ? `Occupation: ${input.occupation}.` : null,
    identityAnchors ? `Identity anchors: ${identityAnchors}.` : null,
    coreLook ? `Core appearance: ${coreLook}.` : null,
    sceneDirective,
    getCompositionAnchor('gallery'),
    PHOTO_REALISM_TAIL,
    EXPOSURE_LIGHTING_TAIL,
    buildAllNegatives(),
    resolveEthnicityNegative(input.origin) ?? null,
    negConstraints ? `Also avoid: ${negConstraints}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return appendAureliumGalleryQuality(base);
};

export const galleryPromptVersion: string = PROMPT_VERSION.gallery;
