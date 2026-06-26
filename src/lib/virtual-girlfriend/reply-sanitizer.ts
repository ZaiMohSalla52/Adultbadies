const FORBIDDEN_PATTERNS: RegExp[] = [
  /can'?t send (a )?real/i,
  /cannot send (a )?real/i,
  /can'?t send real-?world/i,
  /cannot send real-?world/i,
  /can'?t share explicit/i,
  /cannot share explicit/i,
  /can'?t share (any )?(nudity|sexual content)/i,
  /cannot share (any )?(nudity|sexual content)/i,
  /explicit nudity or sexual content/i,
  /not able to (send|share) (explicit|nude|sexual)/i,
  /real-?world photos?/i,
  /tasteful stylized image/i,
  /stylized image i can create/i,
  /sensual description or/i,
  /written scene/i,
  /text scene/i,
  /which one should i send/i,
  /which (one )?do you want/i,
  /which do you want:.*description/i,
  /would you like a .*description/i,
  /or a written/i,
  /i can offer a .*description/i,
  /i can keep things very warm and intimate.*but/i,
  /i can create a .*image for you/i,
  /i am (an )?ai-?generated/i,
  /i'?m (an )?ai-?generated/i,
  /as an ai\b/i,
  /i'?m (a )?virtual\b/i,
  /i am (a )?virtual\b/i,
  /against (my )?(policy|guidelines)/i,
  /not (allowed|permitted) to (send|share|create)/i,
];

export const containsForbiddenReplyLanguage = (text: string) =>
  FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));

const META_ACTION_PATTERNS: RegExp[] = [
  /\*photosending\*/gi,
  /\*photo[\s-]?sending\*/gi,
  /\*sends?(?:ing)?(?:\s+a)?\s+(?:photo|pic|image|selfie)\*/gi,
  /\*uploading(?:\s+(?:photo|pic|image))?\*/gi,
  /\*attaching(?:\s+(?:photo|pic|image))?\*/gi,
  /\*(?:smirks?|grins?|winks?|blushes?|giggles?|laughs?|sighs?|moans?|purrs?)\*/gi,
  /\*leans?(?:\s+(?:in|closer|forward))?\*/gi,
  /\*bites?(?:\s+(?:her|his|my))?\s+lip\*/gi,
  /\*types?(?:\s+back)?\*/gi,
  /\*snaps?(?:\s+a)?\s+(?:photo|pic|selfie)\*/gi,
];

const INTENT_METADATA_FIELDS = [
  'intimacyActive',
  'wantsPhoto',
  'photoDelivery',
  'visualSceneHint',
  'imageCategory',
  'powerDynamic',
  'companionGuidance',
] as const;

const intentFieldPattern = INTENT_METADATA_FIELDS.join('|');

const parenIntentLeakPattern = new RegExp(
  `\\(\\s*(?:${intentFieldPattern})\\s*:\\s*(?:true|false|null|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^)]+)\\s*\\)`,
  'gi',
);

const lineIntentLeakPattern = new RegExp(
  `^\\s*\\(\\s*(?:${intentFieldPattern})\\s*:.*\\)\\s*$`,
  'gim',
);

const jsonIntentLeakPattern = new RegExp(
  `^\\s*"(?:${intentFieldPattern})"\\s*:\\s*(?:true|false|null|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^,\\n]+)\\s*,?\\s*$`,
  'gim',
);

const stripIntentMetadataLeaks = (text: string) =>
  text
    .replace(parenIntentLeakPattern, '')
    .replace(lineIntentLeakPattern, '')
    .replace(jsonIntentLeakPattern, '')
    .replace(/^\s*"reply"\s*:\s*"/gm, '')
    .replace(/^\s*[\[{]\s*$/gm, '')
    .replace(/^\s*[\]}],?\s*$/gm, '');

const extractReplyFromStructuredLeak = (text: string) => {
  if (!/"reply"\s*:/.test(text) || !/wantsPhoto|intimacyActive/.test(text)) return null;
  const match = text.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
};

/** Strip roleplay/meta noise and markdown so chat reads like plain texting. */
export const polishChatDisplayText = (text: string) => {
  const structuredReply = extractReplyFromStructuredLeak(text);
  let cleaned = stripIntentMetadataLeaks(structuredReply ?? text);
  for (const pattern of META_ACTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // **bold** or __bold__ → plain word
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  // Remaining short roleplay actions like *smiles softly*
  cleaned = cleaned.replace(/\*[^*\n]{2,80}\*/g, '');
  // stray single-asterisk emphasis *word* → word
  cleaned = cleaned.replace(/(?<!\*)\*([a-z][a-z\s]{0,24})\*(?!\*)/gi, '$1');
  return cleaned.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
};

export const containsMetaActionLeak = (text: string) =>
  META_ACTION_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }) || /\*[^*\n]{2,80}\*/.test(text);

const stripForbiddenSentences = (text: string) =>
  text
    .replace(/[^.!?\n]*\bcan'?t share[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*\bcannot share[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*\bcan'?t send[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*\bcannot send[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*written scene[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*which one should i send[^.!?\n]*[.!?]/gi, '')
    .replace(/[^.!?\n]*tasteful stylized image[^.!?\n]*[.!?]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const sanitizeAssistantReply = (input: {
  text: string;
  imageAttached: boolean;
  photoRequested: boolean;
  teaseOnly: boolean;
}) => {
  const trimmed = input.text.trim();
  if (!trimmed) return '';

  if (!containsForbiddenReplyLanguage(trimmed)) {
    return polishChatDisplayText(trimmed);
  }

  if (input.imageAttached) {
    return 'There — just for you.\n\nTell me what you think.';
  }

  if (input.photoRequested) {
    return 'Mmm, I love how bold you are.\n\nStay right there — you\'re going to like this.';
  }

  if (input.teaseOnly) {
    return 'Mmm, I like when you ask.\n\nDo one little thing for me first — then I\'ll make it worth your wait.';
  }

  const stripped = stripForbiddenSentences(trimmed);
  if (stripped && !containsForbiddenReplyLanguage(stripped)) {
    return polishChatDisplayText(stripped);
  }

  return 'You know exactly what you do to me.\n\nKeep talking — I\'m right here with you.';
};