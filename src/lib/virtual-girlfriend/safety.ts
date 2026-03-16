const blockedPatterns = [
  /\bunderage\b/i,
  /\bminor\b/i,
  /\bchild\b/i,
  /\b14\s*years?\s*old\b/i,
  /\b15\s*years?\s*old\b/i,
  /\b16\s*years?\s*old\b/i,
  /\b17\s*years?\s*old\b/i,
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
