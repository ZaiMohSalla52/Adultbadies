import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import {
  parseExplicitExposure,
  resolveExplicitPoseFromMessage,
  type ExplicitExposureLevel,
} from '@/lib/virtual-girlfriend/explicit-exposure';
import {
  pickSurpriseWardrobeForCompanion,
  pickWardrobeForCompanion,
  type WardrobeContext,
} from '@/lib/virtual-girlfriend/companion-wardrobe';
import { getOutfitPresetsForSex } from '@/lib/virtual-girlfriend/outfit-presets';
import type { VirtualGirlfriendImageCategory } from '@/lib/virtual-girlfriend/types';

export type PhotoGenerationSpec = {
  sceneDirective: string;
  wardrobe: string;
  pose: string;
  location: string;
  lighting: string;
  framing: string;
  explicit: boolean;
  exposureLevel: ExplicitExposureLevel | null;
  requestedLook: boolean;
  imageCategory: VirtualGirlfriendImageCategory;
  matchedPresetId: string | null;
};

const PRESET_KEYWORDS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'bikini', pattern: /\b(bikini|swimsuit|beach|pool)\b/i },
  { id: 'lingerie', pattern: /\b(lingerie|lace|bra\s*and\s*panties|underwear set)\b/i },
  { id: 'bodysuit', pattern: /\b(bodysuit|body\s*suit|catsuit)\b/i },
  { id: 'sheer', pattern: /\b(sheer|see[- ]?through|transparent)\b/i },
  { id: 'gym', pattern: /\b(gym|workout|yoga|leggings|sports\s*bra)\b/i },
  { id: 'cozy', pattern: /\b(cozy|at[- ]?home|robe|oversized\s*shirt|loungewear)\b/i },
  { id: 'casual', pattern: /\b(casual|jeans|crop\s*top|daytime)\b/i },
  { id: 'date-night', pattern: /\b(date\s*night|evening\s*dress|dinner\s*date)\b/i },
  { id: 'shirtless', pattern: /\b(shirtless|topless|bare\s*chest|no\s*shirt)\b/i },
  { id: 'underwear', pattern: /\b(underwear|boxer|briefs|trunks)\b/i },
  { id: 'suit', pattern: /\b(suit|tux|formal)\b/i },
  { id: 'towel', pattern: /\b(towel|post[- ]?shower|after\s*shower)\b/i },
  { id: 'leather', pattern: /\b(leather|biker|edgy)\b/i },
  { id: 'selfie', pattern: /\b(selfie|selfies|mirror\s*selfie)\b/i },
  { id: 'surprise', pattern: /\b(surprise|new\s*look|something\s*different)\b/i },
];

const LOCATIONS = [
  'in a sunlit modern apartment',
  'in a luxury hotel suite with floor-to-ceiling windows',
  'on a rooftop terrace at golden hour',
  'in a cozy bedroom with warm morning light',
  'at a stylish pool or beach setting',
  'in a moody boudoir with soft lamp light',
  'in a gym mirror with bright athletic lighting',
];

const POSES = [
  'confident direct eye contact',
  'playful over-the-shoulder glance',
  'mirror selfie with phone in hand',
  'relaxed seated pose with natural candid energy',
  'standing pose emphasizing curves and posture',
  'intimate close framing with flirtatious expression',
];

const LIGHTING = [
  'warm golden-hour natural light',
  'soft window light with shallow depth of field',
  'dim intimate candlelit glow',
  'bright candid daylight',
  'moody backlit silhouette with rim light',
];

const FRAMING = [
  'waist-up selfie framing',
  'three-quarter body shot',
  'tight portrait with environmental context',
  'full mirror selfie composition',
];

const choose = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const resolvePresetMatch = (message: string, context: WardrobeContext) => {
  const normalized = message.trim().toLowerCase();
  const presets = getOutfitPresetsForSex(context.sex);

  const exact = presets.find((preset) => preset.message.toLowerCase() === normalized);
  if (exact) return exact;

  const keywordId = PRESET_KEYWORDS.find((entry) => entry.pattern.test(message))?.id;
  if (keywordId) {
    const keywordPreset = presets.find((preset) => preset.id === keywordId);
    if (keywordPreset) return keywordPreset;
  }

  return null;
};

const inferCategory = (message: string, explicit: boolean, presetId: string | null): VirtualGirlfriendImageCategory => {
  if (explicit) return 'indoor';
  if (presetId === 'gym') return 'lifestyle';
  if (presetId === 'selfie') return 'selfie';
  if (/\b(outfit|wear|wearing|dress|look)\b/i.test(message)) return 'outfit';
  if (/\b(night|club|bar|date)\b/i.test(message)) return 'night-out';
  return 'selfie';
};

