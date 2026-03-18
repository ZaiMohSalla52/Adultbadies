/*
 * REGENERATE SURFACE — seed-faithful regeneration.
 * Must preserve visual identity from original canonical.
 * More conservative than canonical.
 * Reads from stored seedPrompt context when available.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolvePhysicalTraitLine } from '../primitives/physical';
import { resolveSubject } from '../primitives/subject';
import { PROMPT_VERSION } from '../versions';

export interface RegeneratePromptInput {
  sex: string;
  age: number;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  identityAnchors?: string[];
  seedPromptHint?: string;
}

export const buildRegeneratePrompt = (input: RegeneratePromptInput): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityAnchors ? `${identityAnchors}.` : null,
    getCompositionAnchor('regenerate'),
    buildAllNegatives(),
  ]
    .filter(Boolean)
    .join(' ');
};

export const regeneratePromptVersion: string = PROMPT_VERSION.regenerate;
