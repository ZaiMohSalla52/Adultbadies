/**
 * Together FLUX.2-max can pass bakeoff prompts but block stacked adult-forward
 * production prompts with "image may contain NSFW content". Soften wording and
 * variant pools for setup previews while keeping seductive/glamour intent.
 */

const MODERATION_RISKY_PATTERN =
  /\b(bedroom|intimate|sensual|smolder|collarbone|thirst|lingerie|boudoir|nude|parted lips)\b/i;

export const isAdultForwardPreviewTraits = (styleVibe?: string, personality?: string) => {
  const vibe = styleVibe?.trim().toLowerCase();
  if (vibe && ['seductive', 'lingerie', 'athletic'].includes(vibe)) return true;
  const persona = personality?.trim().toLowerCase();
  return Boolean(persona && /seductive|dominant_tease|wild_uninhibited|submissive_eager/.test(persona));
};

export const filterModerationSafeVariants = <T extends string>(variants: readonly T[]): T[] =>
  variants.filter((variant) => !MODERATION_RISKY_PATTERN.test(variant));

const MODERATION_SOFT_REPLACEMENTS: Array<[RegExp, string]> = [
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
];

export const softenPreviewPromptForModeration = (prompt: string) => {
  let softened = prompt;
  for (const [pattern, replacement] of MODERATION_SOFT_REPLACEMENTS) {
    softened = softened.replace(pattern, replacement);
  }
  return softened.replace(/\s+/g, ' ').trim();
};