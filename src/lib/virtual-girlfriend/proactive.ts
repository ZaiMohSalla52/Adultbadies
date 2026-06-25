import {
  createVirtualGirlfriendProactiveEvent,
  getLatestDeliveredVirtualGirlfriendProactiveEvent,
  getLatestVirtualGirlfriendConversation,
  getOrCreateVirtualGirlfriendConversation,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionImages,
  getVirtualGirlfriendMessages,
  insertVirtualGirlfriendMessageReturningId,
  listDueVirtualGirlfriendProactiveEvents,
  listPendingVirtualGirlfriendProactiveEvents,
  markVirtualGirlfriendProactiveEventStatus,
  recordRecalledVirtualGirlfriendMemories,
  retrieveRelevantVirtualGirlfriendMemories,
  touchVirtualGirlfriendConversation,
} from '@/lib/virtual-girlfriend/data';
import { generateVirtualGirlfriendProactiveMessage } from '@/lib/virtual-girlfriend/orchestration';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendProactiveEventRecord,
  VirtualGirlfriendProactiveTriggerType,
} from '@/lib/virtual-girlfriend/types';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const pickTrigger = (history: VirtualGirlfriendMessageRecord[]): VirtualGirlfriendProactiveTriggerType => {
  const assistantCount = history.filter((message) => message.role === 'assistant').length;
  if (assistantCount >= 16) return 'relationship_milestone';

  const userMentions = history.slice(-12).some((message) => message.role === 'user' && /(tomorrow|later|soon|this week|remember)/i.test(message.content));
  if (userMentions) return 'memory_followup';

  const hour = new Date().getHours();
  if (hour >= 18) return 'evening_checkin';

  return 'conversation_gap';
};

const scheduleOffsetMs = (triggerType: VirtualGirlfriendProactiveTriggerType, relationshipScore: number) => {
  if (triggerType === 'memory_followup') return 4 * HOUR;
  if (triggerType === 'evening_checkin') return 2 * HOUR;
  if (triggerType === 'relationship_milestone') return relationshipScore >= 0.7 ? 90 * MINUTE : 3 * HOUR;
  return relationshipScore >= 0.7 ? 5 * HOUR : 8 * HOUR;
};

const computeRelationshipScore = (history: VirtualGirlfriendMessageRecord[], memoryCount: number) => {
  const userMessages = history.filter((message) => message.role === 'user').length;
  const assistantMessages = history.filter((message) => message.role === 'assistant').length;
  const turns = Math.min(1, (userMessages + assistantMessages) / 60);
  const memoryDepth = Math.min(1, memoryCount / 16);
  return Math.min(1, turns * 0.65 + memoryDepth * 0.35);
};

export const maybeScheduleVirtualGirlfriendProactiveEvent = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  latestUserMessage: string;
}) => {
  const pending = await listPendingVirtualGirlfriendProactiveEvents(input.token, input.userId, input.companion.id);
  if (pending.length > 0) {
    return { scheduled: false as const, reason: 'pending_exists' };
  }

  const latestDelivered = await getLatestDeliveredVirtualGirlfriendProactiveEvent(input.token, input.userId, input.companion.id);
  if (latestDelivered?.delivered_at) {
    const elapsed = Date.now() - new Date(latestDelivered.delivered_at).getTime();
    if (elapsed < 18 * HOUR) {
      return { scheduled: false as const, reason: 'cooldown' };
    }
  }

  const conversation = await getLatestVirtualGirlfriendConversation(input.token, input.userId, input.companion.id);
  if (!conversation?.last_message_at) {
    return { scheduled: false as const, reason: 'no_history' };
  }

  const sinceLastChatMs = Date.now() - new Date(conversation.last_message_at).getTime();
  if (sinceLastChatMs < 3 * HOUR) {
    return { scheduled: false as const, reason: 'recently_active' };
  }

  const history = await getVirtualGirlfriendMessages(input.token, conversation.id);
  const memoryHints = await retrieveRelevantVirtualGirlfriendMemories(input.token, {
    userId: input.userId,
    companionId: input.companion.id,
    queryText: input.latestUserMessage,
    maxItems: 8,
  });

  const relationshipScore = computeRelationshipScore(history, memoryHints.length);
  const triggerType = pickTrigger(history);
  const scheduledAt = new Date(Date.now() + scheduleOffsetMs(triggerType, relationshipScore)).toISOString();

  const event = await createVirtualGirlfriendProactiveEvent(input.token, {
    userId: input.userId,
    companionId: input.companion.id,
    triggerType,
    scheduledAt,
    contextSnapshot: {
      triggerType,
      relationshipScore,
      sinceLastChatHours: Number((sinceLastChatMs / HOUR).toFixed(2)),
      memoryHintKeys: memoryHints.map((memory) => memory.memory_key).slice(0, 4),
      companionTone: input.companion.tone,
      companionArchetype: input.companion.archetype,
    },
  });

  return { scheduled: true as const, event };
};

