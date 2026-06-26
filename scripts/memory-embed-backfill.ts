#!/usr/bin/env tsx
/**
 * Backfill pending memory embeddings for semantic retrieval.
 *
 * Usage:
 *   npm run memory:embed-backfill
 */

import path from 'node:path';

import { loadLocalEnv } from './load-local-env';
import { listVirtualGirlfriendMemoriesPendingEmbedding } from '../src/lib/virtual-girlfriend/data';
import {
  buildMemoryEmbeddingMetadata,
  buildMemoryEmbeddingText,
  embedMemoryText,
} from '../src/lib/virtual-girlfriend/memory-embeddings';
import { requireServiceRoleKey, adminSupabaseRest } from '../src/lib/virtual-girlfriend/phase0/admin-rest';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));

const main = async () => {
  const token = requireServiceRoleKey();
  const pending = await listVirtualGirlfriendMemoriesPendingEmbedding(token, { limit: 100 });
  console.log(`Pending memory embeddings: ${pending.length}`);

  let ready = 0;
  let failed = 0;

  for (const memory of pending) {
    try {
      const vector = await embedMemoryText(
        buildMemoryEmbeddingText({
          memoryKey: memory.memory_key,
          memoryValue: memory.memory_value,
          summary: memory.summary,
          category: memory.category,
        }),
      );

      await adminSupabaseRest('ai_memories', {
        method: 'PATCH',
        searchParams: new URLSearchParams({
          id: `eq.${memory.id}`,
          user_id: `eq.${memory.user_id}`,
        }),
        body: {
          metadata: {
            ...(memory.metadata ?? {}),
            ...buildMemoryEmbeddingMetadata(vector),
          },
          embedding_status: 'ready',
        },
        prefer: 'return=minimal',
      });
      ready += 1;
      console.log(`✓ ${memory.memory_key}`);
    } catch (error) {
      failed += 1;
      console.warn(`✗ ${memory.memory_key}`, error instanceof Error ? error.message : error);
      await adminSupabaseRest('ai_memories', {
        method: 'PATCH',
        searchParams: new URLSearchParams({
          id: `eq.${memory.id}`,
          user_id: `eq.${memory.user_id}`,
        }),
        body: { embedding_status: 'failed' },
        prefer: 'return=minimal',
      });
    }
  }

  console.log(`Done. ready=${ready} failed=${failed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});