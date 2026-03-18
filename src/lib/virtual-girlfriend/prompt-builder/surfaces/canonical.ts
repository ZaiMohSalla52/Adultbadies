import type { CanonicalTraits } from '../../types/traits';

export interface CanonicalPromptInput {
  traits: CanonicalTraits;
}

export const CANONICAL_PROMPT_VERSION = 'canonical.v1' as const;

export function buildCanonicalPrompt(input: CanonicalPromptInput): string {
  const { traits } = input;
  return [
    `adult ${traits.sex}`,
    `${traits.age} years old`,
    `${traits.origin} origin`,
    `${traits.hairLength} ${traits.hairColor} hair`,
    `${traits.eyeColor} eyes`,
    `${traits.bodyType} body type`,
  ].join(', ');
}
