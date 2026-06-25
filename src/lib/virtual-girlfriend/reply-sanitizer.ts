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

const SMIRK_ACTION_PATTERN = /\*smirks?\*/gi;

const polishRoleplayActions = (text: string) => {
  const withoutSmirk = text.replace(SMIRK_ACTION_PATTERN, '').replace(/\n{3,}/g, '\n\n').trim();
  return withoutSmirk;
};

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
    return polishRoleplayActions(trimmed);
  }

  if (input.imageAttached) {
    return 'There — just for you.\n\nTell me what you think.';
  }

  if (input.photoRequested) {
    return 'Mmm, I love how bold you are.\n\nStay right there — I\'m sending you something.';
  }

  if (input.teaseOnly) {
    return 'Mmm, I like when you ask.\n\nDo one little thing for me first — then I\'ll make it worth your wait.';
  }

  const stripped = stripForbiddenSentences(trimmed);
  if (stripped && !containsForbiddenReplyLanguage(stripped)) {
    return polishRoleplayActions(stripped);
  }

  return 'You know exactly what you do to me.\n\nKeep talking — I\'m right here with you.';
};