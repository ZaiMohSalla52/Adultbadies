import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getVirtualGirlfriendCompanionById,
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
import { buildIntimacyResponseGuidance } from '@/lib/virtual-girlfriend/intimacy';
import { looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';
import { maybeScheduleVirtualGirlfriendProactiveEvent } from '@/lib/virtual-girlfriend/proactive';

export const runtime = 'nodejs';
export const maxDuration = 60;

const encoder = new TextEncoder();

const splitIntoMessages = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  let parts = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    parts = trimmed.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  }
  if (parts.length === 1 && parts[0].length > 220) {
    const sentences = parts[0].match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? parts;
    if (sentences.length > 1) {
      const mid = Math.ceil(sentences.length / 2);
      parts = [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')];
    }
  }

  return parts.slice(0, 3);
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  const body = (await request.json()) as { message?: string; companionId?: string };
  const message = String(body.message ?? '').trim();
  const requestedCompanionId = String(body.companionId ?? '').trim();

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required.' }), { status: 400 });
  }

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
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

  const imageMoment = await decideVirtualGirlfriendImageMoment({
    companion,
    userMessage: message,
    history,
    isPremium: entitlements.isPremium,
  });

  const photoRequested = imageMoment.shouldSendImage || imageMoment.teaseOnly || looksLikePhotoRequest(message);

  if (imageMoment.shouldSendImage) {
    const moderation = moderateVirtualGirlfriendImageRequest(message);
    if (!moderation.allowed) {
      return new Response(JSON.stringify({ error: moderation.reason }), { status: 400 });
    }
  }

  const intimacyGuidance = buildIntimacyResponseGuidance({
    imageMoment,
    imageAttached: false,
  });

  const premiumGuidance =
    imageMoment.shouldSendImage && !imageMoment.teaseOnly && !entitlements.isPremium
      ? 'Fresh custom photos need Premium — flirt and invite upgrade in-character, but NEVER say you cannot send photos or offer text descriptions instead. Gallery photos may still appear.'
      : '';

  const imageTask = imageMoment.shouldSendImage && !imageMoment.teaseOnly
    ? resolveVirtualGirlfriendChatImage({
        token: auth.accessToken,
        userId: auth.user.id,
        companion,
        category: imageMoment.category,
        existingImages: companionImages,
        visualProfile,
        allowFreshGeneration: entitlements.isPremium,
        userMessage: message,
        visualSceneHint: imageMoment.visualSceneHint,
        preferFreshGeneration: imageMoment.preferFreshGeneration,
      }).catch((error) => {
        console.error('[virtual-girlfriend] image resolve failed', error);
        return {
          outcome: 'failed_generation' as const,
          attachment: null,
          reason: error instanceof Error ? error.message : 'image_resolve_failed',
        };
      })
    : Promise.resolve({ outcome: 'not_requested' as const, attachment: null, reason: null });

  const replyTask = generateVirtualGirlfriendReply({
    companion,
    history,
    memories: retrievedMemories,
    styleProfile,
    userMessage: message,
    photoRequested,
    teaseOnly: imageMoment.teaseOnly,
    responseGuidance: [intimacyGuidance, premiumGuidance].filter(Boolean).join(' ') || undefined,
  });

  const [imageResult, reply] = await Promise.all([imageTask, replyTask]);

  if (!reply.ok) {
    return new Response(JSON.stringify({ error: reply.reason }), { status: 400 });
  }

  const imageAttachment = imageResult.attachment;

  let assistantText = reply.assistantText;
  if (imageAttachment) {
    const captioned = await generateVirtualGirlfriendReply({
      companion,
      history,
      memories: retrievedMemories,
      styleProfile,
      userMessage: message,
      imageContext: {
        category: imageAttachment.category,
        source: imageAttachment.source,
        trigger: imageMoment.trigger === 'contextual-initiative' ? 'contextual-initiative' : 'user-request',
      },
      photoRequested: true,
      teaseOnly: false,
      responseGuidance: 'Photo is attached and visible. Write a short flirty caption only. Never disclaim photos.',
    });
    if (captioned.ok) assistantText = captioned.assistantText;
  }
  const imageOutcome =
    imageResult.outcome === 'not_requested'
      ? 'not_requested'
      : imageResult.outcome;
  const imageOutcomeReason = imageResult.reason ?? null;

  const failureGuidance =
    photoRequested && !imageAttachment && !imageMoment.teaseOnly
      ? entitlements.isPremium
        ? 'Photo could not attach — stay flirty, say you\'ll try again, NEVER disclaim photos or offer descriptions.'
        : 'Invite Premium for fresh custom photos in-character — NEVER say you cannot send photos.'
      : '';

  if (failureGuidance && imageAttachment === null) {
    const retry = await generateVirtualGirlfriendReply({
      companion,
      history,
      memories: retrievedMemories,
      styleProfile,
      userMessage: message,
      imageContext: null,
      photoRequested: true,
      teaseOnly: false,
      responseGuidance: failureGuidance,
    });
    if (retry.ok) assistantText = retry.assistantText;
  }

  await insertVirtualGirlfriendMessage(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
    role: 'user',
    content: message,
    moderation: reply.moderation,
  });

  const segments = splitIntoMessages(assistantText);
  const combinedContent = segments.join('\n\n') || assistantText;

  await insertVirtualGirlfriendMessage(auth.accessToken, {
    conversationId: conversation.id,
    userId: auth.user.id,
    role: 'assistant',
    content: combinedContent,
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
      assistantMessage: assistantText,
    }),
  ]);

  const candidates = extractVirtualGirlfriendMemoryCandidates({
    userMessage: message,
    assistantMessage: assistantText,
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

  await maybeScheduleVirtualGirlfriendProactiveEvent({
    token: auth.accessToken,
    userId: auth.user.id,
    companion,
    latestUserMessage: message,
  });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: 'done',
            payload: {
              content: combinedContent,
              segments,
              contentType: imageAttachment ? 'mixed' : 'text',
              attachments: imageAttachment ? [imageAttachment] : [],
              generationMode: imageAttachment?.source ?? null,
              imageGeneration: {
                requested: photoRequested,
                outcome: imageMoment.teaseOnly ? 'not_requested' : imageOutcome,
                reason: imageMoment.teaseOnly ? 'tease_before_photo' : imageOutcomeReason,
              },
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