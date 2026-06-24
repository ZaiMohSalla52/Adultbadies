import { describe, expect, it } from 'vitest';
import { resolveVgTogetherModel } from '@/lib/virtual-girlfriend/llm-models';

describe('resolveVgTogetherModel', () => {
  it('maps legacy OpenAI model aliases to Together Dolphin defaults', () => {
    expect(resolveVgTogetherModel('gpt-5-mini')).toContain('dolphin');
    expect(resolveVgTogetherModel('gpt-4o-mini')).toContain('dolphin');
  });

  it('passes through explicit Together model ids', () => {
    expect(resolveVgTogetherModel('cognitivecomputations/dolphin-2.9.4-llama-3.1-8b')).toBe(
      'cognitivecomputations/dolphin-2.9.4-llama-3.1-8b',
    );
  });
});