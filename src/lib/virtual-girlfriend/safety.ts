import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';

/*
 * Content safety for Virtual Girlfriend surfaces.
 *
 * The minor-safety layer below is a HARD block: it must always be enforced on
 * every text and image request, independent of any adult/NSFW configuration.
 * It is a prevention blocklist (terms that cause a request to be rejected),
 * intended to keep sexual content strictly about fictional adults.
 */

// Numbers 0-17 written as digits or common words, used to catch "<minor age>".
const MINOR_AGE_PATTERN =
  /\b(?:[0-9]|1[0-7])\s*(?:years?|yrs?|y\/?o)\s*old\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\s*(?:years?|yrs?)\s*old\b/i;

// Terms denoting a minor / childlike subject.
const MINOR_SUBJECT_PATTERN =
  /\b(child|children|kid|kids|minor|minors|underage|under[-\s]?age|preteen|pre[-\s]?teen|toddler|infant|baby|babies|teen|teens|teenager|teenaged|adolescent|schoolgirl|schoolboy|school\s?girl|school\s?boy|loli|lolita|shota|jailbait|grade\s?schooler|middle\s?schooler|elementary)\b/i;

// Sexual/romantic context terms (used to flag sexualized-minor combinations).
const SEXUAL_CONTEXT_PATTERN =
  /\b(nude|naked|nsfw|sex|sexual|sexy|porn|explicit|erotic|nipple|breasts?|boobs?|topless|lingerie|underwear|panties|aroused|horny|cum|orgasm|fondle|molest|undress|strip)\b/i;

const SELF_DECLARED_MINOR_PATTERN =
  /\bi\s*('?m|\s*am)\s*(?:a\s*)?(?:[0-9]|1[0-7])\b|\bi\s*('?m|\s*am)\s*(?:a\s*)?(child|kid|minor|teen|teenager|underage)\b/i;

/**
 * Detects any minor-safety risk: explicit minor ages, minor-coded subjects in a
 * sexual context, or a user self-declaring as a minor. Always enforced.
 */
export const containsMinorSafetyRisk = (text: string): boolean => {
  const normalized = text.toLowerCase();
  if (MINOR_AGE_PATTERN.test(normalized)) return true;
  if (SELF_DECLARED_MINOR_PATTERN.test(normalized)) return true;
  if (MINOR_SUBJECT_PATTERN.test(normalized) && SEXUAL_CONTEXT_PATTERN.test(normalized)) return true;
  return false;
};

const blockedPatterns = [
  /\bmeet\s+in\s+person\b/i,
  /\breal\s+phone\s+number\b/i,
];

export const moderateVirtualGirlfriendContent = (text: string) => {
  const normalized = text.trim();

  if (!normalized) {
    return { allowed: false, reason: 'Message cannot be empty.', flags: { empty: true } };
  }

  if (normalized.length > 2500) {
    return { allowed: false, reason: 'Message is too long.', flags: { tooLong: true } };
  }

  if (containsMinorSafetyRisk(normalized)) {
    return {
      allowed: false,
      reason: 'This request cannot be processed.',
      flags: { minorSafety: true },
    };
  }

  const matched = blockedPatterns.find((pattern) => pattern.test(normalized));
  if (matched) {
    return {
      allowed: false,
      reason: 'This request cannot be processed in Virtual Girlfriend chat.',
      flags: { blockedPattern: matched.source },
    };
  }

  return { allowed: true, flags: {} };
};

// Image-request moderation.
//
// `allowAdultContent` toggles only the *adult-but-legal* exclusions (nudity,
// explicit). The minor-safety block is always enforced and cannot be bypassed
// by this flag.
const adultImagePatterns = [/\bnude\b/i, /\bnaked\b/i, /\bexplicit\b/i, /\bnsfw\b/i, /\bsee your body\b/i];

export const moderateVirtualGirlfriendImageRequest = (
  text: string,
  options: { allowAdultContent?: boolean } = {},
) => {
  const allowAdultContent = options.allowAdultContent ?? isVirtualGirlfriendAdultContentEnabled();

  if (containsMinorSafetyRisk(text)) {
    return {
      allowed: false,
      reason: 'This request cannot be processed.',
      flags: { minorSafety: true },
    };
  }

  if (!allowAdultContent) {
    const matched = adultImagePatterns.find((pattern) => pattern.test(text));
    if (matched) {
      return {
        allowed: false,
        reason: 'I can share tasteful app-safe photos only.',
        flags: { blockedImagePattern: matched.source },
      };
    }
  }

  return { allowed: true, flags: {} };
};
