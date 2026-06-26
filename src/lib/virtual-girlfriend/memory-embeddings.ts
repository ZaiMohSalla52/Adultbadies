import { env } from '@/lib/env';

export const VG_MEMORY_EMBEDDING_MODEL =
  process.env.VG_MEMORY_EMBEDDING_MODEL?.trim() || 'togethercomputer/m2-bert-80M-8k-retrieval';

const TOGETHER_EMBEDDINGS_URL = 'https://api.together.xyz/v1/embeddings';

export type MemoryEmbeddingMetadata = {
  embedding: number[];
  embeddingModel: string;
  embeddedAt: string;
};

export const memoryEmbeddingFromMetadata = (
  metadata: Record<string, unknown> | null | undefined,
): number[] | null => {
  const raw = metadata?.embedding;
  if (!Array.isArray(raw) || raw.length < 8) return null;
  const vector = raw.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return vector.length >= 8 ? vector : null;
};

export const buildMemoryEmbeddingText = (input: {
  memoryKey: string;
  memoryValue: string;
  summary?: string | null;
  category?: string | null;
}) => {
  const parts = [
    input.category ? `Category: ${input.category}` : null,
    input.summary?.trim() ? `Summary: ${input.summary.trim()}` : null,
    `Key: ${input.memoryKey}`,
    `Value: ${input.memoryValue}`,
  ].filter(Boolean);
  return parts.join('\n');
};

const normalizeVector = (vector: number[]) => {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm) || 1;
  return vector.map((value) => value / norm);
};

export const cosineSimilarityVectors = (left: number[], right: number[]) => {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index]! * right[index]!;
  }
  return dot;
};

export const embedMemoryTexts = async (texts: string[]): Promise<number[][]> => {
  const inputs = texts.map((text) => text.trim()).filter(Boolean);
  if (!inputs.length) return [];

  const apiKey = env.TOGETHER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY is not configured for memory embeddings.');
  }

  const response = await fetch(TOGETHER_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VG_MEMORY_EMBEDDING_MODEL,
      input: inputs,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Memory embedding request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };

  const rows = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return rows.map((row) => normalizeVector(row.embedding ?? []));
};

export const embedMemoryText = async (text: string) => {
  const [vector] = await embedMemoryTexts([text]);
  if (!vector?.length) {
    throw new Error('Memory embedding provider returned an empty vector.');
  }
  return vector;
};

export const buildMemoryEmbeddingMetadata = (vector: number[]): MemoryEmbeddingMetadata => ({
  embedding: vector,
  embeddingModel: VG_MEMORY_EMBEDDING_MODEL,
  embeddedAt: new Date().toISOString(),
});