export const processDueVirtualGirlfriendProactiveEvents = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
}) => {
  const dueEvents = await listDueVirtualGirlfriendProactiveEvents(input.token, input.userId, input.companion.id);
  if (dueEvents.length === 0) return { deliveredCount: 0, skipped: 'none_due' as const };

  const conversation = await getOrCreateVirtualGirlfriendConversation(input.token, input.userId, input.companion.id);
  const [history, styleProfile] = await Promise.all([
    getVirtualGirlfriendMessages(input.token, conversation.id),
    getOrCreateVirtualGirlfriendUserStyleProfile(input.token, input.userId, input.companion.id),
  ]);

  let deliveredCount = 0;

  for (const event of dueEvents) {
    const delivered = await deliverSingleProactiveEvent({
      token: input.token,
      userId: input.userId,
      companion: input.companion,
      conversationId: conversation.id,
      history,
      styleProfile,
      event,
    });

    if (delivered) {
      deliveredCount += 1;
    }
  }

  return { deliveredCount, skipped: null };
};

const deliverSingleProactiveEvent = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  conversationId: string;
  history: VirtualGirlfriendMessageRecord[];
  styleProfile: Awaited<ReturnType<typeof getOrCreateVirtualGirlfriendUserStyleProfile>>;
  event: VirtualGirlfriendProactiveEventRecord;
}) => {
  await markVirtualGirlfriendProactiveEventStatus(input.token, {
    eventId: input.event.id,
    userId: input.userId,
    status: 'processing',
    lastError: null,
  });

  try {
    const memoryQuery = JSON.stringify(input.event.context_snapshot ?? {});
    const memories = await retrieveRelevantVirtualGirlfriendMemories(input.token, {
      userId: input.userId,
      companionId: input.companion.id,
      queryText: memoryQuery,
      maxItems: 6,
    });

    const generated = await generateVirtualGirlfriendProactiveMessage({
      companion: input.companion,
      history: input.history,
      memories,
      styleProfile: input.styleProfile,
      triggerType: input.event.trigger_type,
      contextSnapshot: input.event.context_snapshot,
    });

    if (!generated.ok) {
      await markVirtualGirlfriendProactiveEventStatus(input.token, {
        eventId: input.event.id,
        userId: input.userId,
        status: 'failed',
        lastError: generated.reason,
      });
      return false;
    }

    let attachments: VirtualGirlfriendMessageAttachment[] = [];

    if (Math.random() < 0.35) {
      const images = await getVirtualGirlfriendCompanionImages(input.token, input.userId, input.companion.id);
      const curated = curateVirtualGirlfriendImages(images);
      const pool = curated.gallery.length > 0 ? curated.gallery : curated.canonical ? [curated.canonical] : [];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) {
        attachments = [{
          kind: 'image',
          category: 'lifestyle',
          imageId: pick.id,
          imageUrl: pick.delivery_url,
          width: pick.width,
          height: pick.height,
          source: 'gallery-reuse',
          promptHash: pick.prompt_hash ?? undefined,
          locked: true,
        }];
      }
    }

    const inserted = await insertVirtualGirlfriendMessageReturningId(input.token, {
      conversationId: input.conversationId,
      userId: input.userId,
      role: 'assistant',
      content: generated.assistantText,
      model: generated.model,
      moderation: { proactive: true, triggerType: input.event.trigger_type },
      contentType: attachments.length > 0 ? 'mixed' : 'text',
      attachments,
    });

    await Promise.all([
      touchVirtualGirlfriendConversation(input.token, input.conversationId),
      markVirtualGirlfriendProactiveEventStatus(input.token, {
        eventId: input.event.id,
        userId: input.userId,
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        deliveredMessageId: inserted.id,
        lastError: null,
      }),
      recordRecalledVirtualGirlfriendMemories(
        input.token,
        memories.map((memory) => memory.id),
      ),
    ]);

    return true;
  } catch (error) {
    await markVirtualGirlfriendProactiveEventStatus(input.token, {
      eventId: input.event.id,
      userId: input.userId,
      status: 'failed',
      lastError: error instanceof Error ? error.message : 'unknown_error',
    });
    return false;
  }
};
