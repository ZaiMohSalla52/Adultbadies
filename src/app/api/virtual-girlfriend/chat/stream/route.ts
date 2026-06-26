import { randomUUID } from 'node:crypto';

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
  insertVirtualGirlfriendMessage,
  insertVirtualGirlfriendMessageReturningId,
  patchVirtualGirlfriendMessage,
  recordRecalledVirtualGirlfriendMemories,
  retrieveRelevantVirtualGirlfriendMemories,
  touchVirtualGirlfriendConversation,
} from '@/lib/virtual-girlfriend/data';
import { VG_CHAT_MEMORY_RETRIEVAL_LIMIT } from '@/lib/virtual-girlfriend/chat-config';
import { extractAllVirtualGirlfriendMemoryCandidates, persistVirtualGirlfriendMemories } from '@/lib/virtual-girlfriend/memory';
import { learnAndPersistVirtualGirlfriendStyle } from '@/lib/virtual-girlfriend/style-adaptation';
import { getUnlockedImageIds, spendChatMessagePoint } from '@/lib/points/data';
import { applyChatImageLock } from '@/lib/virtual-girlfriend/chat-image-lock';
import { POINTS } from '@/lib/points/constants';
import { resolveVirtualGirlfriendChatImage } from '@/lib/virtual-girlfriend/chat-images';
import { streamVirtualGirlfriendChatTurn } from '@/lib/virtual-girlfriend/chat-turn';

