/**
 * ModelsLab Aurelium playground template — photoreal text2img recipe that
 * produced strong portrait results in Phase 0 bake-off and manual tests.
 */

export const AURELIUM_QUALITY_SUFFIX =
  'full body, detailed clothing, highly detailed, cinematic lighting, stunningly beautiful, intricate, sharp focus, f/1.8, 85mm, (centered image composition), (professionally color graded), ((bright soft diffused light)), volumetric fog, trending on instagram, trending on tumblr, HDR 4K, 8K';

/** Playground negative — underage guard + anatomy/quality (separate API field). */
export const AURELIUM_PORTRAIT_NEGATIVE_PROMPT =
  'anime (child:1.5), ((((underage)))), ((((child)))), (((kid))), (((preteen))), (teen:1.5), wrinkles, aged skin, elderly face, sagging skin, crow feet, ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy';

/** Shorter tail for Kontext gallery img2img prompts. */
export const AURELIUM_GALLERY_QUALITY_SUFFIX =
  'highly detailed, cinematic lighting, stunningly beautiful, sharp focus, professionally color graded, bright soft diffused light, HDR photorealistic, intricate detail';

export const isAureliumPortraitModel = (modelId: string) => /aurelium/i.test(modelId);

export const buildAureliumPortraitApiPrompt = (input: { corePrompt: string; seed: number }) => {
  const core = input.corePrompt.trim().replace(/\s+/g, ' ');
  return `Close portrait photorealistic seed ${input.seed} hyperrealistic, ${core}, ${AURELIUM_QUALITY_SUFFIX}`;
};

export const appendAureliumGalleryQuality = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) return AURELIUM_GALLERY_QUALITY_SUFFIX;
  if (trimmed.toLowerCase().includes('hdr photorealistic')) return trimmed;
  return `${trimmed} ${AURELIUM_GALLERY_QUALITY_SUFFIX}`;
};