import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import type { WardrobeContext } from '@/lib/virtual-girlfriend/companion-wardrobe';
import type { ChatTurnIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { formatPhotoSceneHint, resolvePhotoGenerationSpec } from '@/lib/virtual-girlfriend/photo-generation-spec';

const PHOTO_REQUEST_HEURISTIC =
  /\b(selfie|selfies|photo|photos?|pic|pics?|picture|pictures?|snap|send me|show me|see you|what do you look|another (shot|image|photo)|more of you|closer peek|want to see)\b/i;

export const looksLikePhotoRequest = (message: string) => {
  const trimmed = message.trim();
  return PHOTO_REQUEST_HEURISTIC.test(trimmed) || detectExplicitImageIntent(trimmed);
};

export const buildHeuristicPhotoIntent = (
  userMessage: string,
  context: WardrobeContext = {},
): ChatTurnIntent => {
  const trimmed = userMessage.trim();
  const spec = resolvePhotoGenerationSpec(trimmed, context);

  return {
    intimacyActive: true,
    wantsPhoto: true,
    photoDelivery: 'send_now',
    visualSceneHint: formatPhotoSceneHint(spec),
    imageCategory: spec.imageCategory,
    powerDynamic: 'balanced',
    companionGuidance: spec.explicit
      ? 'The user asked for an explicit adult photo. A fresh in-app image is generating — flirt in-character, stay eager, and NEVER say you cannot send photos or offer text instead.'
      : 'The user wants to see you. A photo is being delivered in this app — flirt naturally, react in-character, and NEVER say you cannot send photos or offer text descriptions instead.',
  };
};