import { PREVIEW_FRAMING_VARIANTS } from '@/lib/virtual-girlfriend/prompt-builder/primitives/composition';
import { resolvePreviewPhysicalTraitLine } from '@/lib/virtual-girlfriend/prompt-builder/primitives/physical';

export type MinimalPortraitPromptInput = {
  sex: string;
  age: number;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  skinTone?: string;
  breastSize?: string;
  faceDnaLine?: string;
};

/**
 * Together FLUX.2-max output moderation triggers (live API tested):
 * - "youthful smooth skin", "full bust", "large breasts"
 * - "no nudity"/"no explicit content" negatives combined with adult/glamour cues
 */

const MODERATION_RISKY_PATTERN =
  /\b(bedroom|intimate|sensual|smolder|collarbone|thirst|lingerie|boudoir|nude|parted lips|youthful smooth skin|full bust|large breasts|very full bust)\b/i;

export const isAdultForwardPreviewTraits = (styleVibe?: string, personality?: string) => {
  const vibe = styleVibe?.trim().toLowerCase();
  if (vibe && ['seductive', 'lingerie', 'athletic'].includes(vibe)) return true;
  const persona = personality?.trim().toLowerCase();
  return Boolean(persona && /seductive|dominant_tease|wild_uninhibited|submissive_eager/.test(persona));
};

export const filterModerationSafeVariants = <T extends string>(variants: readonly T[]): T[] =>
  variants.filter((variant) => !MODERATION_RISKY_PATTERN.test(variant));

const MODERATION_SOFT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/young adult, approximately (\d+) years old, youthful smooth skin/gi, 'real adult woman, approximately $1 years old, natural skin texture'],
  [/youthful smooth skin/gi, 'natural skin texture'],
  [/\bfull bust\b/gi, ''],
  [/\bvery full bust\b/gi, ''],
  [/\blarge breasts\b/gi, ''],
  [/\bmedium chest\b/gi, ''],
  [/\bsmall chest\b/gi, ''],
  [/sultry seductive gaze, parted lips, magnetic adult allure/gi, 'confident warm gaze, magnetic adult presence'],
  [/sultry seductive styling with adult glamour energy/gi, 'polished adult glamour styling, magnetic presence'],
  [/lingerie-forward intimate styling[^.]*\./gi, 'elegant evening styling with tasteful adult allure.'],
  [/athletic thirst-trap physique emphasis[^.]*\./gi, 'athletic confident look, fitted activewear styling.'],
  [/self-assured sensual presence/gi, 'self-assured confident presence'],
  [/subtle smolder, adult allure/gi, 'quiet magnetic confidence'],
  [/intimate portrait energy/gi, 'natural portrait energy'],
  [/intimate low-key warmth/gi, 'warm low-key ambiance'],
  [/intimate and real/gi, 'warm and inviting'],
  [/minimal bedroom or living-room setting[^.]*\./gi, 'cozy apartment interior with warm decor blur.'],
  [/cozy bedroom lamp glow[^.]*\./gi, 'warm indoor ambient light, flattering glow.'],
  [/tight crop from collarbone up[^.]*\./gi, 'close portrait, head and shoulders, face prominent.'],
  [/sensual/gi, 'confident'],
  [/parted lips/gi, 'relaxed natural expression'],
  [/\bno nudity\b/gi, ''],
  [/\bno explicit content\b/gi, ''],
];

export const softenPreviewPromptForModeration = (prompt: string) => {
  let softened = prompt;
  for (const [pattern, replacement] of MODERATION_SOFT_REPLACEMENTS) {
    softened = softened.replace(pattern, replacement);
  }
  return softened
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/ ,/g, ',')
    .trim();
};

export const sanitizePreviewFreeformDetails = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const sanitized = softenPreviewPromptForModeration(trimmed);
  return sanitized || undefined;
};

/** Bakeoff-style compact prompt — passes Together moderation when the full preview essay fails. */
export const buildMinimalTogetherPortraitPrompt = (
  input: MinimalPortraitPromptInput,
  variantIndex = 0,
) => {
  const isMale = input.sex?.trim().toLowerCase() === 'male';
  const subject = isMale ? 'man' : 'woman';
  const physical = resolvePreviewPhysicalTraitLine(input);
  const safeFraming = filterModerationSafeVariants(PREVIEW_FRAMING_VARIANTS);
  const framing = safeFraming[variantIndex % safeFraming.length]
    ?? 'Close portrait, head and shoulders only, face prominent, centered frame.';

  return [
    `A real adult ${subject}, age ${input.age}.`,
    `${physical}.`,
    input.faceDnaLine?.trim() ? input.faceDnaLine.trim() : null,
    framing,
    'Soft apartment background with gentle bokeh.',
    'Single person portrait photograph of a real human.',
    'Warm natural window light, soft directional warmth.',
    'Confident warm smile, magnetic adult presence.',
    'Face clearly lit. Candid amateur photograph, true-to-life skin tones and texture.',
  ]
    .filter(Boolean)
    .join(' ');
};