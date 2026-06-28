import { describe, expect, it } from 'vitest';
import {
  dedupeMessageSegments,
  isNearDuplicateAssistantReply,
  splitAssistantReplyIntoSegments,
} from '@/lib/virtual-girlfriend/message-segments';

describe('message segments', () => {
  it('removes consecutive duplicate segments', () => {
    const segments = dedupeMessageSegments([
      'Cocky? I like it.',
      'Cocky? I like it.',
      'Fresh line.',
    ]);
    expect(segments).toEqual(['Cocky? I like it.', 'Fresh line.']);
  });

  it('splits and dedupes assistant replies', () => {
    const segments = splitAssistantReplyIntoSegments('Line one.\n\nLine one.\n\nLine two.');
    expect(segments).toEqual(['Line one.', 'Line two.']);
  });

  it('detects near-duplicate assistant turns', () => {
    const previous = "Cocky? I like it. Let's see how confident you get when I show you my red satin...";
    const next = "Cocky? I like it. Let's see how confident you get when I show you my red satin...";
    expect(isNearDuplicateAssistantReply(next, previous)).toBe(true);
    expect(isNearDuplicateAssistantReply('Totally different energy tonight.', previous)).toBe(false);
  });
});