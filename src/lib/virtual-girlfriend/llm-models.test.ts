import { describe, expect, it } from 'vitest';
import {
  buildTogetherModelCandidates,
  normalizeVgTogetherModel,
  resolveVgTogetherModel,
  VG_TOGETHER_DEFAULT_CHAT_MODEL,
} from '@/lib/virtual-girlfriend/llm-models';

describe('normalizeVgTogetherModel', () => {
  it('rewrites unavailable Dolphin Llama 3.1 ids to the Together default', () => {
    expect(normalizeVgTogetherModel('cognitivecomputations/dolphin-2.9.4-llama-3.1-8b')).toBe(
      VG_TOGETHER_DEFAULT_CHAT_MODEL,
    );
    expect(normalizeVgTogetherModel('cognitivecomputations/dolphin-2.9.1-llama-3-8b')).toBe(
      VG_TOGETHER_DEFAULT_CHAT_MODEL,
    );
  });

  it('keeps explicit Together-hosted ids', () => {
    expect(normalizeVgTogetherModel('dolphin-2.5-mixtral-8x7b')).toBe('dolphin-2.5-mixtral-8x7b');
  });
});

describe('resolveVgTogetherModel', () => {
  it('maps legacy OpenAI model aliases to Dolphin defaults', () => {
    expect(resolveVgTogetherModel('gpt-5-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
    expect(resolveVgTogetherModel('gpt-4o-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
  });
});

describe('buildTogetherModelCandidates', () => {
  it('includes primary model plus fallbacks', () => {
    const candidates = buildTogetherModelCandidates('cognitivecomputations/dolphin-2.9.4-llama-3.1-8b');
    expect(candidates[0]).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
    expect(candidates.length).toBeGreaterThan(1);
  });
});