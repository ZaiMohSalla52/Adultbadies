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
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';
import { maybeScheduleVirtualGirlfriendProactiveEvent } from '@/lib/virtual-girlfriend/proactive';

// Image generation + model reply can exceed the platform default function
// limit. 60s is the safe ceiling across Vercel plans; Pro/Enterprise can raise
// this to 300.
export const runtime = 'nodejs';
export const maxDuration = 60;

const encoder = new TextEncoder();

// Split a reply into 1-3 short "texting" bubbles. The model is prompted to
// separate messages with a blank line; fall back to single newlines, then to a
// sentence split for an over-long single block.
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

  let imageAttachment = null;
  let imageOutcome: 'not_requested' | 'reused_existing' | 'generated_new' | 'skipped_prerequisites' | 'failed_generation' = 'not_requested';
  let imageOutcomeReason: string | null = null;

  if (imageMoment.shouldSendImage) {
    try {
      const resolvedImage = await resolveVirtualGirlfriendChatImage({
        token: auth.accessToken,
        userId: auth.user.id,
        companion,
        category: imageMoment.category,
        existingImages: companionImages,
        visualProfile,
        allowFreshGeneration: entitlements.isPremium,
        userMessage: message,
      });
      imageAttachment = resolvedImage.attachment;
      imageOutcome = resolvedImage.outcome;
      imageOutcomeReason = resolvedImage.reason ?? null;
    } catch (error) {
      console.error('[virtual-girlfriend] image resolve failed', error);
      imageAttachment = null;
      imageOutcome = 'failed_generation';
      imageOutcomeReason = error instanceof Error ? error.message : 'image_resolve_failed';
    }
  }

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
        ? 'User requested a new photo. Respond warmly in-character: premium unlocks fresh photo moments, invite them elegantly, and keep the vibe going in text.'
        : imageMoment.shouldSendImage && !imageAttachment && entitlements.isPremium
          ? 'User asked for a photo but one could not be attached this turn. Keep it natural and non-technical: acknowledge briefly, suggest a playful retry, and continue chatting.'
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

  const segments = splitIntoMessages(reply.assistantText);
  const combinedContent = segments.join('\n\n') || reply.assistantText;

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
                requested: imageMoment.shouldSendImage,
                outcome: imageOutcome,
                reason: imageOutcomeReason,
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
