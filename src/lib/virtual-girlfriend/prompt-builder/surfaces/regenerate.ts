import type { CompanionTraits } from '../../types/traits';

export interface RegeneratePromptInput {
  traits: CompanionTraits;
}

export const REGENERATE_PROMPT_VERSION = 'regenerate.v1' as const;

export function buildRegeneratePrompt(input: RegeneratePromptInput): string {
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
