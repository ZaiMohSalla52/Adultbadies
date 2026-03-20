/*
 * CANONICAL SURFACE — identity-locked portrait.
 * Richer than preview. Derives from identity_pack.
 * This prompt becomes seed for all future regenerations.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolveEthnicityNegative, resolvePhysicalTraitLine } from '../primitives/physical';
import { resolveSubject } from '../primitives/subject';
import { PROMPT_VERSION } from '../versions';

export interface CanonicalPromptInput {
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
  identityInvariants?: string[];
  coreLook?: string[];
  wardrobeDirection?: string;
  lightingMood?: string;
  cameraPreferences?: string[];
  realismLevel?: string;
  negativeConstraints?: string[];
}

export const buildCanonicalPrompt = (input: CanonicalPromptInput): string => {
  const identityInvariants = input.identityInvariants?.filter(Boolean).join(', ');
  const coreLook = input.coreLook?.filter(Boolean).join(', ');
  const cameraPrefs = input.cameraPreferences?.filter(Boolean).join(', ');
  const negConstraints = input.negativeConstraints?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    input.occupation ? `Occupation: ${input.occupation}.` : null,
    identityInvariants ? `Identity features: ${identityInvariants}.` : null,
    coreLook ? `Core appearance: ${coreLook}.` : null,
    input.wardrobeDirection ? `Wardrobe: ${input.wardrobeDirection}.` : null,
    input.lightingMood ? `Lighting and mood: ${input.lightingMood}.` : null,
    cameraPrefs ? `Camera: ${cameraPrefs}.` : null,
    input.realismLevel ? `Realism: ${input.realismLevel}.` : null,
    getCompositionAnchor('canonical'),
    'Best quality, ultra realistic, intricate facial details, professional photography, 8k.',
    buildAllNegatives(),
    resolveEthnicityNegative(input.origin) ?? null,
    negConstraints ? `Also avoid: ${negConstraints}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
};

export const canonicalPromptVersion: string = PROMPT_VERSION.canonical;
