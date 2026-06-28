import { describe, expect, it, vi } from 'vitest';
import {
  computeSegmentPauseMs,
  computeThinkDelayMs,
  createChatReplyPacer,
} from '@/lib/virtual-girlfriend/chat-reply-pace';

describe('chat reply pacer', () => {
  it('waits before emitting the first character', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const emitted: string[] = [];
    const pacer = createChatReplyPacer((chunk) => emitted.push(chunk));

    pacer.push('Hi');
    expect(emitted).toEqual([]);

    await vi.advanceTimersByTimeAsync(500);
    expect(emitted.length).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    expect(emitted.join('')).toBe('Hi');
    vi.useRealTimers();
  });

  it('uses longer delays after sentence-ending punctuation', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const emitted: string[] = [];
    const pacer = createChatReplyPacer((chunk) => emitted.push(chunk), { thinkMs: 0 });

    pacer.push('Hi.');
    await vi.runAllTimersAsync();
    expect(emitted.join('')).toBe('Hi.');
    vi.useRealTimers();
  });

  it('exposes human-like pause helpers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(computeThinkDelayMs()).toBeGreaterThanOrEqual(500);
    expect(computeSegmentPauseMs()).toBeGreaterThanOrEqual(1200);
    vi.restoreAllMocks();
  });
});