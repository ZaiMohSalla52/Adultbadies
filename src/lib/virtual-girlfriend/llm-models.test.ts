import { describe, expect, it } from 'vitest';
import {
  normalizeVgTogetherModel,
  resolveModelsLabChatModel,
  resolveVgTogetherModel,
  VG_MODELSLAB_CHAT_TEMPERATURE,
  VG_MODELSLAB_DEFAULT_CHAT_MODEL,
  VG_TOGETHER_DEFAULT_CHAT_MODEL,
  VG_TOGETHER_UNCENSORED_FALLBACK_MODEL,
} from '@/lib/virtual-girlfriend/llm-models';

describe('normalizeVgTogetherModel', () => {
  it('rewrites legacy Dolphin ids to Hermes DPO', () => {
    expect(normalizeVgTogetherModel('cognitivecomputations/dolphin-2.9.4-llama-3.1-8b')).toBe(
      VG_TOGETHER_DEFAULT_CHAT_MODEL,
    );
    expect(normalizeVgTogetherModel('uncensored-chat')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
  });

  it('keeps DeepSeek V4 Pro id', () => {
    expect(normalizeVgTogetherModel('deepseek-ai/DeepSeek-V4-Pro')).toBe('deepseek-ai/DeepSeek-V4-Pro');
  });

  it('normalizes shorthand DeepSeek aliases', () => {
    expect(normalizeVgTogetherModel('DeepSeek-V4-Pro')).toBe('deepseek-ai/DeepSeek-V4-Pro');
  });
});

describe('resolveVgTogetherModel', () => {
  it('maps legacy OpenAI model aliases to active together models', () => {
    expect(resolveVgTogetherModel('gpt-5-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
    expect(resolveVgTogetherModel('gpt-4o-mini')).toBe(VG_TOGETHER_DEFAULT_CHAT_MODEL);
  });

  it('defaults chat and fast models to Hermes DPO', () => {
    expect(VG_TOGETHER_DEFAULT_CHAT_MODEL).toBe('NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO');
  });
});

describe('resolveModelsLabChatModel', () => {
  it('returns a single configured model with no fallback chain', () => {
    expect(resolveModelsLabChatModel()).toBe(VG_MODELSLAB_DEFAULT_CHAT_MODEL);
    expect(resolveModelsLabChatModel('uncensored-chat')).toBe('uncensored-chat');
  });

  it('uses a stable chat temperature default', () => {
    expect(VG_MODELSLAB_CHAT_TEMPERATURE).toBeLessThan(0.8);
  });
});

describe('legacy together fallbacks remain for non-chat helpers', () => {
  it('still exposes uncensored together fallback constant for deprecated paths', () => {
    expect(VG_TOGETHER_UNCENSORED_FALLBACK_MODEL).toBeTruthy();
  });
});