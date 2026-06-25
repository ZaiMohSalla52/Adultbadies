import { describe, expect, it } from 'vitest';
import {
  buildModelsLabModelCandidates,
  buildTogetherModelCandidates,
  normalizeVgTogetherModel,
  resolveVgTogetherModel,
  VG_MODELSLAB_DEFAULT_CHAT_MODEL,
  VG_TOGETHER_DEFAULT_CHAT_MODEL,
  VG_TOGETHER_UNCENSORED_FALLBACK_MODEL,
} from '@/lib/virtual-girlfriend/llm-models';

describe('normalizeVgTogetherModel', () => {
  it('rewrites unavailable Dolphin Llama 3.1 ids to DeepSeek V4 Pro', () => {
    expect(normalizeVgTogetherModel('cognitivecomputations/dolphin-2.9.4-llama-3.1-8b')).toBe(
      VG_TOGETHER_DEFAULT_CHAT_MODEL,
    );
  });

  it('keeps DeepSeek V4 Pro id', () => {
    expect(normalizeVgTogetherModel('deepseek-ai/DeepSeek-V4-Pro')).toBe('deepseek-ai/DeepSeek-V4-Pro');
  });

  it('normalizes shorthand DeepSeek aliases', () => {
    expect(normalizeVgTogetherModel('DeepSeek-V4-Pro')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
  });
});

describe('resolveVgTogetherModel', () => {
  it('maps legacy OpenAI model aliases to the configured default', () => {
    expect(resolveVgTogetherModel('gpt-5-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
    expect(resolveVgTogetherModel('gpt-4o-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
  });
});

describe('buildTogetherModelCandidates', () => {
  it('includes DeepSeek primary plus uncensored and general fallbacks', () => {
    const candidates = buildTogetherModelCandidates('deepseek-ai/DeepSeek-V4-Pro');
    expect(candidates[0]).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
    expect(candidates).toContain(VG_TOGETHER_UNCENSORED_FALLBACK_MODEL);
    expect(candidates.length).toBeGreaterThan(1);
  });
});

describe('buildModelsLabModelCandidates', () => {
  it('includes uncensored-chat fallback after primary', () => {
    const candidates = buildModelsLabModelCandidates(VG_MODELSLAB_DEFAULT_CHAT_MODEL);
    expect(candidates[0]).toBe(VG_MODELSLAB_DEFAULT_CHAT_MODEL);
    expect(candidates).toContain('uncensored-chat');
  });
});