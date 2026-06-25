import { describe, expect, it, vi } from 'vitest';
import { createChatReplyPacer } from '@/lib/virtual-girlfriend/chat-reply-pace';

describe('chat reply pacer', () => {
  it('waits before emitting the first character', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const emitted: string[] = [];
    const pacer = createChatReplyPacer((chunk) => emitted.push(chunk));

    pacer.push('Hi');
    expect(emitted).toEqual([]);

    await vi.advanceTimersByTimeAsync(900);
    expect(emitted.length).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    expect(emitted.join('')).toBe('Hi');
    vi.useRealTimers();
  });
});