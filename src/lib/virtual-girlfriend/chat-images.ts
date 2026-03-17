import crypto from 'node:crypto';
import { generateGalleryImageFromReferenceWithIdeogram } from '@/lib/virtual-girlfriend/image-ideogram';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import { uploadToR2 } from '@/lib/storage/r2';
import { insertCompanionImages } from '@/lib/virtual-girlfriend/data';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const CATEGORY_KEYWORDS: Record<VirtualGirlfriendImageCategory, RegExp> = {
  selfie: /\bselfie|photo|pic|picture|look like\b/i,
  casual: /\bcasual|chill|relaxed\b/i,
  outfit: /\boutfit|dress|wearing|fit check\b/i,
  indoor: /\bindoor|inside|at home|room\b/i,
  'night-out': /\bnight ?out|party|club|evening\b/i,
  'good-morning': /\bgood\s*morning|morning\b/i,
  'good-night': /\bgood\s*night|night\b/i,
  lifestyle: /\blifestyle|day|daily|vibe\b/i,
};

const IMAGE_REQUEST_PATTERN = /\b(send|show|share|drop).{0,20}\b(selfie|photo|pic|picture)|\bwhat do you look like\b/i;

const hash = (input: string) => crypto.createHash('sha256').update(input).digest('hex');

export const detectRequestedImageCategory = (message: string): VirtualGirlfriendImageCategory => {
  const normalized = message.toLowerCase();
  const matched = Object.entries(CATEGORY_KEYWORDS).find(([, pattern]) => pattern.test(normalized));
  return (matched?.[0] as VirtualGirlfriendImageCategory | undefined) ?? 'selfie';
};

export const decideVirtualGirlfriendImageMoment = (input: {
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}) => {
  const directRequest = IMAGE_REQUEST_PATTERN.test(input.userMessage);
  const lastAssistantImageAt = [...input.history]
    .reverse()
    .find((message) => message.role === 'assistant' && message.attachments?.some((a) => a.kind === 'image'));

  const minutesSinceLastImage = lastAssistantImageAt
    ? (Date.now() - new Date(lastAssistantImageAt.created_at).getTime()) / (1000 * 60)
    : Infinity;

  const contextualNudge = /\bmiss you|show me|need to see you|wish i could see you\b/i.test(input.userMessage);
  const rateLimited = minutesSinceLastImage < 18;

  if (directRequest && !rateLimited) {
    return { shouldSendImage: true, category: detectRequestedImageCategory(input.userMessage), trigger: 'user-request' as const };
  }

  if (contextualNudge && input.isPremium && !rateLimited) {
    return {
      shouldSendImage: true,
      category: detectRequestedImageCategory(input.userMessage),
      trigger: 'contextual-initiative' as const,
    };
  }

  return { shouldSendImage: false, category: detectRequestedImageCategory(input.userMessage), trigger: 'none' as const };
};

const pickReusableImage = (
  category: VirtualGirlfriendImageCategory,
  images: VirtualGirlfriendCompanionImageRecord[],
): VirtualGirlfriendCompanionImageRecord | null => {
  const chatCategoryImages = images
    .filter((image) => typeof image.lineage_metadata?.chatCategory === 'string' && image.lineage_metadata.chatCategory === category)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (chatCategoryImages[0]) return chatCategoryImages[0];

  const gallery = images
    .filter((image) => image.image_kind === 'gallery' || image.image_kind === 'canonical')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return gallery[0] ?? null;
};

const buildChatImagePrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  category: VirtualGirlfriendImageCategory;
}) => {
  const identityPack = input.visualProfile.identity_pack;

  return [
    `Generate a premium ${input.category} chat photo of the same single AI-generated woman identity named ${input.companion.name}.`,
    'Make it look like a believable dating-app or private chat photo: natural lighting, candid framing, real-world texture.',
    `Continuity anchors: ${identityPack.continuityAnchors.join(', ')}.`,
    `Core look descriptors: ${identityPack.coreLookDescriptors.join(', ')}.`,
    `Identity invariants: age band ${identityPack.identityInvariants.ageBand}; face ${identityPack.identityInvariants.faceShape}; eyes ${identityPack.identityInvariants.eyeShapeColor}; brows ${identityPack.identityInvariants.browCharacter}; nose ${identityPack.identityInvariants.noseProfile}; lips ${identityPack.identityInvariants.lipShape}; skin tone ${identityPack.identityInvariants.skinToneBand}; hair ${identityPack.identityInvariants.hairSignature}; body presentation ${identityPack.identityInvariants.bodyPresentation}; signature motif ${identityPack.identityInvariants.signatureAccessoryOrMotif}.`,
    `Camera/composition preferences: ${identityPack.cameraCompositionPreferences.join(', ')}.`,
    `Framing: ${identityPack.portraitFramingStyle}.`,
    `Wardrobe direction: ${identityPack.wardrobeDirection}.`,
    `Lighting direction: ${identityPack.lightingMoodDirection}.`,
    `Realism quality: ${identityPack.realismPolishLevel}.`,
    `Aesthetic lineage: ${input.companion.visual_aesthetic ?? 'premium romantic portrait'}.`,
    'App-safe, elegant, warm emotional tone. Adult woman only. Exactly one person.',
    'Ensure this image is not a near-duplicate of previous gallery images; vary scene, angle, and outfit while preserving identity.',
    'No explicit nudity, no lingerie closeups, no transparent clothing, no suggestive sexual framing.',
    `Avoid: ${identityPack.negativeConstraints.join(', ')}.`,
    `Negative overlap cues: ${identityPack.negativeOverlapCues.join(', ')}.`,
  ].join(' ');
};

