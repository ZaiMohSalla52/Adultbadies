import type { PreviewTraits } from '../../types/traits';

export interface PreviewPromptInput {
  traits: PreviewTraits;
}

export const PREVIEW_PROMPT_VERSION = 'preview.v1' as const;

export function buildPreviewPrompt(input: PreviewPromptInput): string {
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
