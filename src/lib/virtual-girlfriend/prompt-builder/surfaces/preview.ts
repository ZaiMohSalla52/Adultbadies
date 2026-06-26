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
  getPreviewSceneVariant,
  EXPOSURE_LIGHTING_TAIL,
  PHOTO_REALISM_TAIL,
} from '../primitives/composition';
import { buildAllNegatives } from '../primitives/negatives';
import { resolveEthnicityNegative, resolvePhysicalTraitLine } from '../primitives/physical';
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
  breastSize?: string;
  styleVibe?: string;
  personality?: string;
  occupation?: string;
  freeformDetails?: string;
  faceDnaLine?: string;
  faceDnaInvariantLine?: string;
  negativeOverlapCues?: string[];
}

const OCCUPATION_VISUAL_MAP: Record<string, string> = {
  nurse: 'caring warm presence, light professional clothing',
  doctor: 'confident professional composure',
  teacher: 'approachable intellectual look, smart-casual style',
  lawyer: 'sharp composed professional appearance',
  artist: 'creative free-spirited look, expressive styling',
  musician: 'edgy creative energy, relaxed artistic style',
  model: 'polished editorial confidence, striking presence',
  'fitness trainer': 'athletic toned look, activewear styling',
  chef: 'warm energetic presence, casual style',
  barista: 'laid-back charming look, casual urban style',
  student: 'youthful relaxed energy, casual everyday style',
  influencer: 'stylish trendy look, polished casual style',
  photographer: 'creative cool aesthetic, casual artsy style',
  writer: 'thoughtful bookish warmth, cozy casual style',
  psychologist: 'calm composed presence, smart professional style',
  scientist: 'intelligent focused presence, smart-casual style',
};

function resolveOccupationCue(occupation?: string): string | null {
  if (!occupation) return null;
  const key = occupation.trim().toLowerCase();
  return OCCUPATION_VISUAL_MAP[key] ?? `${occupation.toLowerCase()} professional appearance`;
}

function resolveAppearanceCue(styleVibe?: string, personality?: string, occupation?: string): string {
  const parts: string[] = [];

  const occupationCue = resolveOccupationCue(occupation);
  if (occupationCue) parts.push(occupationCue);

  if (styleVibe && styleVibe !== 'random') {
    const styleMap: Record<string, string> = {
      casual: 'relaxed casual everyday style',
      elegant: 'elegant polished refined look',
      edgy: 'edgy streetwear confident style',
      bohemian: 'relaxed bohemian free-spirited style',
      sporty: 'athletic sporty activewear look',
      professional: 'sharp composed professional appearance',
      glamorous: 'glamorous high-fashion sophisticated look',
      seductive: 'sultry seductive styling with adult glamour energy',
      lingerie: 'lingerie-forward intimate styling, tasteful adult allure',
      athletic: 'athletic thirst-trap physique emphasis, fitted activewear cues',
    };
    const mapped = styleMap[styleVibe.toLowerCase()];
    if (mapped) parts.push(mapped);
  }

  if (personality && personality !== 'random') {
    const personalityMap: Record<string, string> = {
      warm_romantic: 'warm gentle approachable energy, soft inviting eyes',
      playful_tease: 'playful flirtatious confidence, spark in the eyes',
      confident_bold: 'bold fierce magnetic presence, direct gaze',
      intellectual: 'calm sharp intelligent presence, thoughtful expression',
      sweet_caring: 'gentle sweet nurturing expression, kind warm eyes',
      sarcastic_witty: 'sharp wit in her expression, knowing half-smile',
      mysterious: 'mysterious intense smoldering gaze, alluring presence',
      bubbly_energetic: 'bright radiant energetic smile, vibrant presence',
      sultry_seductive: 'smoldering seductive gaze, parted lips, magnetic adult allure',
      dominant_tease: 'commanding confident stare, controlled sensual power',
      submissive_eager: 'soft eager expression, inviting vulnerable warmth',
      wild_uninhibited: 'uninhibited flirtatious energy, raw adult chemistry in the eyes',
    };
    const mapped = personalityMap[personality.toLowerCase()];
    if (mapped) parts.push(mapped);
  }

  return parts.length > 0 ? parts.join(', ') + '.' : '';
}

const formatNegativeOverlapLine = (cues: string[] | undefined): string | null => {
  const unique = Array.from(new Set((cues ?? []).map((cue) => cue.trim()).filter(Boolean))).slice(0, 8);
  if (!unique.length) return null;
  return `Avoid resembling existing companions: ${unique.join('; ')}.`;
};

export const buildPreviewPrompt = (input: PreviewPromptInput, variantIndex: number): string => {
  const appearanceCue = resolveAppearanceCue(input.styleVibe, input.personality, input.occupation);
  const negativeOverlapLine = formatNegativeOverlapLine(input.negativeOverlapCues);

  const parts = [
    `${resolveSubjectStrict(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    input.faceDnaLine?.trim() ? input.faceDnaLine.trim() : null,
    input.faceDnaInvariantLine?.trim() ? input.faceDnaInvariantLine.trim() : null,
    getPreviewFramingVariant(variantIndex),
    getPreviewSceneVariant(variantIndex),
    getCompositionAnchor('preview'),
    getPreviewLightingVariant(variantIndex),
    getPreviewExpression(variantIndex),
  ];

  if (appearanceCue) parts.push(appearanceCue);

  if (input.freeformDetails?.trim()) {
    parts.push(`Additional details: ${input.freeformDetails.trim()}.`);
  }

  parts.push(EXPOSURE_LIGHTING_TAIL);
  parts.push(PHOTO_REALISM_TAIL);

  if (negativeOverlapLine) parts.push(negativeOverlapLine);

  parts.push(buildAllNegatives());
  const ethnicityNegative = resolveEthnicityNegative(input.origin);
  if (ethnicityNegative) parts.push(ethnicityNegative);

  return parts.filter(Boolean).join(' ');
};

export const previewPromptVersion: string = PROMPT_VERSION.preview;
