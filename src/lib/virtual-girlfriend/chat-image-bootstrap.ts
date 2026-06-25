import crypto from 'node:crypto';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualIdentityPack,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export type ChatVisualContext = {
  identityPack: VirtualGirlfriendVisualIdentityPack;
  visualProfileId: string;
  promptHashSeed: string;
  bootstrapped: boolean;
};

export const buildBootstrapIdentityPack = (
  companion: VirtualGirlfriendCompanionRecord,
): VirtualGirlfriendVisualIdentityPack => {
  const sp = companion.structured_profile;
  const age = Number(sp?.age);
  const ageBand = Number.isFinite(age) && age > 0
    ? `${Math.max(18, age - 2)}-${Math.max(19, age + 2)}`
    : '22-28';
  const hairColor = sp?.hairColor ?? 'dark brown';
  const hairLength = sp?.hairLength ?? 'long';
  const eyeColor = sp?.eyeColor ?? 'brown';
  const skinTone = sp?.skinTone ?? 'medium';
  const bodyType = sp?.bodyType ?? sp?.figure ?? 'slim';
  const origin = sp?.origin ?? 'mixed';

  const asString = (value: string | null | undefined) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

  return {
    continuityAnchors: [
      `${origin} heritage`,
      `${hairColor} ${hairLength} hair`,
      `${eyeColor} eyes`,
      `${skinTone} skin tone`,
      `${bodyType} build`,
      asString(companion.visual_aesthetic),
      asString(sp?.archetype),
    ].filter((value): value is string => Boolean(value)),
    coreLookDescriptors: [
      `${origin} features`,
      `${hairColor} ${hairLength} hair`,
      `${eyeColor} eyes`,
      `${bodyType} body`,
      asString(companion.visual_aesthetic),
      asString(sp?.archetype),
      asString(sp?.occupation),
    ].filter((value): value is string => Boolean(value)),
    portraitFramingStyle: 'cinematic portrait framing; natural eye-level',
    wardrobeDirection: 'flattering stylish outfit matching scene context',
    lightingMoodDirection: 'warm natural cinematic lighting',
    cameraCompositionPreferences: ['medium close-up to waist-up', 'shallow depth of field'],
    realismPolishLevel: 'hyper-realistic candid photography',
    negativeConstraints: ['harsh flash', 'plastic airbrushed look'],
    negativeOverlapCues: [],
    identityInvariants: {
      ageBand,
      faceShape: 'symmetrical face with expressive eyes',
      eyeShapeColor: `${eyeColor} eyes`,
      browCharacter: 'natural well-defined brows',
      noseProfile: 'natural nose profile',
      lipShape: 'full natural lips',
      skinToneBand: skinTone,
      hairSignature: `${hairColor} ${hairLength} hair`,
      bodyPresentation: `${bodyType} figure`,
      signatureAccessoryOrMotif: 'minimal tasteful accessories',
    },
  };
};

const hasIdentityPack = (pack: VirtualGirlfriendVisualIdentityPack | null | undefined) =>
  Boolean(pack?.continuityAnchors?.some((anchor) => anchor.trim().length > 0));

export const resolveChatVisualContext = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
}): ChatVisualContext | null => {
  if (input.visualProfile) {
    return {
      identityPack: hasIdentityPack(input.visualProfile.identity_pack)
        ? input.visualProfile.identity_pack
        : buildBootstrapIdentityPack(input.companion),
      visualProfileId: input.visualProfile.id,
      promptHashSeed: input.visualProfile.prompt_hash,
      bootstrapped: !hasIdentityPack(input.visualProfile.identity_pack),
    };
  }

  const reference = input.existingImages.find((image) => image.image_kind === 'canonical' && image.delivery_url)
    ?? input.existingImages.find((image) => image.delivery_url && image.image_kind === 'gallery');

  if (!reference?.visual_profile_id) return null;

  return {
    identityPack: buildBootstrapIdentityPack(input.companion),
    visualProfileId: reference.visual_profile_id,
    promptHashSeed: reference.prompt_hash || sha(`${input.companion.id}:chat-bootstrap`),
    bootstrapped: true,
  };
};

export const resolveCanonicalReferenceForChat = (
  visualProfile: VirtualGirlfriendVisualProfileRecord | null,
  existingImages: VirtualGirlfriendCompanionImageRecord[],
): VirtualGirlfriendCompanionImageRecord | null => {
  const canonicalId = visualProfile?.canonical_reference_image_id;
  if (canonicalId) {
    const byId = existingImages.find((image) => image.id === canonicalId && image.delivery_url);
    if (byId) return byId;
  }

  // Identity lock must use the canonical portrait only — never a random gallery scene.
  return existingImages.find((image) => image.image_kind === 'canonical' && image.delivery_url) ?? null;
};

export type ChatFaceReference = {
  deliveryUrl: string;
  imageId: string | null;
  originMimeType: string | null;
  source: 'canonical' | 'setup_portrait';
};

const resolveSetupPortraitUrl = (
  companion: VirtualGirlfriendCompanionRecord,
  visualProfile: VirtualGirlfriendVisualProfileRecord | null,
) => {
  const fromProfile = companion.structured_profile?.selectedPortraitImage?.trim() ?? '';
  if (/^https?:\/\//i.test(fromProfile)) return fromProfile;

  const fromVisualProfile =
    typeof visualProfile?.source_setup?.selectedPortraitImage === 'string'
      ? visualProfile.source_setup.selectedPortraitImage.trim()
      : '';
  if (/^https?:\/\//i.test(fromVisualProfile)) return fromVisualProfile;

  return null;
};

/** Face reference for chat image generation — canonical when ready, else setup portrait URL. */
export const resolveChatFaceReference = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
}): ChatFaceReference | null => {
  const canonical = resolveCanonicalReferenceForChat(input.visualProfile, input.existingImages);
  if (canonical?.delivery_url) {
    return {
      deliveryUrl: canonical.delivery_url,
      imageId: canonical.id,
      originMimeType: canonical.origin_mime_type,
      source: 'canonical',
    };
  }

  const setupPortraitUrl = resolveSetupPortraitUrl(input.companion, input.visualProfile);
  if (setupPortraitUrl) {
    return {
      deliveryUrl: setupPortraitUrl,
      imageId: null,
      originMimeType: 'image/png',
      source: 'setup_portrait',
    };
  }

  return null;
};