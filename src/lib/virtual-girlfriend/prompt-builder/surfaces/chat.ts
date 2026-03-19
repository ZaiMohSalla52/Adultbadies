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
  coreLook?: string[];
  wardrobeDirection?: string;
  lightingMood?: string;
  negativeConstraints?: string[];
  contextHint?: string;
  category?: string;
}

export const buildChatPrompt = (input: ChatPromptInput): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');
  const coreLook = input.coreLook?.filter(Boolean).join(', ');
  const negConstraints = input.negativeConstraints?.filter(Boolean).join(', ');

  return [
    `Photo of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    identityAnchors ? `Identity: ${identityAnchors}.` : null,
    coreLook ? `Look: ${coreLook}.` : null,
    input.wardrobeDirection ? `Wearing: ${input.wardrobeDirection}.` : null,
    input.lightingMood ? `Lighting: ${input.lightingMood}.` : null,
    input.category ? `Scene type: ${input.category}.` : null,
    input.contextHint ? `${input.contextHint}.` : null,
    getCompositionAnchor('chat'),
    'Best quality, realistic, detailed, natural lighting.',
    buildNegatives(['composition', 'content']),
    negConstraints ? `Avoid: ${negConstraints}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
};

export const chatPromptVersion: string = PROMPT_VERSION.chat;
