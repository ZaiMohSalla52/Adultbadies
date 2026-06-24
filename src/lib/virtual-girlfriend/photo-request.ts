import type { ChatTurnIntent } from '@/lib/virtual-girlfriend/intimacy-intent';

const PHOTO_REQUEST_HEURISTIC =
  /\b(selfie|selfies|photo|photos?|pic|pics?|picture|pictures?|snap|send me|show me|see you|what do you look|another (shot|image|photo)|more of you)\b/i;

export const looksLikePhotoRequest = (message: string) => PHOTO_REQUEST_HEURISTIC.test(message.trim());

export const buildHeuristicPhotoIntent = (userMessage: string): ChatTurnIntent => ({
  intimacyActive: true,
  wantsPhoto: true,
  photoDelivery: 'send_now',
  visualSceneHint: `In-chat photo matching what the user wants: ${userMessage.trim()}`,
  imageCategory: 'selfie',
  powerDynamic: 'balanced',
  companionGuidance:
    'The user wants to see you. A photo is being delivered in this app — flirt naturally, react in-character, and NEVER say you cannot send photos or offer text descriptions instead.',
});