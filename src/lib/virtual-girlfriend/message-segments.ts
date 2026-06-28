const normalizeSegment = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const dedupeMessageSegments = (segments: string[]): string[] => {
  const deduped: string[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const normalized = normalizeSegment(trimmed);
    const last = deduped[deduped.length - 1];
    if (last && normalizeSegment(last) === normalized) continue;

    deduped.push(trimmed);
  }

  return deduped;
};

export const splitAssistantReplyIntoSegments = (text: string, maxSegments = 3): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let parts = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    parts = trimmed.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  }
  if (parts.length === 1 && parts[0].length > 220) {
    const sentences = parts[0].match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? parts;
    if (sentences.length > 1) {
      const mid = Math.ceil(sentences.length / 2);
      parts = [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')];
    }
  }

  return dedupeMessageSegments(parts.slice(0, maxSegments));
};

export const wordOverlapRatio = (left: string, right: string) => {
  const a = normalizeSegment(left);
  const b = normalizeSegment(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aw = new Set(a.split(' ').filter(Boolean));
  const bw = new Set(b.split(' ').filter(Boolean));
  if (!aw.size || !bw.size) return 0;

  let intersection = 0;
  for (const word of aw) {
    if (bw.has(word)) intersection += 1;
  }

  const union = new Set([...aw, ...bw]).size;
  return union > 0 ? intersection / union : 0;
};

/** True when a new reply is effectively the same as the prior assistant turn. */
export const isNearDuplicateAssistantReply = (next: string, previous: string) => {
  const normalizedNext = normalizeSegment(next);
  const normalizedPrevious = normalizeSegment(previous);
  if (!normalizedNext || !normalizedPrevious) return false;
  if (normalizedNext === normalizedPrevious) return true;
  if (
    normalizedNext.length >= 24
    && normalizedPrevious.length >= 24
    && (normalizedNext.includes(normalizedPrevious) || normalizedPrevious.includes(normalizedNext))
  ) {
    return true;
  }

  return wordOverlapRatio(next, previous) >= 0.82;
};