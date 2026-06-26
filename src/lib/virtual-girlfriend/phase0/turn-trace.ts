import fs from 'node:fs/promises';
import path from 'node:path';

import type { ChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';
import type { ChatTurnIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import type {
  VirtualGirlfriendChatImageOutcome,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMemoryRecord,
} from '@/lib/virtual-girlfriend/types';

export type VirtualGirlfriendTurnTrace = {
  schemaVersion: 1;
  traceId: string;
  recordedAt: string;
  userId: string;
  companionId: string;
  conversationId: string;
  assistantMessageId?: string;
  isPremium: boolean;
  timingsMs: {
    total?: number;
    llm?: number;
    image?: number;
  };
  llm: {
    model: string | null;
    ok: boolean;
    refusalSanitized?: boolean;
  };
  intent: {
    photoRequested: boolean;
    explicitPhotoRequest: boolean;
    heuristicLocked: boolean;
    wantsPhoto?: boolean;
    photoDelivery?: string;
    imageCategory?: VirtualGirlfriendImageCategory;
    visualSceneHint?: string | null;
  };
  image: {
    started: boolean;
    expectedRoute?: Pick<ChatGenerationRoute, 'provider' | 'modelKind'>;
    outcome: VirtualGirlfriendChatImageOutcome;
    reason: string | null;
    source: string | null;
    imageId: string | null;
  };
  memory: {
    retrievedCount: number;
    retrievedIds: string[];
    categories: string[];
  };
  flags: string[];
};

export const isTurnTraceEnabled = () => {
  const flag = process.env.VG_TURN_TRACE_ENABLED?.trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  return process.env.NODE_ENV !== 'production';
};

export const resolveTurnTracePath = () => {
  const configured = process.env.VG_TURN_TRACE_PATH?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'logs/vg-turn-traces.jsonl');
};

export const summarizeRetrievedMemories = (memories: VirtualGirlfriendMemoryRecord[]) => ({
  retrievedCount: memories.length,
  retrievedIds: memories.map((memory) => memory.id),
  categories: [...new Set(memories.map((memory) => memory.category))],
});

export const buildTurnTraceIntent = (input: {
  photoRequested: boolean;
  explicitPhotoRequest: boolean;
  heuristicLocked: boolean;
  intent?: ChatTurnIntent;
}) => ({
  photoRequested: input.photoRequested,
  explicitPhotoRequest: input.explicitPhotoRequest,
  heuristicLocked: input.heuristicLocked,
  wantsPhoto: input.intent?.wantsPhoto,
  photoDelivery: input.intent?.photoDelivery,
  imageCategory: input.intent?.imageCategory,
  visualSceneHint: input.intent?.visualSceneHint ?? null,
});

let appendQueue: Promise<void> = Promise.resolve();

export const appendTurnTrace = async (trace: VirtualGirlfriendTurnTrace) => {
  if (!isTurnTraceEnabled()) return;

  const filePath = resolveTurnTracePath();
  const line = `${JSON.stringify(trace)}\n`;

  appendQueue = appendQueue.then(async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, line, 'utf8');
  });

  await appendQueue;
};