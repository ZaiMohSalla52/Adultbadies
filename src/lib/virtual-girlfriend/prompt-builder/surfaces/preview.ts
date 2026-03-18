/*
 * PREVIEW SURFACE — intentionally strict and composition-conservative.
 * Rules:
 * - No UI/mockup/editorial/presentation/device language
 * - No contradictory subject constraints
 * - Positive composition anchor must come first
 * - Hard negatives must come last
 */

import {
  getCompositionAnchor,
  getPreviewExpression,
  getPreviewFramingVariant,
  getPreviewLightingVariant,
} from '../primitives/composition';
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
  skinTone?: string;
  styleVibe?: string;
  personality?: string;
}

function resolveStyleCue(styleVibe?: string, personality?: string): string {
  const parts: string[] = [];

  if (styleVibe && styleVibe !== 'random') {
    const styleMap: Record<string, string> = {
      casual: 'casual everyday style',
      elegant: 'elegant polished appearance',
      edgy: 'edgy streetwear style',
      bohemian: 'relaxed bohemian style',
      sporty: 'athletic sporty look',
      professional: 'professional composed appearance',
    };
    const mapped = styleMap[styleVibe.toLowerCase()];
    if (mapped) parts.push(mapped);
  }

  if (personality && personality !== 'random') {
    const personalityMap: Record<string, string> = {
      warm_romantic: 'warm approachable energy',
      playful_tease: 'playful confident energy',
      confident_bold: 'bold confident presence',
      intellectual: 'calm intelligent presence',
      sweet_caring: 'gentle caring expression',
      sarcastic_witty: 'sharp witty expression',
      mysterious: 'mysterious intense gaze',
      bubbly_energetic: 'bright energetic presence',
    };
    const mapped = personalityMap[personality.toLowerCase()];
    if (mapped) parts.push(mapped);
  }

  return parts.length > 0 ? `${parts.join(', ')}.` : '';
}

export const buildPreviewPrompt = (input: PreviewPromptInput, variantIndex: number): string => {
  const styleCue = resolveStyleCue(input.styleVibe, input.personality);

  const parts = [
    `${resolveSubjectStrict(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    getPreviewFramingVariant(variantIndex),
    getCompositionAnchor('preview'),
    getPreviewLightingVariant(variantIndex),
    getPreviewExpression(variantIndex),
  ];

  if (styleCue) parts.push(styleCue);

  parts.push(buildAllNegatives());

  return parts.join(' ');
};

export const previewPromptVersion: string = PROMPT_VERSION.preview;
