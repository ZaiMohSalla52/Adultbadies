import { describe, expect, it } from 'vitest';
import { buildTogetherReasoningParams } from '@/lib/virtual-girlfriend/together';

describe('buildTogetherReasoningParams', () => {
  it('disables reasoning for DeepSeek minimal-effort chat turns', () => {
    expect(
      buildTogetherReasoningParams('deepseek-ai/DeepSeek-V4-Pro', { effort: 'minimal' }),
    ).toEqual({ reasoning: { enabled: false } });
  });

  it('maps medium effort to high reasoning for DeepSeek', () => {
    expect(
      buildTogetherReasoningParams('deepseek-ai/DeepSeek-V4-Pro', { effort: 'medium' }),
    ).toEqual({ reasoning_effort: 'high' });
  });

  it('maps max effort for DeepSeek proactive tasks', () => {
    expect(
      buildTogetherReasoningParams('deepseek-ai/DeepSeek-V4-Pro', { effort: 'max' }),
    ).toEqual({ reasoning_effort: 'max' });
  });

  it('skips reasoning params for non-DeepSeek fallbacks', () => {
    expect(buildTogetherReasoningParams('dolphin-2.5-mixtral-8x7b', { effort: 'minimal' })).toEqual(
      {},
    );
  });
});