import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';
import { sanitizeIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { detectExplicitImageIntent, isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';
import {
  appendTurnTrace,
  buildTurnTraceIntent,
  summarizeRetrievedMemories,
} from '@/lib/virtual-girlfriend/phase0/turn-trace';
import { isOutfitPhotoRequest } from '@/lib/virtual-girlfriend/outfit-presets';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { containsForbiddenReplyLanguage, containsMetaActionLeak } from '@/lib/virtual-girlfriend/reply-sanitizer';
import { moderateVirtualGirlfriendImageRequest } from '@/lib/virtual-girlfriend/safety';
import { maybeScheduleVirtualGirlfriendProactiveEvent } from '@/lib/virtual-girlfriend/proactive';
import type { IntimateImageMoment } from '@/lib/virtual-girlfriend/intimacy';
import type {
  VirtualGirlfriendChatImageOutcome,
  VirtualGirlfriendMessageAttachment,
} from '@/lib/virtual-girlfriend/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
  outcome: VirtualGirlfriendChatImageOutcome;
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

  const [companion, entitlements] = await Promise.all([
    requestedCompanionId
      ? getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
      : getActiveVirtualGirlfriend(auth.accessToken, auth.user.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
  ]);

  if (!companion || !companion.setup_completed) {
    return new Response(JSON.stringify({ error: 'Complete Virtual Girlfriend setup first.' }), { status: 400 });
  }

  const pointSpend = await spendChatMessagePoint(auth.accessToken, auth.user.id);
  if (!pointSpend.ok) {
    return new Response(
      JSON.stringify({
        error: `Not enough points. Each message costs ${POINTS.messageCost} point.`,
        code: 'INSUFFICIENT_POINTS',
        balance: pointSpend.balance,
        cost: pointSpend.cost,
        upgradePath: '/premium',
      }),
      { status: 402 },
    );
  }

  const conversation = await getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id);
  const [history, retrievedMemories, styleProfile, companionImages, visualProfile, unlockedImageIds] = await Promise.all([
    getVirtualGirlfriendMessages(auth.accessToken, conversation.id),
    retrieveRelevantVirtualGirlfriendMemories(auth.accessToken, {
      userId: auth.user.id,
      companionId: companion.id,
      queryText: message,
      maxItems: VG_CHAT_MEMORY_RETRIEVAL_LIMIT,
    }),
    getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
    getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companion.id),
    getLatestVisualProfileForCompanion(auth.accessToken, auth.user.id, companion.id),
    getUnlockedImageIds(auth.accessToken, auth.user.id, companion.id),
  ]);

  const photoRequested = looksLikePhotoRequest(message) || isOutfitPhotoRequest(message);
  const heuristicIntent = photoRequested
    ? buildHeuristicPhotoIntent(message, wardrobeContextFromCompanion(companion))
    : null;
  const explicitPhotoRequest = detectExplicitImageIntent(message);

  let imageMoment: IntimateImageMoment = resolveImageMomentFromIntent({
    intent: heuristicIntent ?? sanitizeIntent({}, message),
    history,
    isPremium: entitlements.isPremium,
    userMessage: message,
  });

  const premiumGuidance =
    imageMoment.shouldSendImage && !imageMoment.teaseOnly && !entitlements.isPremium
      ? 'A photo will attach automatically after your text (may be blurred for free users). Flirt naturally — NEVER narrate sending photos or use *photosending*.'
      : '';

  const expectedImageRoute = resolveChatGenerationRoute({
    explicit: explicitPhotoRequest,
    requestedLook: photoRequested,
    adultContentEnabled: isVirtualGirlfriendAdultContentEnabled(),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const traceId = randomUUID();
      const turnStartedAt = Date.now();
      let llmStartedAt: number | null = null;
      let llmDurationMs: number | null = null;
      let imageStartedAt: number | null = null;
      let imageDurationMs: number | null = null;
      let imageTask: Promise<ImageTaskResult> | undefined;
      let imageStarted = false;

      const startImageIfNeeded = (moment: IntimateImageMoment) => {
        if (imageStarted || !moment.shouldSendImage || moment.teaseOnly) return;

        const moderation = moderateVirtualGirlfriendImageRequest(message);
        if (!moderation.allowed) {
          console.warn('[virtual-girlfriend] image request blocked by moderation', moderation.reason);
          imageStarted = true;
          imageTask = Promise.resolve({
            outcome: 'skipped_prerequisites' as const,
            attachment: null,
            reason: `moderation_blocked:${moderation.reason}`,
          });
          return;
        }

        imageStarted = true;
        imageStartedAt = Date.now();
        enqueueEvent(controller, { type: 'image_generating', payload: { active: true } });
        imageTask = resolveVirtualGirlfriendChatImage({
          token: auth.accessToken,
          userId: auth.user.id,
          companion,
          category: moment.category,
          existingImages: companionImages,
          visualProfile,
          allowFreshGeneration: entitlements.isPremium || explicitPhotoRequest || photoRequested,
          userMessage: message,
          visualSceneHint: moment.visualSceneHint,
          preferFreshGeneration: moment.preferFreshGeneration,
        })
          .then((result) => {
            if (imageStartedAt !== null) {
              imageDurationMs = Date.now() - imageStartedAt;
            }
            console.info('[virtual-girlfriend][chat/stream] image_task_resolved', {
              outcome: result.outcome,
              source: result.attachment?.source ?? null,
              imageId: result.attachment?.imageId ?? null,
              reason: result.reason ?? null,
              explicitPhotoRequest,
            });
            return {
              outcome: result.outcome,
              attachment: result.attachment,
              reason: result.reason ?? null,
            };
          })
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
        llmStartedAt = Date.now();
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
        llmDurationMs = llmStartedAt !== null ? Date.now() - llmStartedAt : null;

        if (!turn.ok) {
          await appendTurnTrace({
            schemaVersion: 1,
            traceId,
            recordedAt: new Date().toISOString(),
            userId: auth.user.id,
            companionId: companion.id,
            conversationId: conversation.id,
            isPremium: entitlements.isPremium,
            timingsMs: {
              total: Date.now() - turnStartedAt,
              llm: llmDurationMs ?? undefined,
            },
            llm: {
              model: null,
              ok: false,
            },
            intent: buildTurnTraceIntent({
              photoRequested,
              explicitPhotoRequest,
              heuristicLocked: Boolean(heuristicIntent),
            }),
            image: {
              started: imageStarted,
              expectedRoute: {
                provider: expectedImageRoute.provider,
                modelKind: expectedImageRoute.modelKind,
              },
              outcome: 'not_requested',
              reason: turn.reason,
              source: null,
              imageId: null,
            },
            memory: summarizeRetrievedMemories(retrievedMemories),
            flags: ['llm_turn_failed'],
          });
          enqueueEvent(controller, { type: 'error', payload: { error: turn.reason } });
          controller.close();
          return;
        }

        const segments = splitIntoMessages(turn.assistantText);
        const combinedContent = segments.join('\n\n') || turn.assistantText;
        const photoRequestedThisTurn =
          turn.intent.wantsPhoto || imageMoment.shouldSendImage || imageMoment.teaseOnly || photoRequested;

        const imagePending = imageStarted && !imageMoment.teaseOnly && photoRequestedThisTurn;
        let imageOutcome: VirtualGirlfriendChatImageOutcome = imageMoment.teaseOnly
          ? 'not_requested'
          : imagePending
            ? 'pending'
            : 'not_requested';
        let imageOutcomeReason: string | null = imageMoment.teaseOnly ? 'tease_before_photo' : null;

        enqueueEvent(controller, {
          type: 'text_done',
          payload: {
            content: combinedContent,
            segments,
            contentType: 'text',
            photoPending: imagePending,
          },
        });

        const userMessagePromise = insertVirtualGirlfriendMessage(auth.accessToken, {
          conversationId: conversation.id,
          userId: auth.user.id,
          role: 'user',
          content: message,
          moderation: turn.moderation,
        });

        const assistantMessagePromise = insertVirtualGirlfriendMessageReturningId(auth.accessToken, {
          conversationId: conversation.id,
          userId: auth.user.id,
          role: 'assistant',
          content: combinedContent,
          model: turn.model,
          moderation: {},
          contentType: 'text',
          attachments: [],
        });

        const finalizeTurn = async () => {
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

          const candidates = await extractAllVirtualGirlfriendMemoryCandidates({
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
        };

        void finalizeTurn().catch((finalizeError) => {
          console.error('[virtual-girlfriend] post-turn finalize failed', finalizeError);
        });

        let streamAttachments: VirtualGirlfriendMessageAttachment[] = [];
        let streamContentType: 'text' | 'mixed' = 'text';
        let streamGenerationMode: string | null = null;

        let heartbeat: ReturnType<typeof setInterval> | null = null;
        if (imageTask) {
          heartbeat = setInterval(() => {
            try {
              enqueueEvent(controller, { type: 'ping', payload: { active: true } });
            } catch {
              if (heartbeat) clearInterval(heartbeat);
            }
          }, 7000);
        }

        let assistantMessage: { id: string };

        try {
          const [, insertedAssistantMessage, resolvedImage] = await Promise.all([
            userMessagePromise,
            assistantMessagePromise,
            imageTask
              ?? Promise.resolve({
                outcome: 'not_requested' as VirtualGirlfriendChatImageOutcome,
                attachment: null as VirtualGirlfriendMessageAttachment | null,
                reason: null as string | null,
              }),
          ]);
          assistantMessage = insertedAssistantMessage;

          if (imageTask) {
            let imageAttachment = resolvedImage.attachment;
            imageOutcome = resolvedImage.outcome;
            imageOutcomeReason = resolvedImage.reason;

            if (imageAttachment) {
              imageAttachment = applyChatImageLock(imageAttachment, unlockedImageIds);
            }

            if (imageAttachment) {
              streamAttachments = [imageAttachment];
              streamContentType = 'mixed';
              streamGenerationMode = imageAttachment.source ?? null;

              enqueueEvent(controller, {
                type: 'image',
                payload: {
                  attachment: imageAttachment,
                  contentType: 'mixed',
                  generationMode: imageAttachment.source ?? null,
                },
              });

              try {
                await patchVirtualGirlfriendMessage(auth.accessToken, assistantMessage.id, {
                  contentType: 'mixed',
                  attachments: [imageAttachment],
                });
              } catch (patchError) {
                console.warn('[virtual-girlfriend] failed to persist late chat image attachment', patchError);
              }

            } else if (
              imageStarted
              && photoRequestedThisTurn
              && !imageMoment.teaseOnly
            ) {
              if (imageOutcome === 'not_requested') {
                imageOutcome = 'skipped_prerequisites';
              }
              if (!imageOutcomeReason) {
                imageOutcomeReason = 'image_not_attached';
              }

              enqueueEvent(controller, {
                type: 'image_failed',
                payload: {
                  outcome: imageOutcome,
                  reason: imageOutcomeReason,
                },
              });
            }
          }
        } finally {
          if (heartbeat) clearInterval(heartbeat);
        }

        enqueueEvent(controller, {
          type: 'done',
          payload: {
            content: combinedContent,
            segments,
            contentType: streamContentType,
            attachments: streamAttachments,
            assistantMessageId: assistantMessage.id,
            generationMode: streamGenerationMode,
            imageGeneration: {
              requested: photoRequestedThisTurn,
              outcome: imageMoment.teaseOnly ? 'not_requested' : imageOutcome,
              reason: imageMoment.teaseOnly ? 'tease_before_photo' : imageOutcomeReason,
            },
          },
        });

        const traceFlags: string[] = [];
        if (containsForbiddenReplyLanguage(combinedContent)) traceFlags.push('forbidden_language_in_final_reply');
        if (containsMetaActionLeak(combinedContent)) traceFlags.push('meta_action_leak');
        if (imageStarted && photoRequestedThisTurn && !streamAttachments.length && !imageMoment.teaseOnly) {
          traceFlags.push('photo_requested_without_attachment');
        }

        await appendTurnTrace({
          schemaVersion: 1,
          traceId,
          recordedAt: new Date().toISOString(),
          userId: auth.user.id,
          companionId: companion.id,
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
          isPremium: entitlements.isPremium,
          timingsMs: {
            total: Date.now() - turnStartedAt,
            llm: llmDurationMs ?? undefined,
            image: imageDurationMs ?? undefined,
          },
          llm: {
            model: turn.model,
            ok: true,
          },
          intent: buildTurnTraceIntent({
            photoRequested,
            explicitPhotoRequest,
            heuristicLocked: Boolean(heuristicIntent),
            intent: turn.intent,
          }),
          image: {
            started: imageStarted,
            expectedRoute: {
              provider: expectedImageRoute.provider,
              modelKind: expectedImageRoute.modelKind,
            },
            outcome: imageMoment.teaseOnly ? 'not_requested' : imageOutcome,
            reason: imageMoment.teaseOnly ? 'tease_before_photo' : imageOutcomeReason,
            source: streamGenerationMode,
            imageId: streamAttachments[0]?.imageId ?? null,
          },
          memory: summarizeRetrievedMemories(retrievedMemories),
          flags: traceFlags,
        });
      } catch (error) {
        console.error('[virtual-girlfriend] stream failed', error);
        await appendTurnTrace({
          schemaVersion: 1,
          traceId,
          recordedAt: new Date().toISOString(),
          userId: auth.user.id,
          companionId: companion.id,
          conversationId: conversation.id,
          isPremium: entitlements.isPremium,
          timingsMs: {
            total: Date.now() - turnStartedAt,
            llm: llmDurationMs ?? undefined,
            image: imageDurationMs ?? undefined,
          },
          llm: {
            model: null,
            ok: false,
          },
          intent: buildTurnTraceIntent({
            photoRequested,
            explicitPhotoRequest,
            heuristicLocked: Boolean(heuristicIntent),
          }),
          image: {
            started: imageStarted,
            expectedRoute: {
              provider: expectedImageRoute.provider,
              modelKind: expectedImageRoute.modelKind,
            },
            outcome: 'failed_generation',
            reason: error instanceof Error ? error.message : 'stream_failed',
            source: null,
            imageId: null,
          },
          memory: summarizeRetrievedMemories(retrievedMemories),
          flags: ['stream_failed'],
        });
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