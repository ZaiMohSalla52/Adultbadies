/*
 * CHAT SURFACE — contextual in-chat image generation.
 * Most creative surface.
 * Still identity-anchored but allows scene/context variation.
 */

import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import { getCompositionAnchor, PHOTO_REALISM_TAIL } from '../primitives/composition';
import { buildChatNegativePrompt } from '../primitives/negatives';
import { resolveEthnicityNegative, resolvePhysicalTraitLine } from '../primitives/physical';
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
  breastSize?: string;
  occupation?: string;
  identityAnchors?: string[];
  coreLook?: string[];
  wardrobeDirection?: string;
  lightingMood?: string;
  negativeConstraints?: string[];
  contextHint?: string;
  category?: string;
  allowAdultContent?: boolean;
  explicitIntent?: boolean;
}

export const buildChatPrompt = (input: ChatPromptInput): string => {
  const identityAnchors = input.identityAnchors?.filter(Boolean).join(', ');
  const coreLook = input.coreLook?.filter(Boolean).join(', ');
  const negConstraints = input.negativeConstraints?.filter(Boolean).join(', ');
  const allowAdultContent = input.allowAdultContent ?? isVirtualGirlfriendAdultContentEnabled();

  return [
    `Photo of ${resolveSubject(input.sex)}.`,
    `${resolvePhysicalTraitLine(input)}.`,
    input.occupation ? `Occupation: ${input.occupation}.` : null,
    identityAnchors ? `Identity: ${identityAnchors}.` : null,
    coreLook ? `Look: ${coreLook}.` : null,
    input.wardrobeDirection ? `Wearing: ${input.wardrobeDirection}.` : null,
    input.lightingMood ? `Lighting: ${input.lightingMood}.` : null,
    input.category ? `Scene type: ${input.category}.` : null,
    input.contextHint ? `${input.contextHint}.` : null,
    allowAdultContent && input.explicitIntent
      ? 'Adult-only fictional companion. Fully explicit, sensual, uncensored adult photography is allowed. Preserve exact same face and identity lock.'
      : null,
    getCompositionAnchor('chat'),
    PHOTO_REALISM_TAIL,
    buildChatNegativePrompt({ allowAdultContent }),
    resolveEthnicityNegative(input.origin) ?? null,
    negConstraints ? `Avoid: ${negConstraints}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
};

export const chatPromptVersion: string = PROMPT_VERSION.chat;
