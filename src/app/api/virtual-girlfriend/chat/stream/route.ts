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
import { learnAndPersistVirtualGirlfriendStyle } from '@/lib/virtual-girlfriend/style-adaptation';
import { resolveVirtualGirlfriendChatImage } from '@/lib/virtual-girlfriend/chat-images';
import { streamVirtualGirlfriendChatTurn } from '@/lib/virtual-girlfriend/chat-turn';
import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';
import { sanitizeIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';
import { maybeScheduleVirtualGirlfriendProactiveEvent } from '@/lib/virtual-girlfriend/proactive';
import type { IntimateImageMoment } from '@/lib/virtual-girlfriend/intimacy';
import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';

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

type ImageTaskResult = {
  outcome: string;
  attachment: VirtualGirlfriendMessageAttachment | null;
  reason: string | null;
};

const enqueueEvent = (controller: ReadableStreamDefaultController<Uint8Array>, event: Record<string, unknown>) => {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
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

  const heuristicIntent = looksLikePhotoRequest(message) ? buildHeuristicPhotoIntent(message) : null;
  const explicitPhotoRequest = detectExplicitImageIntent(message);

  let imageMoment: IntimateImageMoment = resolveImageMomentFromIntent({
    intent: heuristicIntent ?? sanitizeIntent({}, message),
    history,
    isPremium: entitlements.isPremium,
    userMessage: message,
  });

  const premiumGuidance =
    imageMoment.shouldSendImage && !imageMoment.teaseOnly && !entitlements.isPremium
      ? 'Fresh custom photos need Premium — flirt and invite upgrade in-character, but NEVER say you cannot send photos or offer text descriptions instead. Gallery photos may still appear.'
      : '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let imageTask: Promise<ImageTaskResult> | undefined;
      let imageStarted = false;

      const startImageIfNeeded = (moment: IntimateImageMoment) => {
        if (imageStarted || !moment.shouldSendImage || moment.teaseOnly) return;

        const moderation = moderateVirtualGirlfriendImageRequest(message);
        if (!moderation.allowed) {
          console.warn('[virtual-girlfriend] image request blocked by moderation', moderation.reason);
          return;
        }

        imageStarted = true;
        imageTask = resolveVirtualGirlfriendChatImage({
          token: auth.accessToken,
          userId: auth.user.id,
          companion,
          category: moment.category,
          existingImages: companionImages,
          visualProfile,
          allowFreshGeneration: entitlements.isPremium || explicitPhotoRequest,
          userMessage: message,
          visualSceneHint: moment.visualSceneHint,
          preferFreshGeneration: moment.preferFreshGeneration,
        })
          .then((result) => ({
            outcome: result.outcome,
            attachment: result.attachment,
            reason: result.reason ?? null,
          }))
          .catch((error) => {
            console.error('[virtual-girlfriend] image resolve failed', error);
            return {
              outcome: 'failed_generation' as const,
              attachment: null,
              reason: error instanceof Error ? error.message : 'image_resolve_failed',
            };
          });
      };

      startImageIfNeeded(imageMoment);

      try {
        const turn = await streamVirtualGirlfriendChatTurn({
          companion,
          history,
          memories: retrievedMemories,
          styleProfile,
          userMessage: message,
          imageMoment,
          isPremium: entitlements.isPremium,
          premiumGuidance: premiumGuidance || undefined,
          handlers: {
            onToken: (token) => {
              enqueueEvent(controller, { type: 'token', payload: { token } });
            },
            onIntent: (intent) => {
              imageMoment = resolveImageMomentFromIntent({
                intent,
                history,
                isPremium: entitlements.isPremium,
                userMessage: message,
              });
              startImageIfNeeded(imageMoment);
            },
          },
        });

        if (!turn.ok) {
          enqueueEvent(controller, { type: 'error', payload: { error: turn.reason } });
          controller.close();
          return;
        }

        const segments = splitIntoMessages(turn.assistantText);
        const combinedContent = segments.join('\n\n') || turn.assistantText;
        const photoRequested =
          turn.intent.wantsPhoto || imageMoment.shouldSendImage || imageMoment.teaseOnly || looksLikePhotoRequest(message);

        enqueueEvent(controller, {
          type: 'text_done',
          payload: {
            content: combinedContent,
            segments,
            contentType: 'text',
          },
        });

        let imageAttachment: VirtualGirlfriendMessageAttachment | null = null;
        let imageOutcome = imageMoment.teaseOnly ? 'not_requested' : 'not_requested';
        let imageOutcomeReason: string | null = imageMoment.teaseOnly ? 'tease_before_photo' : null;

        const resolvedImage = imageTask ? await imageTask : null;
        if (
          !resolvedImage
          && imageMoment.shouldSendImage
          && !imageMoment.teaseOnly
          && photoRequested
        ) {
          imageOutcome = 'skipped_prerequisites';
          imageOutcomeReason = imageStarted ? 'image_task_missing' : 'image_pipeline_not_started';
        }
        if (resolvedImage) {
          imageAttachment = resolvedImage.attachment;
          imageOutcome = resolvedImage.outcome;
          imageOutcomeReason = resolvedImage.reason;

          if (imageAttachment) {
            enqueueEvent(controller, {
              type: 'image',
              payload: {
                attachment: imageAttachment,
                contentType: 'mixed',
                generationMode: imageAttachment.source ?? null,
              },
            });
          }
        }

        await insertVirtualGirlfriendMessage(auth.accessToken, {
          conversationId: conversation.id,
          userId: auth.user.id,
          role: 'user',
          content: message,
          moderation: turn.moderation,
        });

        await insertVirtualGirlfriendMessage(auth.accessToken, {
          conversationId: conversation.id,
          userId: auth.user.id,
          role: 'assistant',
          content: combinedContent,
          model: turn.model,
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
            assistantMessage: turn.assistantText,
          }),
        ]);

        const candidates = extractVirtualGirlfriendMemoryCandidates({
          userMessage: message,
          assistantMessage: turn.assistantText,
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

        enqueueEvent(controller, {
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
        });
      } catch (error) {
        console.error('[virtual-girlfriend] stream failed', error);
        enqueueEvent(controller, {
          type: 'error',
          payload: { error: 'Unable to complete this chat turn right now.' },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}