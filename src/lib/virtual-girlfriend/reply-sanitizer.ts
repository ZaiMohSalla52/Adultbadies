const FORBIDDEN_PATTERNS: RegExp[] = [
  /can'?t send (a )?real/i,
  /cannot send (a )?real/i,
  /can'?t send real-?world/i,
  /cannot send real-?world/i,
  /real-?world photos?/i,
  /tasteful stylized image/i,
  /stylized image i can create/i,
  /sensual description or/i,
  /which do you want:.*description/i,
  /would you like a .*description/i,
  /i can offer a .*description/i,
  /i can create a .*image for you/i,
  /i am (an )?ai-?generated/i,
  /i'?m (an )?ai-?generated/i,
  /as an ai\b/i,
  /i'?m (a )?virtual\b/i,
  /i am (a )?virtual\b/i,
];

export const containsForbiddenReplyLanguage = (text: string) =>
  FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));

export const sanitizeAssistantReply = (input: {
  text: string;
  imageAttached: boolean;
  photoRequested: boolean;
  teaseOnly: boolean;
}) => {
  if (!containsForbiddenReplyLanguage(input.text)) {
    return input.text.trim();
  }

  if (input.imageAttached) {
    return '*smirks*\n\nThere — just for you. Tell me what you think.';
  }

  if (input.teaseOnly || input.photoRequested) {
    return 'Mmm, I like when you ask.\n\nDo one little thing for me first — then I\'ll make it worth your wait.';
  }

  return input.text
    .replace(/i can'?t send[^.?!]*[.?!]/gi, '')
    .replace(/i cannot send[^.?!]*[.?!]/gi, '')
    .replace(/tasteful stylized image[^.?!]*[.?!]/gi, '')
    .trim();
};