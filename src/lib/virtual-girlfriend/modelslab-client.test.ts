import { describe, expect, it } from 'vitest';
import { isModelsLabRateLimitError } from './modelslab-client';

describe('modelslab-client', () => {
  it('detects ModelsLab rate limit errors', () => {
    expect(isModelsLabRateLimitError(new Error('ModelsLab portrait preview generation failed (flux-2-pro): Rate limit exceeded'))).toBe(true);
    expect(isModelsLabRateLimitError(new Error('HTTP 429'))).toBe(true);
    expect(isModelsLabRateLimitError(new Error('timeout'))).toBe(false);
  });
});