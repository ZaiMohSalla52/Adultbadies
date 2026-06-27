import type { VirtualGirlfriendImageCategory } from '@/lib/virtual-girlfriend/types';

const IMAGE_CATEGORIES: VirtualGirlfriendImageCategory[] = [
  'selfie',
  'casual',
  'outfit',
  'indoor',
  'night-out',
  'good-morning',
  'good-night',
  'lifestyle',
];

export type PhotoDeliveryIntent = 'none' | 'tease_first' | 'send_now' | 'reward_compliance';

export type ChatTurnIntent = {
  intimacyActive: boolean;
  wantsPhoto: boolean;
  photoDelivery: PhotoDeliveryIntent;
  visualSceneHint: string | null;
  imageCategory: VirtualGirlfriendImageCategory;
  powerDynamic: 'balanced' | 'companion_leads' | 'user_leads';
  companionGuidance: string;
};

const defaultIntent = (userMessage: string): ChatTurnIntent => ({
  intimacyActive: false,
  wantsPhoto: false,
  photoDelivery: 'none',
  visualSceneHint: null,
  imageCategory: 'selfie',
  powerDynamic: 'balanced',
  companionGuidance: 'Respond naturally to what the user said. Match their tone and stay in character.',
});

export const sanitizeIntent = (raw: Partial<ChatTurnIntent>, userMessage: string): ChatTurnIntent => {
  const fallback = defaultIntent(userMessage);
  const imageCategory = IMAGE_CATEGORIES.includes(raw.imageCategory as VirtualGirlfriendImageCategory)
    ? (raw.imageCategory as VirtualGirlfriendImageCategory)
    : fallback.imageCategory;

  const delivery: PhotoDeliveryIntent =
    raw.photoDelivery === 'tease_first'
    || raw.photoDelivery === 'send_now'
    || raw.photoDelivery === 'reward_compliance'
      ? raw.photoDelivery
      : 'none';

  const powerDynamic =
    raw.powerDynamic === 'companion_leads' || raw.powerDynamic === 'user_leads'
      ? raw.powerDynamic
      : 'balanced';

  return {
    intimacyActive: Boolean(raw.intimacyActive),
    wantsPhoto: Boolean(raw.wantsPhoto),
    photoDelivery: raw.wantsPhoto ? delivery : 'none',
    visualSceneHint: typeof raw.visualSceneHint === 'string' && raw.visualSceneHint.trim()
      ? raw.visualSceneHint.trim().slice(0, 400)
      : null,
    imageCategory,
    powerDynamic,
    companionGuidance:
      typeof raw.companionGuidance === 'string' && raw.companionGuidance.trim()
        ? raw.companionGuidance.trim().slice(0, 500)
        : fallback.companionGuidance,
  };
};