import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getLatestVisualProfileForCompanion,
  getOrCreateVirtualGirlfriendConversation,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionImages,
  getVirtualGirlfriendMessages,
  getVirtualGirlfriendUserMessageCountForToday,
  insertVirtualGirlfriendMessage,
  recordRecalledVirtualGirlfriendMemories,
  retrieveRelevantVirtualGirlfriendMemories,
  touchVirtualGirlfriendConversation,
} from '@/lib/virtual-girlfriend/data';
import { extractVirtualGirlfriendMemoryCandidates, persistVirtualGirlfriendMemories } from '@/lib/virtual-girlfriend/memory';
import { generateVirtualGirlfriendReply } from '@/lib/virtual-girlfriend/orchestration';
import { learnAndPersistVirtualGirlfriendStyle } from '@/lib/virtual-girlfriend/style-adaptation';
import { decideVirtualGirlfriendImageMoment, resolveVirtualGirlfriendChatImage } from '@/lib/virtual-girlfriend/chat-images';
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { message?: string };
  const message = String(body.message ?? '').trim();

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required.' }), { status: 400 });
  }

  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
  if (!companion || !companion.setup_completed) {
    return new Response(JSON.stringify({ error: 'Complete Virtual Girlfriend setup first.' }), { status: 400 });
  }

  const entitlements = await getUserEntitlements(auth.accessToken, auth.user.id);
  const usedToday = await getVirtualGirlfriendUserMessageCountForToday(auth.accessToken, auth.user.id);
  const limit = entitlements.limits.virtualGirlfriendMessagesPerDay;

  if (limit !== null && usedToday >= limit) {
    return new Response(
      JSON.stringify({
        error: 'Daily Virtual Girlfriend free message limit reached.',
        code: 'VG_LIMIT_REACHED',
        upgradePath: '/premium',
      }),
      { status: 402 },
    );
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);
  const [history, retrievedMemories, styleProfile, companionImages, visualProfile] = await Promise.all([
    getVirtualGirlfriendMessages(auth.accessToken, conversation.id),
    retrieveRelevantVirtualGirlfriendMemories(auth.accessToken, {
      userId: auth.user.id,
      companionId: companion.id,
      queryText: message,
      maxItems: 8,
    }),
    getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id),
  ]);

  const imageMoment = decideVirtualGirlfriendImageMoment({
    userMessage: message,
    history,
    isPremium: entitlements.isPremium,
  });

  if (imageMoment.shouldSendImage) {
    const moderation = moderateVirtualGirlfriendImageRequest(message);
    if (!moderation.allowed) {
      return new Response(JSON.stringify({ error: moderation.reason }), { status: 400 });
    }
  }

  const imageAttachment = imageMoment.shouldSendImage
    ? await resolveVirtualGirlfriendChatImage({
        token: auth.accessToken,
        userId: auth.user.id,
        companion,
        category: imageMoment.category,
        existingImages: companionImages,
        visualProfile,
        allowFreshGeneration: entitlements.isPremium,
      })
    : null;

  const reply = await generateVirtualGirlfriendReply({
    companion,
    history,
    memories: retrievedMemories,
    styleProfile,
    userMessage: message,
    imageContext: imageAttachment
      ? {
          category: imageAttachment.category,
          source: imageAttachment.source,
          trigger: imageMoment.trigger === 'contextual-initiative' ? 'contextual-initiative' : 'user-request',
        }
      : null,
    responseGuidance:
      imageMoment.shouldSendImage && !imageAttachment && !entitlements.isPremium
        ? 'User requested a new photo. Explain warmly that premium unlocks fresh photo moments, and offer to keep chatting in text for now.'
        : undefined,
  });

  if (!reply.ok) {
    return new Response(JSON.stringify({ error: reply.reason }), { status: 400 });
  }

  await insertVirtualGirlfriendMessage(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
    role: 'user',
    content: message,
    moderation: reply.moderation,
  });

  await insertVirtualGirlfriendMessage(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
    role: 'assistant',
    content: reply.assistantText,
    model: reply.model,
    moderation: {},
    contentType: imageAttachment ? 'mixed' : 'text',
    attachments: imageAttachment ? [imageAttachment] : [],
  });

  await Promise.all([
    touchVirtualGirlfriendConversation(auth.accessToken, conversation.id),
    recordRecalledVirtualGirlfriendMemories(
      auth.accessToken,
      retrievedMemories.map((memory) => memory.id),
    ),
    learnAndPersistVirtualGirlfriendStyle({
      token: auth.accessToken,
      userId: auth.user.id,
      companionId: companion.id,
      current: styleProfile,
      userMessage: message,
      assistantMessage: reply.assistantText,
    }),
  ]);

  const candidates = extractVirtualGirlfriendMemoryCandidates({
    userMessage: message,
    assistantMessage: reply.assistantText,
  });

  if (candidates.length > 0) {
    await persistVirtualGirlfriendMemories({
      token: auth.accessToken,
      userId: auth.user.id,
      companionId: companion.id,
      conversationId: conversation.id,
      candidates,
    });
  }

  const chunks = reply.assistantText.split(/(\s+)/).filter(Boolean);

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'chunk', chunk }) + '\n'));
      }
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: 'done',
            payload: {
              content: reply.assistantText,
              contentType: imageAttachment ? 'mixed' : 'text',
              attachments: imageAttachment ? [imageAttachment] : [],
              generationMode: imageAttachment?.source ?? null,
            },
          }) + '\n',
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
