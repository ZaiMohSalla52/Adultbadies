export type ExplicitExposureLevel = 'topless' | 'full_nude' | 'underwear' | 'revealing' | 'general';

export type ExplicitExposureSpec = {
  level: ExplicitExposureLevel;
  framing: string;
  wardrobeInstruction: string;
  kontextEditInstruction: string;
};

const TOPLESS_PATTERN =
  /\b(tits|titties|breasts?|boobs?|nipples?|areola|cleavage|topless|topless|no\s*bra|without\s*(a\s*)?bra|bra\s*off|remove\s*(your\s*)?bra|bare\s*chest|bare\s*breasts?|show\s*(me\s*)?(your\s*)?(tits|titties|breasts?|boobs?|nipples?|chest)|flash\s*(me\s*)?(your\s*)?(tits|titties|breasts?|boobs?))\b/i;

const FULL_NUDE_PATTERN =
  /\b(fully?\s*nude|completely?\s*naked|full[\s-]?body\s*nude|without\s*clothes|no\s*clothes|undressed|strip(ped)?\s*naked)\b/i;

const UNDERWEAR_PATTERN =
  /\b(lingerie|panties|thong|g[\s-]?string|underwear|bra\s*and\s*panties|in\s*your\s*underwear)\b/i;

export const parseExplicitExposure = (message: string): ExplicitExposureSpec => {
  const trimmed = message.trim();

  if (TOPLESS_PATTERN.test(trimmed)) {
    return {
      level: 'topless',
      framing: 'tight chest-up or waist-up adult selfie with bare breasts fully visible and nipples clearly visible',
      wardrobeInstruction:
        'Completely topless — no bra, no top, no shirt, no lingerie covering the chest. Breasts and nipples fully exposed exactly as requested.',
      kontextEditInstruction:
        'Edit this image: remove her top and bra completely. Bare breasts with visible nipples. Do not cover with lingerie, hands, or hair. Keep the exact same face.',
    };
  }

  if (FULL_NUDE_PATTERN.test(trimmed)) {
    return {
      level: 'full_nude',
      framing: 'full-body adult nude photography with uncensored nudity',
      wardrobeInstruction: 'Fully nude adult body — no clothing anywhere.',
      kontextEditInstruction:
        'Edit this image: remove all clothing for a fully nude adult shot. Keep the exact same face and identity.',
    };
  }

  if (UNDERWEAR_PATTERN.test(trimmed)) {
    return {
      level: 'underwear',
      framing: 'intimate boudoir framing in lingerie or underwear as requested',
      wardrobeInstruction: `Wearing exactly what the user asked for: ${trimmed}`,
      kontextEditInstruction:
        'Edit this image: change her outfit to match the user underwear/lingerie request. Keep the exact same face.',
    };
  }

  return {
    level: 'general',
    framing: 'adult editorial photo matching the user explicit request',
    wardrobeInstruction: `Match the explicit request literally: ${trimmed}`,
    kontextEditInstruction:
      'Edit this image to match the user explicit adult request. Change outfit and framing as needed. Keep the exact same face.',
  };
};

export const isHighExposureExplicit = (level: ExplicitExposureLevel) =>
  level === 'topless' || level === 'full_nude';