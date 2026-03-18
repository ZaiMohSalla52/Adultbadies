import type { CompanionTraits } from '../../types/traits';

export interface ChatPromptInput {
  traits: CompanionTraits;
}

export const CHAT_PROMPT_VERSION = 'chat.v1' as const;

export function buildChatPrompt(input: ChatPromptInput): string {
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
