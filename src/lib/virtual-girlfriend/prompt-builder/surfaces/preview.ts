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
  PREVIEW_EXPRESSIONS,
  PREVIEW_FRAMING_VARIANTS,
  PREVIEW_LIGHTING_VARIANTS,
  PREVIEW_SCENE_VARIANTS,
  EXPOSURE_LIGHTING_TAIL,
  PHOTO_REALISM_TAIL,
} from '../primitives/composition';
import {
  filterModerationSafeVariants,
  isAdultForwardPreviewTraits,
  sanitizePreviewFreeformDetails,
} from '@/lib/virtual-girlfriend/preview-moderation';
import { buildTogetherPreviewNegatives } from '../primitives/negatives';
import { resolveEthnicityNegative, resolvePreviewPhysicalTraitLine } from '../primitives/physical';
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

const STYLE_APPEARANCE_MAP: Record<string, string> = {
  casual: 'relaxed casual everyday style',
  elegant: 'elegant polished refined look',
  edgy: 'edgy streetwear confident style',
  bohemian: 'relaxed bohemian free-spirited style',
  sporty: 'athletic sporty activewear look',
  professional: 'sharp composed professional appearance',
  glamorous: 'glamorous high-fashion sophisticated look',
  seductive: 'polished adult glamour styling, magnetic presence',
  lingerie: 'elegant evening styling with tasteful adult allure',
  athletic: 'athletic confident look, fitted activewear styling',
};

const PERSONALITY_APPEARANCE_MAP: Record<string, string> = {
  warm_romantic: 'warm gentle approachable energy, soft inviting eyes',
  playful_tease: 'playful flirtatious confidence, spark in the eyes',
  confident_bold: 'bold fierce magnetic presence, direct gaze',
  intellectual: 'calm sharp intelligent presence, thoughtful expression',
  sweet_caring: 'gentle sweet nurturing expression, kind warm eyes',
  sarcastic_witty: 'sharp wit in her expression, knowing half-smile',
  mysterious: 'mysterious intense gaze, alluring presence',
  bubbly_energetic: 'bright radiant energetic smile, vibrant presence',
  sultry_seductive: 'confident warm gaze, magnetic adult presence',
  dominant_tease: 'commanding confident stare, controlled adult allure',
  submissive_eager: 'soft eager expression, inviting warm presence',
  wild_uninhibited: 'playful flirtatious energy, bright adult chemistry in the eyes',
};

function resolveAppearanceCue(styleVibe?: string, personality?: string, occupation?: string): string {
  const parts: string[] = [];

  const occupationCue = resolveOccupationCue(occupation);
  if (occupationCue) parts.push(occupationCue);

  const styleMapped =
    styleVibe && styleVibe !== 'random' ? STYLE_APPEARANCE_MAP[styleVibe.toLowerCase()] : null;
  const personalityMapped =
    personality && personality !== 'random'
      ? PERSONALITY_APPEARANCE_MAP[personality.toLowerCase()]
      : null;

  const redundantPersonalityPairs: Record<string, string[]> = {
    seductive: ['sultry_seductive'],
    lingerie: ['sultry_seductive', 'dominant_tease'],
    athletic: ['wild_uninhibited'],
  };
  const skipPersonality =
    styleVibe
    && personality
    && redundantPersonalityPairs[styleVibe.toLowerCase()]?.includes(personality.toLowerCase());

  if (styleMapped) parts.push(styleMapped);
  if (personalityMapped && personalityMapped !== styleMapped && !skipPersonality) {
    parts.push(personalityMapped);
  }

  return parts.length > 0 ? parts.join(', ') + '.' : '';
}

const formatNegativeOverlapLine = (cues: string[] | undefined): string | null => {
  const unique = Array.from(new Set((cues ?? []).map((cue) => cue.trim()).filter(Boolean))).slice(0, 8);
  if (!unique.length) return null;
  return `Avoid resembling existing companions: ${unique.join('; ')}.`;
};

const pickModerationSafeVariant = (variants: readonly string[], variantIndex: number) => {
  const safe = filterModerationSafeVariants(variants);
  const pool = safe.length > 0 ? safe : [...variants];
  return pool[variantIndex % pool.length] ?? pool[0] ?? '';
};

export const buildPreviewPrompt = (input: PreviewPromptInput, variantIndex: number): string => {
  const appearanceCue = resolveAppearanceCue(input.styleVibe, input.personality, input.occupation);
  const negativeOverlapLine = formatNegativeOverlapLine(input.negativeOverlapCues);
  const moderationSafe = isAdultForwardPreviewTraits(input.styleVibe, input.personality);

  const parts = [
    `${resolveSubjectStrict(input.sex)}.`,
    `${resolvePreviewPhysicalTraitLine(input)}.`,
    input.faceDnaLine?.trim() ? input.faceDnaLine.trim() : null,
    input.faceDnaInvariantLine?.trim() ? input.faceDnaInvariantLine.trim() : null,
    moderationSafe
      ? pickModerationSafeVariant(PREVIEW_FRAMING_VARIANTS, variantIndex)
      : getPreviewFramingVariant(variantIndex),
    moderationSafe
      ? pickModerationSafeVariant(PREVIEW_SCENE_VARIANTS, variantIndex)
      : getPreviewSceneVariant(variantIndex),
    getCompositionAnchor('preview'),
    moderationSafe
      ? pickModerationSafeVariant(PREVIEW_LIGHTING_VARIANTS, variantIndex)
      : getPreviewLightingVariant(variantIndex),
    moderationSafe
      ? pickModerationSafeVariant(PREVIEW_EXPRESSIONS, variantIndex)
      : getPreviewExpression(variantIndex),
  ];

  if (appearanceCue) parts.push(appearanceCue);

  const freeformDetails = sanitizePreviewFreeformDetails(input.freeformDetails);
  if (freeformDetails) {
    parts.push(`Additional details: ${freeformDetails}.`);
  }

  parts.push(EXPOSURE_LIGHTING_TAIL);
  parts.push(PHOTO_REALISM_TAIL);

  if (negativeOverlapLine) parts.push(negativeOverlapLine);

  parts.push(buildTogetherPreviewNegatives());
  const ethnicityNegative = resolveEthnicityNegative(input.origin);
  if (ethnicityNegative) parts.push(ethnicityNegative);

  return parts.filter(Boolean).join(' ');
};

export const previewPromptVersion: string = PROMPT_VERSION.preview;
