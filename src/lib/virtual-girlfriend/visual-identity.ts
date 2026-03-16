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

const STYLE_VERSION = 'vg-image-v3';

type BuildIdentityInput = {
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
  companionName: string;
  persona: PersonaProfile;
};

type CapturePlan = {
  kind: 'canonical' | 'gallery';
  variantIndex: number;
  label: string;
  framing: string;
  environment: string;
  mood: string;
  wardrobe: string;
  expression: string;
  glamourLevel: string;
};

const fallbackIdentityPack = (input: BuildIdentityInput): VirtualGirlfriendVisualIdentityPack => ({
  coreLookDescriptors: [input.visualAesthetic, input.archetype, input.tone, 'premium dating photography', 'real phone-camera portrait'],
  portraitFramingStyle: 'mix of close-up portrait, mirror selfie, and medium lifestyle framing; natural eye-level camera',
  wardrobeDirection: 'wardrobe changes by scene: one polished look, one casual look, one lifestyle look',
  lightingMoodDirection: 'mostly natural light with scene-true practical lighting; avoid studio flash look',
  realismPolishLevel: 'high realism with natural skin texture, candid imperfections, and believable phone-camera detail',
  continuityAnchors: [...input.persona.visualPromptDNA.styleAnchors, input.companionName],
  negativeConstraints: [
    'avoid multiple people',
    'avoid distorted anatomy',
    'avoid low-resolution',
    'avoid plastic skin smoothing',
    'avoid repetitive same room composition',
    'avoid explicit nudity',
  ],
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

  const prompt = `Build a strict JSON visual identity pack for a premium virtual girlfriend image system.
Context:
- Name: ${input.companionName}
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection style: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- User hints: ${input.preferenceHints || 'none'}
- Persona core look: ${input.persona.visualPromptDNA.coreLook}
- Persona anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}
- Persona camera mood: ${input.persona.visualPromptDNA.cameraMood}

Output JSON only with keys:
{
  "coreLookDescriptors": string[5..12],
  "portraitFramingStyle": string,
  "wardrobeDirection": string,
  "lightingMoodDirection": string,
  "realismPolishLevel": string,
  "continuityAnchors": string[5..14],
  "negativeConstraints": string[5..14]
}

Requirements:
- Strongly map archetype/tone/aesthetic to wardrobe, scene, expression, and energy.
- Prevent all outputs from collapsing into cozy indoor portraits.
- Prioritize realistic natural-lighting and believable phone-camera photography.
- Maintain same-identity continuity across future images.
- Dating-app appropriate, premium, and believable.
- No explicit sexual content.`;

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

const buildCapturePlan = (companion: VirtualGirlfriendCompanionRecord): CapturePlan[] => {
  const style = `${companion.archetype ?? ''} ${companion.tone ?? ''} ${companion.visual_aesthetic ?? ''} ${companion.affection_style ?? ''}`.toLowerCase();

  const personaSpecificLifestyle = /bombshell|glam|nightlife|bold/.test(style)
    ? {
        label: 'date-night glam look',
        environment: 'upscale evening venue or chic city backdrop',
        mood: 'playful confident date-night energy',
        wardrobe: 'dressy evening outfit with polished accessories',
        expression: 'confident smile with teasing eye contact',
        glamourLevel: 'high glamour',
      }
    : /intellectual|bookish|cozy|soft|calm/.test(style)
      ? {
          label: 'bookish cozy lifestyle',
          environment: 'warm cafe corner or home reading nook with texture',
          mood: 'soft understated romance',
          wardrobe: 'minimalist knit or cardigan with subtle elegance',
          expression: 'gentle half-smile and thoughtful gaze',
          glamourLevel: 'low-to-medium glamour',
        }
      : /playful|sporty|casual/.test(style)
        ? {
            label: 'daylight active lifestyle',
            environment: 'park, boardwalk, or casual outdoor city path',
            mood: 'fresh upbeat playful vibe',
            wardrobe: 'athleisure or casual sporty outfit',
            expression: 'energetic candid smile',
            glamourLevel: 'casual-fresh styling',
          }
        : {
            label: 'polished luxury lifestyle',
            environment: 'elegant hotel lounge or upscale modern interior',
            mood: 'poised romantic confidence',
            wardrobe: 'tailored refined outfit with clean lines',
            expression: 'composed warm confidence',
            glamourLevel: 'polished premium styling',
          };

  return [
    {
      kind: 'canonical',
      variantIndex: 0,
      label: 'signature portrait',
      framing: 'tight chest-up portrait, eye-level camera, strong face-first composition',
      environment: 'clean but scene-real background tied to selected aesthetic without clutter',
      mood: 'inviting chemistry with premium realism',
      wardrobe: 'signature look that defines her identity',
      expression: 'confident and warm eye contact',
      glamourLevel: 'balanced premium styling',
    },
    {
      kind: 'gallery',
      variantIndex: 1,
      label: 'lifestyle moment',
      framing: 'waist-up candid framing with visible activity and environment context',
      environment: 'lived-in daytime setting that feels personal and active',
      mood: 'candid and relaxed daily-life warmth',
      wardrobe: 'casual everyday outfit with movement-friendly styling',
      expression: 'easy natural smile while interacting with an object or activity',
      glamourLevel: 'low glamour casual realism',
    },
    {
      kind: 'gallery',
      variantIndex: 2,
      label: `date-night vibe — ${personaSpecificLifestyle.label}`,
      framing: 'half-body cinematic framing with intentional depth and clear subject separation',
      environment: personaSpecificLifestyle.environment,
      mood: personaSpecificLifestyle.mood,
      wardrobe: personaSpecificLifestyle.wardrobe,
      expression: personaSpecificLifestyle.expression,
      glamourLevel: personaSpecificLifestyle.glamourLevel,
    },
  ];
};

const buildImagePrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  capture: CapturePlan;
}) => {
  return [
    `Create a premium ${input.capture.label} image of the same single AI-generated woman identity named ${input.companion.name}.`,
    `Identity anchors: ${input.identityPack.continuityAnchors.join(', ')}.`,
    `Core look: ${input.identityPack.coreLookDescriptors.join(', ')}.`,
    `Framing: ${input.capture.framing}.`,
    `Background/environment: ${input.capture.environment}.`,
    `Wardrobe: ${input.capture.wardrobe}.`,
    `Expression and energy: ${input.capture.expression}; mood ${input.capture.mood}.`,
    `Glamour-to-casual level: ${input.capture.glamourLevel}.`,
    `Lighting/mood direction: ${input.identityPack.lightingMoodDirection}.`,
    `Realism target: ${input.identityPack.realismPolishLevel}; natural skin texture, true-to-life lighting, smartphone-photo authenticity.`,
    `Aesthetic context: ${input.companion.visual_aesthetic ?? 'premium romantic portrait aesthetic'}.`,
    'This companion must remain the same woman identity across all 3 total images in this set.',
    'Each slot must look like a different moment from her life, not alternate crops of the same scene.',
    'Do not repeat framing, camera angle, background, expression, or props from other slots.',
    'Must be meaningfully distinct from other variants in scene, framing, and styling while preserving the same identity.',
    'Keep dating-app appropriate, emotionally warm, and believable.',
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
  const captures = buildCapturePlan(input.companion);

  const prepared = [] as Array<{
    row: Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>;
  }>;

  for (const capture of captures) {
    const prompt = buildImagePrompt({
      companion: input.companion,
      identityPack,
      capture,
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
        lineage_metadata: {
          revisedPrompt: generated.revisedPrompt ?? null,
          continuityAnchors: identityPack.continuityAnchors,
          captureLabel: capture.label,
          captureMood: capture.mood,
          captureEnvironment: capture.environment,
        },
        moderation_status: 'pending',
        moderation: { provider: 'openai-image-default' },
        provenance: {
          generatedBy: 'openai:gpt-image-1',
          originalStorage: 'cloudflare_r2',
          delivery: 'cloudinary',
          generatedAt: new Date().toISOString(),
        },
        quality_score: 0.92,
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
    continuityNotes: 'Identity continuity anchored by profile pack with varied scene plans for non-duplicate gallery outcomes.',
    moderationStatus: 'pending',
    provenance: { generatedBy: 'openai:gpt-5-mini', phase: 'stage9-phase3-refinement' },
  });

  const imageRows = prepared.map((entry) => ({ ...entry.row, visual_profile_id: visualProfile.id }));
  const images = await insertCompanionImages(input.token, imageRows);

  return { visualProfile, images };
};