const buildExplicitDirective = (message: string) => {
  const exposure = parseExplicitExposure(message);
  const forcedPose = resolveExplicitPoseFromMessage(message);
  return [
    exposure.kontextEditInstruction,
    `User request: "${message.trim()}".`,
    exposure.wardrobeInstruction,
    `Framing: ${exposure.framing}.`,
    forcedPose ? `Pose: ${forcedPose}.` : `Pose: ${choose(POSES)}.`,
    `Setting: ${choose(LOCATIONS)}.`,
    `Lighting: ${choose(LIGHTING)}.`,
    'Do not substitute lingerie, bikini, or modest clothing when the user asked for nudity or topless.',
    'Same face and identity — brand new explicit shot, not a recycled profile portrait.',
  ].join(' ');
};

/** Face Gen defaults — API caps width at 512 and height at 768. */
export const FACE_GEN_MAX_WIDTH = 512;
export const FACE_GEN_MAX_HEIGHT = 768;

export const FACE_GEN_BASE_NEGATIVE_PROMPT =
  'drawing, cartoon, anime, big nose, long nose, fat, ugly, bad anatomy, worst quality, low quality, blurry, censored, black bar, mosaic, watermark, text, logo';

export const FACE_GEN_CROP_NEGATIVE_PROMPT =
  'headshot only, face only, bust shot, cropped at chest, cropped at shoulders, cropped at waist, cropped at hips, cropped at thighs, cropped at knees, cut off body, cut off at hips, cut off at thighs, missing legs, legs out of frame, lower body out of frame, thighs cropped, hips cropped, no feet, no knees, portrait close-up only, no full body, shoulders only, torso only, upper body only';

export type FaceGenExplicitParams = {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  sScale: number;
  guidanceScale: number;
  wideFraming: boolean;
};

const resolveFaceGenSubject = (context: WardrobeContext) =>
  context.sex?.trim().toLowerCase() === 'male' ? 'man' : 'woman';

export type FaceGenExplicitOptions = {
  /** Second attempt after body-crop detection — zoom out further and loosen face lock. */
  wideFraming?: boolean;
};

/** Face Gen API params — composition-first prompts; lower s_scale frees body from face lock. */
export const resolveFaceGenExplicitParams = (
  message: string,
  context: WardrobeContext = {},
  options: FaceGenExplicitOptions = {},
): FaceGenExplicitParams => {
  const exposure = parseExplicitExposure(message);
  const forcedPose = resolveExplicitPoseFromMessage(message);
  const subject = resolveFaceGenSubject(context);
  const trimmed = message.trim();
  const wide = options.wideFraming ?? false;
  const wideLead = wide ? 'Extreme wide shot, camera pulled back, zoomed out, ' : 'Wide shot, zoomed out, ';

  let compositionLead: string;
  let sScale: number;

  switch (exposure.level) {
    case 'full_nude':
      compositionLead = forcedPose
        ? `${wideLead}mirror selfie of a fully nude adult ${subject}, naked body visible from face through feet on floor, knees and legs fully in frame, no clothing anywhere, nipples visible.`
        : `${wideLead}full-length photograph of a fully nude adult ${subject}, entire naked body visible head to toe including feet and knees in frame, standing facing camera, breasts with nipples visible, uncensored.`;
      sScale = wide ? 0.42 : 0.55;
      break;
    case 'topless':
      compositionLead = `${wide ? wideLead : ''}Three-quarter photograph of adult ${subject}, topless with bare breasts and nipples fully visible down to waist, no bra no shirt no crop top.`;
      sScale = wide ? 0.58 : 0.68;
      break;
    case 'butt_focus':
      compositionLead = `${wideLead}rear-view photograph of nude adult ${subject}, bare buttocks fully visible, legs and knees in frame down to feet, no jeans no pants, over-shoulder glance at camera.`;
      sScale = wide ? 0.4 : 0.52;
      break;
    case 'genital_focus':
      compositionLead = `${wideLead}full-body nude photograph of adult ${subject}, explicit lower-body framing with spread legs and feet visible, no underwear blocking view.`;
      sScale = wide ? 0.42 : 0.55;
      break;
    default:
      compositionLead = `${wide ? wideLead : ''}Adult explicit photograph of ${subject}, ${exposure.wardrobeInstruction}`;
      sScale = wide ? 0.5 : 0.62;
  }

  const prompt = [
    compositionLead,
    forcedPose && !compositionLead.toLowerCase().includes(forcedPose.slice(0, 12).toLowerCase())
      ? forcedPose
      : null,
    wide ? 'Full body must fit in frame with empty space above head and below feet.' : null,
    `User request: "${trimmed}".`,
    'Photorealistic uncensored adult photography, same face as reference.',
  ]
    .filter(Boolean)
    .join(' ');

  const negativePrompt = [
    FACE_GEN_BASE_NEGATIVE_PROMPT,
    FACE_GEN_CROP_NEGATIVE_PROMPT,
    'clothed, dressed, shirt, bra, crop top, jeans, pants, underwear, covered chest, covered breasts',
  ].join(', ');

  return {
    prompt,
    negativePrompt,
    width: FACE_GEN_MAX_WIDTH,
    height: FACE_GEN_MAX_HEIGHT,
    sScale,
    guidanceScale: 7.5,
    wideFraming: wide,
  };
};

