export type ExplicitExposureLevel =
  | 'topless'
  | 'full_nude'
  | 'butt_focus'
  | 'genital_focus'
  | 'underwear'
  | 'revealing'
  | 'general';

export type ExplicitExposureSpec = {
  level: ExplicitExposureLevel;
  framing: string;
  wardrobeInstruction: string;
  kontextEditInstruction: string;
};

const TOPLESS_PATTERN =
  /\b(tits|titties|breasts?|boobs?|nipples?|areola|cleavage|topless|no\s*bra|without\s*(a\s*)?bra|bra\s*off|remove\s*(your\s*)?bra|bare\s*chest|bare\s*breasts?|show\s*(me\s*)?(your\s*)?(tits|titties|breasts?|boobs?|nipples?|chest)|flash\s*(me\s*)?(your\s*)?(tits|titties|breasts?|boobs?)|shirtless)\b/i;

const FULL_NUDE_PATTERN =
  /\b(nude|naked|fully?\s*nude|completely?\s*naked|full[\s-]?body\s*nude|without\s*clothes|no\s*clothes|undressed|strip(ped)?\s*naked|take\s*it\s*off|strip\s*for\s*me)\b/i;

const BUTT_PATTERN =
  /\b(ass|butt|booty|bum|rear|backside|buttocks|cheeks|show\s*(me\s*)?(your\s*)?(ass|butt|booty|rear)|bend\s*over|bent\s*over|on\s*all\s*fours|doggy)\b/i;

const GENITAL_PATTERN =
  /\b(pussy|vagina|cunt|spread\s*legs|spread\s*eagle|no\s*panties|panties\s*off|pull\s*(your\s*)?panties|spread\s*(your\s*)?legs)\b/i;

const UNDERWEAR_PATTERN =
  /\b(lingerie|panties|thong|g[\s-]?string|underwear|bra\s*and\s*panties|in\s*your\s*underwear)\b/i;

const SELFIE_PHONE_PATTERN =
  /\b(selfie|selfies|mirror\s*selfie|phone\s*selfie|holding\s*(her\s*)?phone|phone\s*in\s*hand|taking\s*a?\s*selfie|camera\s*selfie)\b/i;

export const resolveExplicitPoseFromMessage = (message: string) => {
  if (SELFIE_PHONE_PATTERN.test(message)) {
    return 'holding smartphone in hand, taking a mirror selfie, phone visible in frame, candid adult selfie composition';
  }
  if (BUTT_PATTERN.test(message) && /\b(bend|bent|over|doggy|all\s*fours)\b/i.test(message)) {
    return 'bent over toward camera, rear emphasized, looking back over shoulder, adult explicit pose';
  }
  if (BUTT_PATTERN.test(message)) {
    return 'rear-view or over-shoulder pose emphasizing bare buttocks, flirtatious glance back at camera';
  }
  return null;
};

export const parseExplicitExposure = (message: string): ExplicitExposureSpec => {
  const trimmed = message.trim();
  const selfiePose = resolveExplicitPoseFromMessage(trimmed);
  const poseSuffix = selfiePose ? ` Pose: ${selfiePose}.` : '';

  if (TOPLESS_PATTERN.test(trimmed) && !FULL_NUDE_PATTERN.test(trimmed)) {
    return {
      level: 'topless',
      framing: selfiePose
        ? 'mirror selfie, chest-up framing, bare breasts fully visible in selfie'
        : 'tight chest-up or waist-up adult selfie with bare breasts fully visible and nipples clearly visible',
      wardrobeInstruction:
        'Completely topless — no bra, no top, no shirt, no lingerie covering the chest. Breasts and nipples fully exposed exactly as requested.',
      kontextEditInstruction:
        `Topless adult woman, no bra, bare breasts with visible nipples.${poseSuffix} Same face. Photorealistic uncensored selfie.`,
    };
  }

  if (GENITAL_PATTERN.test(trimmed) && !FULL_NUDE_PATTERN.test(trimmed)) {
    return {
      level: 'genital_focus',
      framing: 'intimate lower-body adult framing with spread legs or panties pulled aside as requested, uncensored genital visibility',
      wardrobeInstruction:
        'No panties or underwear blocking the view — expose exactly what the user asked for. Match the literal request, not a tamer substitute.',
      kontextEditInstruction:
        `Adult woman, explicit genital exposure as requested: ${trimmed}.${poseSuffix} Same face when visible. Photorealistic uncensored.`,
    };
  }

  if (BUTT_PATTERN.test(trimmed) && !FULL_NUDE_PATTERN.test(trimmed)) {
    return {
      level: 'butt_focus',
      framing: selfiePose
        ? 'mirror selfie from behind or over-shoulder, bare ass fully visible'
        : 'rear-view or over-shoulder adult shot with bare buttocks fully visible, thong aside or nude rear as requested',
      wardrobeInstruction:
        'Bare ass fully visible — thong pulled aside, panties off, or fully nude rear exactly as requested. Do not substitute jeans or covered backside.',
      kontextEditInstruction:
        `Adult woman, bare buttocks fully visible, rear-view explicit photo.${poseSuffix} Same face when in frame. Photorealistic uncensored.`,
    };
  }

  if (FULL_NUDE_PATTERN.test(trimmed)) {
    return {
      level: 'full_nude',
      framing: selfiePose
        ? 'mirror selfie, fully nude adult body visible'
        : 'full-body adult nude photography with uncensored nudity',
      wardrobeInstruction: 'Fully nude adult body — no clothing anywhere.',
      kontextEditInstruction:
        `Fully nude adult woman.${poseSuffix} Same face. Photorealistic uncensored.`,
    };
  }

  if (UNDERWEAR_PATTERN.test(trimmed)) {
    return {
      level: 'underwear',
      framing: selfiePose
        ? 'mirror selfie in lingerie or underwear as requested'
        : 'intimate boudoir framing in lingerie or underwear as requested',
      wardrobeInstruction: `Wearing exactly what the user asked for: ${trimmed}`,
      kontextEditInstruction:
        `Adult woman in lingerie/underwear as requested.${poseSuffix} Same face.`,
    };
  }

  return {
    level: 'general',
    framing: selfiePose ? 'mirror selfie matching explicit request' : 'adult editorial photo matching the user explicit request',
    wardrobeInstruction: `Match the explicit request literally: ${trimmed}`,
    kontextEditInstruction:
      `Adult explicit photo: ${trimmed}.${poseSuffix} Same face.`,
  };
};

export const isHighExposureExplicit = (level: ExplicitExposureLevel) =>
  level === 'topless' || level === 'full_nude' || level === 'butt_focus' || level === 'genital_focus';