import { describe, expect, it } from 'vitest';
import { resolveVgLlmProvider } from '@/lib/virtual-girlfriend/llm-provider';

describe('resolveVgLlmProvider', () => {
  it('prefers together when TOGETHER_API_KEY is set', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    const priorTogether = process.env.TOGETHER_API_KEY;
    const priorModelsLab = process.env.MODELSLAB_API_KEY;
    delete process.env.VG_LLM_PROVIDER;
    process.env.TOGETHER_API_KEY = 'test-together-key';
    process.env.MODELSLAB_API_KEY = 'test-modelslab-key';
    expect(resolveVgLlmProvider()).toBe('together');
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
    if (priorTogether === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorTogether;
    if (priorModelsLab === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorModelsLab;
  });

  it('honors explicit modelslab override', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    process.env.VG_LLM_PROVIDER = 'modelslab';
    process.env.TOGETHER_API_KEY = 'test-together-key';
    expect(resolveVgLlmProvider()).toBe('modelslab');
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
  });

  it('throws without TOGETHER_API_KEY or MODELSLAB_API_KEY', () => {
    const priorProvider = process.env.VG_LLM_PROVIDER;
    const priorTogether = process.env.TOGETHER_API_KEY;
    const priorModelsLab = process.env.MODELSLAB_API_KEY;
    delete process.env.VG_LLM_PROVIDER;
    delete process.env.TOGETHER_API_KEY;
    delete process.env.MODELSLAB_API_KEY;
    expect(() => resolveVgLlmProvider()).toThrow(/TOGETHER_API_KEY/);
    if (priorProvider === undefined) delete process.env.VG_LLM_PROVIDER;
    else process.env.VG_LLM_PROVIDER = priorProvider;
    if (priorTogether === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorTogether;
    if (priorModelsLab === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorModelsLab;
  });
});