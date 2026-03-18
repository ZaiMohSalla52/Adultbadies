/*
 * PREVIEW SURFACE — intentionally strict and composition-conservative.
 * Rules:
 * - No UI/mockup/editorial/presentation/device language
 * - No contradictory subject constraints
 * - Positive composition anchor must come first
 * - Hard negatives must come last
 * - Variation comes from expression only
 */

import { getCompositionAnchor, getPreviewExpression } from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolvePhysicalTraitLine } from '../primitives/physical';
import { resolveSubjectStrict } from '../primitives/subject';
import { PROMPT_VERSION } from '../versions';

export interface PreviewPromptInput {
  sex: string;
  age: number;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
}

export const buildPreviewPrompt = (input: PreviewPromptInput, variantIndex: number): string =>
  [
    `${resolveSubjectStrict(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    getCompositionAnchor('preview'),
    getPreviewExpression(variantIndex),
    buildAllNegatives(),
  ].join(' ');

export const previewPromptVersion: string = PROMPT_VERSION.preview;
