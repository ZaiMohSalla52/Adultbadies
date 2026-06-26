import { describe, expect, it } from 'vitest';
import {
  buildMemoryEmbeddingText,
  cosineSimilarityVectors,
  memoryEmbeddingFromMetadata,
} from '@/lib/virtual-girlfriend/memory-embeddings';

describe('memory-embeddings', () => {
  it('builds stable embedding text from memory fields', () => {
    const text = buildMemoryEmbeddingText({
      memoryKey: 'user_fact_occupation_nurse',
      memoryValue: 'User works as a nurse',
      summary: 'Occupation',
      category: 'user_fact',
    });
    expect(text).toContain('User works as a nurse');
    expect(text).toContain('user_fact');
  });

  it('reads vectors from metadata', () => {
    const source = [1, 0, 0, 0, 0, 0, 0, 0];
    const vector = memoryEmbeddingFromMetadata({
      embedding: source,
      embeddingModel: 'test',
    });
    expect(vector).toEqual(source);
  });

  it('scores identical vectors at 1.0', () => {
    const vector = [0.6, 0.8];
    expect(cosineSimilarityVectors(vector, vector)).toBeCloseTo(1, 5);
  });
});