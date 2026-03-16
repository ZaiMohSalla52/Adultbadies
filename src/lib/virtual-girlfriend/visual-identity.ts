import crypto from 'node:crypto';
import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import { generateImageWithOpenAI } from '@/lib/virtual-girlfriend/image-openai';
import { uploadToR2 } from '@/lib/storage/r2';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import type {
  PersonaProfile,
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualIdentityPack,
} from '@/lib/virtual-girlfriend/types';
import { createVisualProfile, insertCompanionImages } from '@/lib/virtual-girlfriend/data';

const STYLE_VERSION = 'vg-image-v1';

type BuildIdentityInput = {
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
  companionName: string;
  persona: PersonaProfile;
};

const fallbackIdentityPack = (input: BuildIdentityInput): VirtualGirlfriendVisualIdentityPack => ({
  coreLookDescriptors: [input.visualAesthetic, input.archetype, 'romantic dating profile', 'high-end portrait'],
  portraitFramingStyle: 'close-up and half-body portrait mix, eye-level camera, shallow depth of field',
  wardrobeDirection: 'modern elegant wardrobe with tasteful styling and premium fabrics',
  lightingMoodDirection: 'cinematic soft key lighting with gentle highlights and warm skin tones',
  realismPolishLevel: 'high realism, polished, natural skin texture, editorial-quality finishing',
  continuityAnchors: [...input.persona.visualPromptDNA.styleAnchors, input.companionName],
  negativeConstraints: ['avoid multiple people', 'avoid distorted anatomy', 'avoid low-resolution', 'avoid explicit nudity'],
});

const sanitizePack = (raw: VirtualGirlfriendVisualIdentityPack, fallback: VirtualGirlfriendVisualIdentityPack) => ({
  ...fallback,
  ...raw,
  coreLookDescriptors: raw.coreLookDescriptors?.length ? raw.coreLookDescriptors : fallback.coreLookDescriptors,
  continuityAnchors: raw.continuityAnchors?.length ? raw.continuityAnchors : fallback.continuityAnchors,
  negativeConstraints: raw.negativeConstraints?.length ? raw.negativeConstraints : fallback.negativeConstraints,
});

export const buildVisualIdentityPack = async (input: BuildIdentityInput) => {
  const fallback = fallbackIdentityPack(input);

  const prompt = `Build a strict JSON visual identity pack for a premium AI virtual girlfriend image system.\n
Context:\n- Name: ${input.companionName}\n- Archetype: ${input.archetype}\n- Tone: ${input.tone}\n- Affection style: ${input.affectionStyle}\n- Visual aesthetic: ${input.visualAesthetic}\n- User hints: ${input.preferenceHints || 'none'}\n- Persona core look: ${input.persona.visualPromptDNA.coreLook}\n- Persona anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}\n- Persona camera mood: ${input.persona.visualPromptDNA.cameraMood}\n
Output JSON only with keys:\n{\n  "coreLookDescriptors": string[4..10],\n  "portraitFramingStyle": string,\n  "wardrobeDirection": string,\n  "lightingMoodDirection": string,\n  "realismPolishLevel": string,\n  "continuityAnchors": string[4..12],\n  "negativeConstraints": string[4..12]\n}\n
Requirements:\n- Ensure same-identity continuity across future images.\n- Dating-app appropriate, premium and believable.\n- No explicit sexual content.`;

  try {
    const response = await callOpenAIResponses({
      model: 'gpt-5-mini',
      input: [{ role: 'user', content: prompt }],
      reasoning: { effort: 'medium' },
    });

    const parsed = JSON.parse(extractResponsesText(response)) as VirtualGirlfriendVisualIdentityPack;
    return sanitizePack(parsed, fallback);
  } catch {
    return fallback;
  }
};

const buildImagePrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  variant: 'canonical' | 'gallery';
  variantIndex: number;
}) => {
  const v = input.variant === 'canonical' ? 'primary dating-profile portrait hero shot' : `gallery variant ${input.variantIndex}`;

  return [
    `Create a premium ${v} of the same single AI-generated woman identity named ${input.companion.name}.`,
    `Identity anchors: ${input.identityPack.continuityAnchors.join(', ')}.`,
    `Core look: ${input.identityPack.coreLookDescriptors.join(', ')}.`,
    `Framing: ${input.identityPack.portraitFramingStyle}.`,
    `Wardrobe: ${input.identityPack.wardrobeDirection}.`,
    `Lighting/mood: ${input.identityPack.lightingMoodDirection}.`,
    `Realism/polish: ${input.identityPack.realismPolishLevel}.`,
    `Aesthetic context: ${input.companion.visual_aesthetic ?? 'premium romantic portrait aesthetic'}.`,
    'Keep it dating-app appropriate and emotionally warm.',
    'Show exactly one adult woman, no extra people, no text overlays, no logos.',
    `Avoid: ${input.identityPack.negativeConstraints.join(', ')}.`,
  ].join(' ');
};

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const generateAndPersistVirtualGirlfriendImagePack = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  setup: {
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
  };
}) => {
  const identityPack = await buildVisualIdentityPack({
    ...input.setup,
    companionName: input.companion.name,
    persona: input.companion.persona_profile,
  });

  const promptBaseHash = sha(JSON.stringify(identityPack));
  const captures = [
    { kind: 'canonical' as const, variantIndex: 0 },
    { kind: 'gallery' as const, variantIndex: 1 },
    { kind: 'gallery' as const, variantIndex: 2 },
    { kind: 'gallery' as const, variantIndex: 3 },
  ];

  const prepared = [] as Array<{
    row: Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>;
  }>;

  for (const capture of captures) {
    const prompt = buildImagePrompt({
      companion: input.companion,
      identityPack,
      variant: capture.kind,
      variantIndex: capture.variantIndex,
    });

    const promptHash = sha(`${promptBaseHash}:${capture.kind}:${capture.variantIndex}:${prompt}`);
    const generated = await generateImageWithOpenAI(prompt);

    const key = `virtual-girlfriend-images/${input.userId}/${input.companion.id}/${STYLE_VERSION}/${capture.kind}-${capture.variantIndex}-${Date.now()}.png`;
    const r2 = await uploadToR2({
      key,
      body: generated.bytes,
      contentType: generated.mimeType,
    });

    const cloudinary = await uploadToCloudinary({
      bytes: generated.bytes,
      mimeType: generated.mimeType,
      folderPath: `${input.userId}/${input.companion.id}`,
      publicId: `${STYLE_VERSION}-${capture.kind}-${capture.variantIndex}`,
    });

    prepared.push({
      row: {
        user_id: input.userId,
        companion_id: input.companion.id,
        visual_profile_id: '',
        image_kind: capture.kind,
        variant_index: capture.variantIndex,
        origin_storage_provider: r2.provider,
        origin_storage_key: r2.key,
        origin_mime_type: generated.mimeType,
        origin_byte_size: generated.bytes.byteLength,
        delivery_provider: cloudinary.provider,
        delivery_public_id: cloudinary.publicId,
        delivery_url: cloudinary.deliveryUrl,
        width: cloudinary.width,
        height: cloudinary.height,
        prompt_hash: promptHash,
        style_version: STYLE_VERSION,
        seed_metadata: {},
        lineage_metadata: { revisedPrompt: generated.revisedPrompt ?? null, continuityAnchors: identityPack.continuityAnchors },
        moderation_status: 'pending',
        moderation: { provider: 'openai-image-default' },
        provenance: {
          generatedBy: 'openai:gpt-image-1',
          originalStorage: 'cloudflare_r2',
          delivery: 'cloudinary',
          generatedAt: new Date().toISOString(),
        },
        quality_score: 0.9,
      },
    });
  }

  const visualProfile = await createVisualProfile(input.token, {
    userId: input.userId,
    companionId: input.companion.id,
    styleVersion: STYLE_VERSION,
    promptHash: promptBaseHash,
    sourceSetup: input.setup,
    identityPack,
    continuityNotes: 'Identity continuity anchored by visual profile pack and shared style version.',
    moderationStatus: 'pending',
    provenance: { generatedBy: 'openai:gpt-5-mini', phase: 'stage9-phase3' },
  });

  const imageRows = prepared.map((entry) => ({ ...entry.row, visual_profile_id: visualProfile.id }));
  const images = await insertCompanionImages(input.token, imageRows);

  return { visualProfile, images };
};
