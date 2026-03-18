/*
 * CANONICAL SURFACE — identity-locked portrait.
 * Richer than preview. Derives from identity_pack.
 * This prompt becomes seed for all future regenerations.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolvePhysicalTraitLine } from '../primitives/physical';
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
  identityAnchors?: string[];
  identityInvariants?: string[];
}

export const buildCanonicalPrompt = (input: CanonicalPromptInput): string => {
  const identityInvariants = input.identityInvariants?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityInvariants ? `${identityInvariants}.` : null,
    getCompositionAnchor('canonical'),
    buildAllNegatives(),
  ]
    .filter(Boolean)
    .join(' ');
};

export const canonicalPromptVersion: string = PROMPT_VERSION.canonical;
