import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import type { ChatTurnIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { getOutfitPresetsForSex } from '@/lib/virtual-girlfriend/outfit-presets';

const PHOTO_REQUEST_HEURISTIC =
  /\b(selfie|selfies|photo|photos?|pic|pics?|picture|pictures?|snap|send me|show me|see you|what do you look|another (shot|image|photo)|more of you|closer peek|want to see)\b/i;

export const looksLikePhotoRequest = (message: string) => {
  const trimmed = message.trim();
  return PHOTO_REQUEST_HEURISTIC.test(trimmed) || detectExplicitImageIntent(trimmed);
};

const resolvePresetSceneHint = (message: string) => {
  const normalized = message.trim().toLowerCase();
  const preset = getOutfitPresetsForSex('female').concat(getOutfitPresetsForSex('male'))
    .find((entry) => entry.message.toLowerCase() === normalized);
  return preset?.sceneHint ?? null;
};

export const buildHeuristicPhotoIntent = (userMessage: string): ChatTurnIntent => {
  const trimmed = userMessage.trim();
  const explicit = detectExplicitImageIntent(trimmed);
  const presetHint = resolvePresetSceneHint(trimmed);

  return {
    intimacyActive: true,
    wantsPhoto: true,
    photoDelivery: 'send_now',
    visualSceneHint: explicit
      ? `Explicit adult photo exactly as requested: ${trimmed}. Deliver the body/framing the user asked for. Same face and identity, new shot — not a recycled profile portrait.`
      : presetHint
        ? presetHint
        : `In-chat photo matching what the user wants: ${trimmed}`,
    imageCategory: explicit ? 'indoor' : 'selfie',
    powerDynamic: 'balanced',
    companionGuidance: explicit
      ? 'The user asked for an explicit adult photo. A fresh in-app image is generating — flirt in-character, stay eager, and NEVER say you cannot send photos or offer text instead.'
      : 'The user wants to see you. A photo is being delivered in this app — flirt naturally, react in-character, and NEVER say you cannot send photos or offer text descriptions instead.',
  };
};