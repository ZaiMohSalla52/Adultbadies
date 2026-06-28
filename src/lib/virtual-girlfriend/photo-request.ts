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
      ? 'The user asked for an explicit adult photo. Flirt in-character and react to what they asked for — the app attaches the image automatically. NEVER narrate uploading/sending photos, NEVER use *photosending* or similar meta actions, NEVER say you cannot send photos.'
      : /\b(can i see|want to see|show me|let me see|yes please|send it)\b/i.test(trimmed)
        ? 'The user is confirming they want the photo now. React with fresh wording — do NOT repeat your previous tease verbatim. The app attaches the image automatically.'
        : 'The user wants to see you. Flirt naturally and react in-character — the app attaches photos automatically. NEVER narrate uploading/sending, NEVER use *photosending*, NEVER say you cannot send photos or offer text instead.',
  };
};