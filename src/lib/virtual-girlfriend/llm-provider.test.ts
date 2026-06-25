import { describe, expect, it } from 'vitest';
import { resolveVgLlmProvider } from '@/lib/virtual-girlfriend/llm-provider';

describe('resolveVgLlmProvider', () => {
  it('prefers modelslab when MODELSLAB_API_KEY is set and provider unset', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    const priorKey = process.env.MODELSLAB_API_KEY;
    delete process.env.VG_LLM_PROVIDER;
    process.env.MODELSLAB_API_KEY = 'test-key';
    expect(resolveVgLlmProvider()).toBe('modelslab');
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
    if (priorKey === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorKey;
  });

  it('honors explicit together override even with modelslab key', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    process.env.VG_LLM_PROVIDER = 'together';
    process.env.MODELSLAB_API_KEY = 'test-key';
    expect(resolveVgLlmProvider()).toBe('together');
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
  });

  it('falls back to together without modelslab key', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    const priorKey = process.env.MODELSLAB_API_KEY;
    delete process.env.VG_LLM_PROVIDER;
    delete process.env.MODELSLAB_API_KEY;
    expect(resolveVgLlmProvider()).toBe('together');
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
    if (priorKey === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorKey;
  });
});