/** Compact prompt for ModelsLab Face Gen — matches playground style, not Kontext essay prompts. */
export const buildFaceGenExplicitPrompt = (message: string, context: WardrobeContext = {}) =>
  resolveFaceGenExplicitParams(message, context).prompt;

/** Face Gen prompt for any in-chat photo (explicit or outfit/scene). */
export const buildFaceGenChatPrompt = (message: string, context: WardrobeContext = {}) => {
  const spec = resolvePhotoGenerationSpec(message, context);
  if (spec.explicit) {
    return buildFaceGenExplicitPrompt(message, context);
  }

  const trimmed = message.trim();
  return [
    `Photorealistic adult photo of the same woman as the reference face.`,
    `User request: "${trimmed}".`,
    spec.wardrobe ? `Wardrobe: ${spec.wardrobe}.` : null,
    `Scene: ${spec.location}.`,
    `Pose: ${spec.pose}.`,
    `Lighting: ${spec.lighting}.`,
    `Framing: ${spec.framing}.`,
    'Change outfit, pose, and setting to match the request. Same face identity lock.',
  ]
    .filter(Boolean)
    .join(' ');
};

const buildPresetDirective = (sceneHint: string, wardrobe: string) =>
  [
    sceneHint,
    `Wardrobe must be: ${wardrobe}.`,
    `Pose: ${choose(POSES)}.`,
    `Setting: ${choose(LOCATIONS)}.`,
    `Lighting: ${choose(LIGHTING)}.`,
    'Honor the requested outfit and scene even if the reference portrait shows different clothing.',
    'Same face and identity lock.',
  ].join(' ');

const buildFreeformDirective = (message: string, context: WardrobeContext) => {
  const wardrobe = /\b(wear|wearing|outfit|dress|bikini|lingerie|shirtless|suit|gym)\b/i.test(message)
    ? message.trim()
    : pickWardrobeForCompanion(context);

  return [
    `In-chat photo matching what the user asked for: "${message.trim()}".`,
    `Wardrobe: ${wardrobe}.`,
    `Pose: ${choose(POSES)}.`,
    `Setting: ${choose(LOCATIONS)}.`,
    `Lighting: ${choose(LIGHTING)}.`,
    `Framing: ${choose(FRAMING)}.`,
    'Change wardrobe, pose, and setting to match the request — do not reuse the reference outfit.',
    'Preserve exact same face and identity.',
  ].join(' ');
};

export const resolvePhotoGenerationSpec = (
  userMessage: string,
  context: WardrobeContext = {},
): PhotoGenerationSpec => {
  const trimmed = userMessage.trim();
  const explicit = detectExplicitImageIntent(trimmed);
  const preset = resolvePresetMatch(trimmed, context);
  const surprise = preset?.id === 'surprise' || /\bsurprise\b/i.test(trimmed);

  const wardrobeLine = preset
    ? preset.sceneHint
    : surprise
      ? pickSurpriseWardrobeForCompanion(context)
      : pickWardrobeForCompanion(context);

  const exposureLevel = explicit ? parseExplicitExposure(trimmed).level : null;

  const sceneDirective = explicit
    ? buildExplicitDirective(trimmed)
    : preset
      ? buildPresetDirective(preset.sceneHint, wardrobeLine)
      : buildFreeformDirective(trimmed, context);

  return {
    sceneDirective,
    wardrobe: wardrobeLine,
    pose: choose(POSES),
    location: choose(LOCATIONS),
    lighting: choose(LIGHTING),
    framing: choose(FRAMING),
    explicit,
    exposureLevel,
    requestedLook: true,
    imageCategory: inferCategory(trimmed, explicit, preset?.id ?? null),
    matchedPresetId: preset?.id ?? null,
  };
};

export const formatPhotoSceneHint = (spec: PhotoGenerationSpec) => spec.sceneDirective;