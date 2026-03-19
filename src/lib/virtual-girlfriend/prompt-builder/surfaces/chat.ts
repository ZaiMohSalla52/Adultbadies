/*
 * CHAT SURFACE — contextual in-chat image generation.
 * Most creative surface.
 * Still identity-anchored but allows scene/context variation.
 */

import { getCompositionAnchor } from '../primitives/composition';
import { buildNegatives } from '../primitives/negatives';
import { resolvePhysicalTraitLine } from '../primitives/physical';
import { resolveSubject } from '../primitives/subject';
import { PROMPT_VERSION } from '../versions';

export interface ChatPromptInput {
  sex: string;
  age: number;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  skinTone?: string;
  identityAnchors?: string[];
  contextHint?: string;
  category?: string;
}

export const buildChatPrompt = (input: ChatPromptInput): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');

  return [
    `Portrait photograph of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityAnchors ? `Identity anchors: ${identityAnchors}.` : null,
    input.category ? `Category: ${input.category}.` : null,
    input.contextHint ? `Context: ${input.contextHint}.` : null,
    getCompositionAnchor('chat'),
    buildNegatives(['composition', 'content']),
  ]
    .filter(Boolean)
    .join(' ');
};

export const chatPromptVersion: string = PROMPT_VERSION.chat;