const resolveCanonicalReferenceImage = (
  companion: VirtualGirlfriendCompanionRecord,
  images: VirtualGirlfriendCompanionImageRecord[],
): VirtualGirlfriendCompanionImageRecord => {
  if (!companion.canonical_reference_image_id) {
    throw new Error('Canonical reference image is missing for this companion.');
  }

  const canonical = images.find((image) => image.id === companion.canonical_reference_image_id);
  if (!canonical) {
    throw new Error('Canonical reference image record could not be found.');
  }

  if (!canonical.delivery_url) {
    throw new Error('Canonical reference image delivery URL is missing.');
  }

  return canonical;
};

const downloadCanonicalReferenceBytes = async (canonical: VirtualGirlfriendCompanionImageRecord) => {
  const response = await fetch(canonical.delivery_url);
  if (!response.ok) {
    throw new Error(`Canonical reference image download failed (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') ?? canonical.origin_mime_type ?? 'image/png',
  };
};

export const resolveVirtualGirlfriendChatImage = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  category: VirtualGirlfriendImageCategory;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  allowFreshGeneration: boolean;
}): Promise<VirtualGirlfriendMessageAttachment | null> => {
  const reusable = pickReusableImage(input.category, input.existingImages);
  if (reusable) {
    return {
      kind: 'image',
      category: input.category,
      imageId: reusable.id,
      imageUrl: reusable.delivery_url,
      width: reusable.width,
      height: reusable.height,
      source: 'gallery-reuse',
      promptHash: reusable.prompt_hash,
    };
  }

  if (!input.allowFreshGeneration || !input.visualProfile) {
    return null;
  }

  const canonical = resolveCanonicalReferenceImage(input.companion, input.existingImages);
  const canonicalReference = await downloadCanonicalReferenceBytes(canonical);

  const prompt = buildChatImagePrompt({
    companion: input.companion,
    visualProfile: input.visualProfile,
    category: input.category,
  });

  const generated = await generateGalleryImageFromReferenceWithIdeogram({
    prompt,
    referenceImageBytes: canonicalReference.bytes,
    referenceMimeType: canonicalReference.mimeType,
  });
  const promptHash = hash(`${input.visualProfile.prompt_hash}:${input.category}:${prompt}`);

  const key = `virtual-girlfriend-images/${input.userId}/${input.companion.id}/${input.visualProfile.style_version}/chat-${input.category}-${Date.now()}.png`;
  const r2 = await uploadToR2({
    key,
    body: generated.bytes,
    contentType: generated.mimeType,
  });

  const cloudinary = await uploadToCloudinary({
    bytes: generated.bytes,
    mimeType: generated.mimeType,
    folderPath: `${input.userId}/${input.companion.id}`,
    publicId: `${input.visualProfile.style_version}-chat-${input.category}-${Date.now()}`,
  });

  const [inserted] = await insertCompanionImages(input.token, [
    {
      user_id: input.userId,
      companion_id: input.companion.id,
      visual_profile_id: input.visualProfile.id,
      image_kind: 'gallery',
      variant_index: Math.floor(Math.random() * 100000),
      origin_storage_provider: r2.provider,
      origin_storage_key: r2.key,
      origin_mime_type: generated.mimeType,
      origin_byte_size: generated.bytes.byteLength,
      delivery_provider: cloudinary.provider,
      delivery_public_id: cloudinary.publicId,
      delivery_url: cloudinary.deliveryUrl,
      width: cloudinary.width ?? generated.width,
      height: cloudinary.height ?? generated.height,
      prompt_hash: promptHash,
      style_version: input.visualProfile.style_version,
      seed_metadata: {},
      lineage_metadata: {
        reference_image_id: canonical.id,
        generation_mode: 'chat_from_canonical',
        provider: generated.provider,
        providerModel: generated.model,
        providerEndpoint: generated.endpoint,
        providerRequestId: generated.requestId,
        providerJobId: generated.jobId,
        provider_model: generated.model,
        provider_request_id: generated.requestId,
        provider_job_id: generated.jobId,
        revisedPrompt: generated.revisedPrompt ?? null,
        chatCategory: input.category,
        source: 'chat-phase5',
      },
      moderation_status: 'pending',
      moderation: { provider: 'ideogram-v3', phase: 'stage9-phase5' },
      provenance: {
        generatedBy: `${generated.provider}:${generated.model}`,
        generatedAt: new Date().toISOString(),
        originalStorage: 'cloudflare_r2',
        delivery: 'cloudinary',
        providerEndpoint: generated.endpoint,
        providerRequestId: generated.requestId,
        providerJobId: generated.jobId,
      },
      quality_score: 0.92,
    },
  ]);

  return {
    kind: 'image',
    category: input.category,
    imageId: inserted.id,
    imageUrl: inserted.delivery_url,
    width: inserted.width,
    height: inserted.height,
    source: 'fresh-generation',
    promptHash,
  };
};
