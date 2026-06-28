import { describe, expect, it } from 'vitest';
import { resolveVgLlmProvider } from '@/lib/virtual-girlfriend/llm-provider';

describe('resolveVgLlmProvider', () => {
  it('returns modelslab when MODELSLAB_API_KEY is set', () => {
    const priorKey = process.env.MODELSLAB_API_KEY;
    process.env.MODELSLAB_API_KEY = 'test-key';
    expect(resolveVgLlmProvider()).toBe('modelslab');
    if (priorKey === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorKey;
  });

  it('throws without MODELSLAB_API_KEY', () => {
    const priorKey = process.env.MODELSLAB_API_KEY;
    delete process.env.MODELSLAB_API_KEY;
    expect(() => resolveVgLlmProvider()).toThrow(/MODELSLAB_API_KEY/);
    if (priorKey === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorKey;
  });
});