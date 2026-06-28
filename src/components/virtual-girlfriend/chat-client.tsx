'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendStyleControlPreset,
  VirtualGirlfriendUserStyleProfileRecord,
  VirtualGirlfriendChatImageOutcome,
  VirtualGirlfriendGenerationStatus,
} from '@/lib/virtual-girlfriend/types';
import { getOutfitPresetsForSex } from '@/lib/virtual-girlfriend/outfit-presets';
import { getCompanionLabels } from '@/lib/virtual-girlfriend/companion-labels';
import { POINTS } from '@/lib/points/constants';
import {
  computeSegmentPauseMs,
  computeThinkDelayMs,
  createChatReplyPacer,
  sleep,
} from '@/lib/virtual-girlfriend/chat-reply-pace';
import { dedupeMessageSegments } from '@/lib/virtual-girlfriend/message-segments';
import { polishChatDisplayText } from '@/lib/virtual-girlfriend/reply-sanitizer';
import { ChatAvatarImage } from './chat-avatar-image';
import { ChatImageAttachment } from './chat-image-attachment';
import { UnlockableGallery } from './unlockable-gallery';
import styles from './chat-client.module.css';

type ChatClientProps = {
  companionId: string;
  companionName: string;
  companionAvatarUrl?: string | null;
  portraitBackdropUrl?: string | null;
  portraitPreviewUrl?: string | null;
  initialMessages: VirtualGirlfriendMessageRecord[];
  entitlements: Entitlements;
  usedToday: number;
  initialStyleProfile: VirtualGirlfriendUserStyleProfileRecord;
  isPremium: boolean;
  companionGenerationStatus: VirtualGirlfriendGenerationStatus;
  companionBio?: string | null;
  occupation?: string | null;
  personality?: string | null;
  sexuality?: string | null;
  companionSex?: string | null;
  galleryImages: Array<{ id: string; url: string }>;
  unlockedImageIds: string[];
  pointBalance: number;
  unblurCost: number;
};

const STYLE_PRESETS: Array<{ key: VirtualGirlfriendStyleControlPreset; label: string }> = [
  { key: 'more_playful', label: 'More playful' },
  { key: 'more_caring', label: 'More caring' },
  { key: 'shorter_replies', label: 'Shorter replies' },
  { key: 'bolder_flirting', label: 'Bolder flirting' },
];

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDateLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

export const VirtualGirlfriendChatClient = ({
  companionId,
  companionName,
  companionAvatarUrl,
  portraitBackdropUrl,
  portraitPreviewUrl,
  initialMessages,
  entitlements,
  usedToday,
  initialStyleProfile,
  isPremium,
  companionGenerationStatus,
  companionBio,
  occupation,
  personality,
  sexuality,
  companionSex,
  galleryImages,
  unlockedImageIds,
  pointBalance: initialPointBalance,
  unblurCost,
}: ChatClientProps) => {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [liveAvatarUrl, setLiveAvatarUrl] = useState(companionAvatarUrl ?? portraitPreviewUrl ?? '');
  const [liveBackdropUrl, setLiveBackdropUrl] = useState(portraitBackdropUrl ?? companionAvatarUrl ?? portraitPreviewUrl ?? '');
  const [styleProfile, setStyleProfile] = useState(initialStyleProfile);
  const [infoTab, setInfoTab] = useState<'photos' | 'profile'>('photos');
  const [outfitMenuOpen, setOutfitMenuOpen] = useState(false);
  const [pointBalance, setPointBalance] = useState(initialPointBalance);
  const [chatUnlockedIds, setChatUnlockedIds] = useState<Set<string>>(() => new Set(unlockedImageIds));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [companionActivity, setCompanionActivity] = useState<'idle' | 'typing' | 'sending_photo'>('idle');
  const [replyRevealing, setReplyRevealing] = useState(false);
  const [isPacingChars, setIsPacingChars] = useState(false);
  const [awaitingPhoto, setAwaitingPhoto] = useState(false);
  const [companionSheetOpen, setCompanionSheetOpen] = useState(false);
  const [sidebarImages, setSidebarImages] = useState(galleryImages);
  const [sidebarUnlocked, setSidebarUnlocked] = useState(unlockedImageIds);
  const [stylePending, setStylePending] = useState<VirtualGirlfriendStyleControlPreset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const messageCost = POINTS.messageCost;
  const insufficientPoints = pointBalance < messageCost;
  const dailyMessageLimit = entitlements.limits.virtualGirlfriendMessagesPerDay;
  const dailyLimitReached = dailyMessageLimit !== null && usedToday >= dailyMessageLimit;
  const outfitPresets = useMemo(() => getOutfitPresetsForSex(companionSex), [companionSex]);
  const labels = useMemo(() => getCompanionLabels(companionSex), [companionSex]);
  const [messagesUsedToday, setMessagesUsedToday] = useState(usedToday);
  const [resetPending, setResetPending] = useState(false);

  const isTypingActivity =
    companionActivity === 'typing'
    && !isPacingChars
    && (replyRevealing || isStreaming);
  const isPhotoActivity = companionActivity === 'sending_photo' && awaitingPhoto;

  const activityLabel = isTypingActivity
    ? 'typing…'
    : isPhotoActivity
      ? 'sharing something…'
      : 'online';

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'auto',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!awaitingPhoto) return undefined;

    const timeout = window.setTimeout(() => {
      setAwaitingPhoto(false);
      setCompanionActivity('idle');
      setError('Photo is taking longer than expected. Try asking again in a moment.');
    }, 240_000);

    return () => window.clearTimeout(timeout);
  }, [awaitingPhoto]);

  useEffect(() => {
    scrollToBottom();
  }, []);

  useEffect(() => {
    setMessagesUsedToday(usedToday);
  }, [usedToday]);

  useEffect(() => {
    const nextAvatar = companionAvatarUrl ?? portraitPreviewUrl ?? '';
    const nextBackdrop = portraitBackdropUrl ?? companionAvatarUrl ?? portraitPreviewUrl ?? '';
    setLiveAvatarUrl(nextAvatar);
    setLiveBackdropUrl(nextBackdrop);
  }, [companionAvatarUrl, portraitBackdropUrl, portraitPreviewUrl]);

  useEffect(() => {
    if (companionAvatarUrl) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 90;

    const poll = async (): Promise<boolean> => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/virtual-girlfriend/generation-status?companionId=${encodeURIComponent(companionId)}`,
          { cache: 'no-store' },
        );
        if (!response.ok || cancelled) return attempts >= maxAttempts;

        const data = (await response.json()) as {
          canonicalUrl?: string | null;
          portraitPreviewUrl?: string | null;
          status?: string;
        };

        if (data.canonicalUrl) {
          setLiveAvatarUrl(data.canonicalUrl);
          setLiveBackdropUrl(data.canonicalUrl);
          router.refresh();
          return true;
        }

        if (data.portraitPreviewUrl) {
          setLiveAvatarUrl((current) => current || data.portraitPreviewUrl || '');
          setLiveBackdropUrl((current) => current || data.portraitPreviewUrl || '');
        }

        if (data.status && data.status !== 'generating') {
          router.refresh();
          return true;
        }
      } catch {
        // keep polling through transient failures
      }

      return attempts >= maxAttempts;
    };

    const interval = setInterval(() => {
      void poll().then((done) => {
        if (done) clearInterval(interval);
      });
    }, 3000);

    void poll().then((done) => {
      if (done) clearInterval(interval);
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companionAvatarUrl, companionId, router]);

  const shareCompanion = async () => {
    const shareUrl = `${window.location.origin}/virtual-girlfriend/chat?companionId=${companionId}`;
    const shareData = {
      title: `Chat with ${companionName}`,
      text: `Continue your conversation with ${companionName}.`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setError(null);
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      setError('Unable to share this chat link right now.');
    }
  };

  const resetChat = async () => {
    if (resetPending || pending) return;
    const confirmed = window.confirm(`Clear your chat history with ${companionName}? This cannot be undone.`);
    if (!confirmed) return;

    setResetPending(true);
    setError(null);

    try {
      const response = await fetch('/api/virtual-girlfriend/chat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Unable to reset chat.');
        return;
      }
      setMessages([]);
      setMessagesUsedToday(0);
      router.refresh();
    } catch {
      setError('Unable to reset chat right now.');
    } finally {
      setResetPending(false);
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || pending || insufficientPoints || dailyLimitReached || awaitingPhoto) return;

    setPending(true);
    setIsStreaming(true);
    setCompanionActivity('typing');
    setAwaitingPhoto(false);
    setError(null);
    setDraft('');
    setOutfitMenuOpen(false);

    const optimisticUser: VirtualGirlfriendMessageRecord = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      conversation_id: 'temp',
      user_id: 'temp',
      created_at: new Date().toISOString(),
      moderation: {},
      model: null,
      token_count: null,
      content_type: 'text',
      attachments: [],
    };

    setMessages((prev) => [...prev, optimisticUser]);

    const response = await fetch('/api/virtual-girlfriend/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, companionId }),
    });

    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        balance?: number;
        limit?: number;
        usedToday?: number;
      };
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id));
      if (body.code === 'INSUFFICIENT_POINTS') {
        if (typeof body.balance === 'number') setPointBalance(body.balance);
        setError(`Not enough points. Each message costs ${messageCost} point.`);
      } else if (body.code === 'DAILY_LIMIT_REACHED') {
        if (typeof body.usedToday === 'number') setMessagesUsedToday(body.usedToday);
        setError(body.error ?? 'Daily message limit reached.');
      } else {
        setError(body.error ?? 'Unable to send message.');
      }
      setPending(false);
      setIsStreaming(false);
      setReplyRevealing(false);
      setIsPacingChars(false);
      setCompanionActivity('idle');
      return;
    }

    setPointBalance((prev) => Math.max(0, prev - messageCost));
    setMessagesUsedToday((prev) => prev + 1);

    type DonePayload = {
      content: string;
      segments?: string[];
      contentType: 'text' | 'image' | 'mixed';
      attachments: VirtualGirlfriendMessageAttachment[];
      assistantMessageId?: string;
      imageGeneration?: { requested: boolean; outcome: VirtualGirlfriendChatImageOutcome; reason: string | null };
    };

    type StreamEvent =
      | { type: 'token'; payload: { token: string } }
      | { type: 'text_done'; payload: { content: string; segments?: string[]; contentType: 'text' | 'image' | 'mixed'; photoPending?: boolean } }
      | { type: 'image_generating'; payload: { active: boolean } }
      | { type: 'image'; payload: { attachment: VirtualGirlfriendMessageAttachment; contentType: 'mixed'; generationMode: string | null } }
      | { type: 'done'; payload: DonePayload }
      | { type: 'image_failed'; payload: { outcome: VirtualGirlfriendChatImageOutcome; reason: string | null } }
      | { type: 'ping'; payload: { active: boolean } }
      | { type: 'error'; payload: { error: string } };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let payload: DonePayload | null = null;
    let streamDone = false;
    const streamState = {
      assistantId: null as string | null,
    };
    let liveAttachments: VirtualGirlfriendMessageAttachment[] = [];
    let photoPending = false;

    const registerChatImage = (attachment: VirtualGirlfriendMessageAttachment) => {
      if (!attachment.imageId || !attachment.imageUrl) return;
      setSidebarImages((prev) =>
        prev.some((entry) => entry.id === attachment.imageId)
          ? prev
          : [{ id: attachment.imageId, url: attachment.imageUrl }, ...prev],
      );

    };

    const pollForMessageAttachment = async (messageId: string) => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const response = await fetch(
            `/api/virtual-girlfriend/chat/message-attachment?messageId=${encodeURIComponent(messageId)}`,
            { cache: 'no-store' },
          );
          if (!response.ok) continue;
          const data = (await response.json()) as { attachment?: VirtualGirlfriendMessageAttachment | null };
          if (data.attachment?.imageUrl) {
            attachImageToAssistant(data.attachment);
            registerChatImage(data.attachment);
            setAwaitingPhoto(false);
            setCompanionActivity('idle');
            return data.attachment;
          }
        } catch {
          // keep polling through transient mobile network drops
        }
      }
      setAwaitingPhoto(false);
      return null;
    };

    const attachImageToAssistant = (attachment: VirtualGirlfriendMessageAttachment) => {
      const targetId = streamState.assistantId;
      if (!targetId) return;

      liveAttachments = [attachment];
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id === targetId || message.id === `${targetId}-0`) {
            return { ...message, content_type: 'mixed', attachments: liveAttachments };
          }
          return message;
        }),
      );
      scrollToBottom();
    };

    const upsertRevealingBubble = (
      messageId: string,
      content: string,
      contentType: DonePayload['contentType'],
      isFirstBubble: boolean,
    ) => {
      setMessages((prev) => {
        const existing = prev.find((message) => message.id === messageId);
        const nextMessage = {
          id: messageId,
          role: 'assistant' as const,
          content,
          conversation_id: 'temp',
          user_id: 'temp',
          created_at: existing?.created_at ?? new Date().toISOString(),
          moderation: {},
          model: null,
          token_count: null,
          content_type: isFirstBubble && liveAttachments.length > 0 ? contentType : 'text',
          attachments: isFirstBubble ? liveAttachments : [],
        };

        if (existing) {
          return prev.map((message) => (message.id === messageId ? { ...message, ...nextMessage } : message));
        }

        return [...prev, nextMessage];
      });
      scrollToBottom();
    };

    const revealAssistantSegments = async (
      segments: string[],
      contentType: DonePayload['contentType'],
    ) => {
      const streamId = `temp-assistant-${Date.now()}`;
      const polishedSegments = dedupeMessageSegments(
        segments.map((segment) => polishChatDisplayText(segment)).filter(Boolean),
      );
      if (polishedSegments.length === 0) return;

      const multiBubble = polishedSegments.length > 1;
      streamState.assistantId = multiBubble ? `${streamId}-0` : streamId;

      setReplyRevealing(true);
      setIsPacingChars(false);
      setCompanionActivity('typing');
      await sleep(computeThinkDelayMs());

      for (let index = 0; index < polishedSegments.length; index += 1) {
        const segment = polishedSegments[index]!;
        const messageId = multiBubble ? `${streamId}-${index}` : streamId;

        if (index > 0) {
          setIsPacingChars(false);
          setCompanionActivity('typing');
          await sleep(computeSegmentPauseMs());
        }

        let built = '';
        await new Promise<void>((resolve) => {
          const pacer = createChatReplyPacer(
            (char) => {
              built += char;
              upsertRevealingBubble(
                messageId,
                polishChatDisplayText(built),
                contentType,
                index === 0,
              );
            },
            {
              thinkMs: index === 0 ? 0 : 180 + Math.floor(Math.random() * 220),
              onEmitStart: () => setIsPacingChars(true),
            },
          );

          pacer.push(segment);
          void pacer.flush().then(() => {
            setIsPacingChars(false);
            resolve();
          });
        });
      }

      setReplyRevealing(false);
    };

    while (!streamDone) {
      const next = await reader.read();
      streamDone = next.done;
      if (next.value) {
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;

          if (event.type === 'token') {
            continue;
          }

          if (event.type === 'text_done') {
            const segments =
              event.payload.segments && event.payload.segments.length > 0
                ? event.payload.segments
                : [event.payload.content];
            await revealAssistantSegments(segments, event.payload.contentType);
            photoPending = photoPending || Boolean(event.payload.photoPending);
            if (photoPending) {
              setAwaitingPhoto(true);
              setCompanionActivity('sending_photo');
            } else {
              setCompanionActivity('idle');
            }
          }

          if (event.type === 'image_generating') {
            photoPending = event.payload.active;
            if (photoPending) {
              setAwaitingPhoto(true);
              setCompanionActivity('sending_photo');
            }
          }

          if (event.type === 'ping') {
            if (photoPending) {
              setAwaitingPhoto(true);
              setCompanionActivity('sending_photo');
            }
          }

          if (event.type === 'image') {
            photoPending = false;
            setAwaitingPhoto(false);
            setCompanionActivity('idle');
            attachImageToAssistant(event.payload.attachment);
            registerChatImage(event.payload.attachment);
          }

          if (event.type === 'image_failed') {
            photoPending = false;
            setAwaitingPhoto(false);
            setCompanionActivity('idle');
            const detail = event.payload.reason ?? event.payload.outcome;
            setError(
              detail
                ? `Could not attach a photo (${detail}). Try again in a moment.`
                : 'Could not attach a photo this turn — she\'ll still reply in chat. Try again in a moment.',
            );
          }

          if (event.type === 'error') {
            setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id));
            setError(event.payload.error);
            setPending(false);
            setIsStreaming(false);
            setReplyRevealing(false);
            setIsPacingChars(false);
            setCompanionActivity('idle');
            return;
          }

          if (event.type === 'done') {
            payload = event.payload;
            const imageStillPending =
              photoPending
              || (
                payload.imageGeneration?.requested
                && payload.imageGeneration.outcome === 'pending'
                && !payload.attachments?.some((attachment) => attachment.kind === 'image')
              );
            setPending(false);
            setIsStreaming(false);
            if (!imageStillPending) {
              setAwaitingPhoto(false);
              setCompanionActivity('idle');
            }
          }
        }
      }
    }

    if (!payload) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id));
      setError('Unable to receive a reply right now.');
      setPending(false);
      setIsStreaming(false);
      setReplyRevealing(false);
      setIsPacingChars(false);
      setCompanionActivity('idle');
      return;
    }

    const attachments = payload.attachments ?? [];
    let imageAttachment =
      liveAttachments.find((attachment) => attachment.kind === 'image')
      ?? attachments.find((attachment) => attachment.kind === 'image');

    if (imageAttachment && liveAttachments.length === 0) {
      attachImageToAssistant(imageAttachment);
      registerChatImage(imageAttachment);
    }

    const assistantMessageId = payload.assistantMessageId;
    const shouldPollForAttachment =
      payload.imageGeneration?.requested
      && !imageAttachment
      && Boolean(assistantMessageId)
      && (payload.imageGeneration.outcome === 'pending' || photoPending);

    if (shouldPollForAttachment && assistantMessageId) {
      setAwaitingPhoto(true);
      setCompanionActivity('sending_photo');
      const polled = await pollForMessageAttachment(assistantMessageId);
      if (polled) imageAttachment = polled;
    }

    const photoMissing =
      payload.imageGeneration?.requested
      && !imageAttachment
      && payload.imageGeneration.outcome !== 'pending'
      && payload.imageGeneration.reason !== 'tease_before_photo'
      && payload.imageGeneration.outcome !== 'not_requested';

    if (photoMissing) {
      const reason = payload.imageGeneration?.reason;
      const outcome = payload.imageGeneration?.outcome;
      const detail = reason ?? (outcome && outcome !== 'not_requested' ? outcome : null);
      setError(
        detail
          ? `Could not attach a photo (${detail}). Try again in a moment.`
          : 'Could not attach a photo this turn — she\'ll still reply in chat. Try again in a moment.',
      );
    }

    if (!photoPending && !shouldPollForAttachment) {
      setAwaitingPhoto(false);
      setCompanionActivity('idle');
    }
    scrollToBottom();
  };

  const applyPreset = async (preset: VirtualGirlfriendStyleControlPreset) => {
    if (!isPremium || stylePending) return;
    setStylePending(preset);
    setError(null);

    const response = await fetch('/api/virtual-girlfriend/style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, companionId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Unable to apply style update.');
      setStylePending(null);
      return;
    }
    const body = (await response.json()) as { styleProfile: VirtualGirlfriendUserStyleProfileRecord };
    setStyleProfile(body.styleProfile);
    setStylePending(null);
  };

  const helperText = useMemo(() => {
    const pointsLine = `💜 ${pointBalance} points · ${messageCost} per message · unblur ${POINTS.unblurCost} pts`;
    if (dailyMessageLimit === null) return pointsLine;
    return `${pointsLine} · ${messagesUsedToday}/${dailyMessageLimit} messages today`;
  }, [pointBalance, messageCost, dailyMessageLimit, messagesUsedToday]);

  const avatarUrl = liveAvatarUrl;
  const backdropUrl = liveBackdropUrl;

  const panelBio = companionBio?.trim() || personality?.trim() || occupation?.trim() || `${companionName} is ready to chat.`;

  let lastRenderedDate = '';

  const companionPanel = (
    <>
      <div className={styles.infoPanelPortrait}>
        {backdropUrl ? <ChatAvatarImage src={backdropUrl} alt={companionName} width={320} height={420} sizes="320px" /> : null}
      </div>
      <h2 className={styles.infoPanelName}>{companionName}</h2>
      <p className={styles.infoPanelSub}>{panelBio}</p>

      <div className={styles.infoPanelActions}>
        <button type="button" className={styles.shareBtn} onClick={() => void shareCompanion()}>↑ Share</button>
        <button type="button" className={styles.resetBtn} disabled={resetPending || pending} onClick={() => void resetChat()}>
          {resetPending ? 'Clearing…' : 'Reset chat'}
        </button>
      </div>

      <div className={styles.infoTabs}>
        <button
          type="button"
          className={`${styles.infoTab} ${infoTab === 'photos' ? styles.infoTabActive : ''}`}
          onClick={() => setInfoTab('photos')}
        >
          Photos
        </button>
        <button
          type="button"
          className={`${styles.infoTab} ${infoTab === 'profile' ? styles.infoTabActive : ''}`}
          onClick={() => setInfoTab('profile')}
        >
          Profile
        </button>
      </div>

      {infoTab === 'photos' ? (
        sidebarImages.length > 0 ? (
          <div className={styles.photosWrap}>
            <UnlockableGallery
              companionName={companionName}
              images={sidebarImages}
              initialUnlockedIds={sidebarUnlocked}
              balance={pointBalance}
              cost={unblurCost}
              isPremium={isPremium}
              onBalanceChange={setPointBalance}
            />
          </div>
        ) : (
          <p className={styles.infoPanelSub}>No photos yet — {labels.chatSelfieHint}</p>
        )
      ) : (
        <div className={styles.infoPanelTraits}>
          <div className={styles.wardrobeList}>
            {outfitPresets.slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.wardrobeItem}
                disabled={pending || awaitingPhoto}
                onClick={() => void send(preset.message)}
              >
                <span aria-hidden>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
            <Link href={`/virtual-girlfriend/generate?companionId=${companionId}`} className={styles.studioLink}>
              Generate photo →
            </Link>
          </div>
          {occupation ? (
            <div className={styles.traitCard}>
              <span className={styles.traitLabel}>Occupation</span>
              <span className={styles.traitValue}>{occupation}</span>
            </div>
          ) : null}
          {personality ? (
            <div className={styles.traitCard}>
              <span className={styles.traitLabel}>Personality</span>
              <span className={styles.traitValue}>{personality}</span>
            </div>
          ) : null}
          {sexuality ? (
            <div className={styles.traitCard}>
              <span className={styles.traitLabel}>Sexuality</span>
              <span className={styles.traitValue}>{sexuality}</span>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div className={styles.chatLayout}>
      <main className={styles.chatMain}>
        <div className={styles.chatToolbar}>
          <Link href="/chats" className={styles.allChatsBtn}>
            ‹ All Chats
          </Link>
          <div className={styles.desktopToolbarCenter}>
            <div className={styles.desktopToolbarAvatar}>
              {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={32} height={32} sizes="32px" /> : <span>{companionName.charAt(0)}</span>}
            </div>
            <div className={styles.desktopToolbarInfo}>
              <span className={styles.desktopToolbarName}>{companionName}</span>
              <span
                className={
                  isTypingActivity || isPhotoActivity
                    ? `${styles.desktopToolbarStatus} ${styles.desktopToolbarStatusActive}`
                    : styles.desktopToolbarStatus
                }
              >
                {activityLabel}
              </span>
            </div>
          </div>
          <div className={styles.desktopToolbarEnd}>
            <span className={styles.pointsPill} aria-label={`${pointBalance} points`}>
              💜 {pointBalance}
            </span>
            <details className={styles.headerMenu}>
              <summary className={styles.menuTrigger}>⋯</summary>
              <div className={styles.menuPanel}>
                <p className={styles.menuMeta}>{helperText}</p>
                <p className={styles.menuLabel}>Tone presets</p>
                <div className={styles.menuButtons}>
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={styles.menuButton}
                      disabled={!isPremium || !!stylePending}
                      onClick={() => applyPreset(preset.key)}
                    >
                      {stylePending === preset.key ? 'Updating…' : preset.label}
                    </button>
                  ))}
                </div>
                <p className={styles.menuMeta}>
                  Adaptation {Math.round(styleProfile.adaptation_strength * 100)}% • stability {Math.round(styleProfile.stability_score * 100)}%
                </p>
              </div>
            </details>
          </div>
        </div>

        <header className={styles.chatHeader}>
          <Link href="/chats" className={styles.backButton} aria-label="Back to chats">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <button
            type="button"
            className={styles.companionHeaderTap}
            onClick={() => setCompanionSheetOpen(true)}
            aria-label={`Open ${companionName} profile`}
          >
            <div className={styles.headerAvatar}>
              {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={36} height={36} sizes="36px" /> : <span>{companionName.charAt(0)}</span>}
            </div>
            <div className={styles.companionHeaderInfo}>
              <span className={styles.headerName}>{companionName}</span>
              <span
                className={
                  isTypingActivity || isPhotoActivity
                    ? `${styles.companionHeaderStatus} ${styles.companionHeaderStatusActive}`
                    : styles.companionHeaderStatus
                }
              >
                {activityLabel}
              </span>
            </div>
          </button>
          <span className={styles.pointsPill} aria-label={`${pointBalance} points`}>
            💜 {pointBalance}
          </span>
          <details className={styles.headerMenu}>
            <summary className={styles.menuTrigger}>⋯</summary>
            <div className={styles.menuPanel}>
              <p className={styles.menuMeta}>{helperText}</p>
              <p className={styles.menuLabel}>Tone presets</p>
              <div className={styles.menuButtons}>
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={styles.menuButton}
                    disabled={!isPremium || !!stylePending}
                    onClick={() => applyPreset(preset.key)}
                  >
                    {stylePending === preset.key ? 'Updating…' : preset.label}
                  </button>
                ))}
              </div>
              <p className={styles.menuMeta}>
                Adaptation {Math.round(styleProfile.adaptation_strength * 100)}% • stability {Math.round(styleProfile.stability_score * 100)}%
              </p>
            </div>
          </details>
        </header>

        <div className={styles.messagesShell}>
          {backdropUrl ? (
            <div className={styles.portraitBackdrop} aria-hidden>
              <Image
                src={backdropUrl}
                alt=""
                fill
                sizes="100vw"
                className={styles.portraitBackdropImage}
                priority
              />
              <div className={styles.portraitScrim} />
            </div>
          ) : null}
          <div className={styles.messagesArea} ref={scrollRef}>
          {messages.map((message) => {
            const dateLabel = formatDateLabel(message.created_at);
            const showDate = dateLabel !== lastRenderedDate;
            if (showDate) lastRenderedDate = dateLabel;

            const isUser = message.role === 'user';

            if (isUser) {
              return (
                <div key={message.id}>
                  {showDate ? <div className={styles.datePill}>{dateLabel}</div> : null}
                  <div className={styles.messageUser}>
                    <div className={styles.bubbleUser}>
                      <p>{message.content}</p>
                      <span className={styles.timestamp}>{formatTime(message.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            const bubbles = dedupeMessageSegments(
              (message.content || '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
            );
            const renderBubbles = bubbles.length > 0 ? bubbles : [''];
            return (
              <div key={message.id}>
                {showDate ? <div className={styles.datePill}>{dateLabel}</div> : null}
                <div className={styles.messageCompanion}>
                <div className={styles.companionAvatar}>
                  {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={32} height={32} sizes="32px" /> : <span>{companionName.charAt(0)}</span>}
                </div>
                <div className={styles.bubbleGroup}>
                  {renderBubbles.map((part, idx) => (
                    <div key={idx} className={styles.bubbleCompanion}>
                      {idx === 0
                        ? message.attachments?.map((attachment) =>
                            attachment.kind === 'image' ? (
                              <ChatImageAttachment
                                key={attachment.imageId}
                                attachment={attachment}
                                companionName={companionName}
                                initialUnlocked={chatUnlockedIds.has(attachment.imageId)}
                                balance={pointBalance}
                                unblurCost={unblurCost}
                                isPremium={isPremium}
                                onUnlocked={(imageId, nextBalance) => {
                                  setPointBalance(nextBalance);
                                  setChatUnlockedIds((prev) => new Set(prev).add(imageId));
                                  setSidebarUnlocked((prev) => (prev.includes(imageId) ? prev : [imageId, ...prev]));
                                  setMessages((prev) =>
                                    prev.map((entry) => ({
                                      ...entry,
                                      attachments: entry.attachments?.map((item) =>
                                        item.imageId === imageId ? { ...item, locked: false } : item,
                                      ),
                                    })),
                                  );
                                }}
                              />
                            ) : null,
                          )
                        : null}
                      {part ? <p>{polishChatDisplayText(part)}</p> : null}
                      {idx === renderBubbles.length - 1 ? (
                        <div className={styles.messageActions}>
                          <span className={styles.timestamp}>{formatTime(message.created_at)}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            );
          })}

          {isTypingActivity ? (
            <div className={styles.messageCompanion}>
              <div className={styles.companionAvatar}>
                {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={32} height={32} sizes="32px" /> : <span>{companionName.charAt(0)}</span>}
              </div>
              <div
                className={styles.typingIndicator}
                role="status"
                aria-live="polite"
                aria-label={`${companionName} is typing`}
              >
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          ) : null}

          {isPhotoActivity ? (
            <div className={styles.messageCompanion}>
              <div className={styles.companionAvatar}>
                {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={32} height={32} sizes="32px" /> : <span>{companionName.charAt(0)}</span>}
              </div>
              <div
                className={styles.photoSendingIndicator}
                role="status"
                aria-live="polite"
                aria-label={`${companionName} is sharing a photo`}
              >
                <div className={styles.photoSendingShimmer} aria-hidden />
                <span className={styles.photoSendingLabel}>One moment…</span>
              </div>
            </div>
          ) : null}

          </div>
        </div>

        <div className={styles.quickChipRow}>
          {outfitPresets.slice(0, 5).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.quickChip}
              onClick={() => void send(preset.message)}
              disabled={pending || awaitingPhoto}
            >
              <span aria-hidden>{preset.icon}</span> {preset.label}
            </button>
          ))}
        </div>

        {companionGenerationStatus === 'generating' ? (
          <div className={styles.generationBanner} role="status">
            {companionName}&apos;s photos are still generating — chat works now; gallery fills in shortly.
          </div>
        ) : null}

        {error ? (
          <p className={styles.errorBanner} role="alert" aria-live="assertive">
            {error}
          </p>
        ) : null}

        <div className={styles.composerArea}>
          {outfitMenuOpen ? (
            <div className={styles.outfitMenu}>
              {outfitPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.outfitMenuItem}
                  disabled={pending || awaitingPhoto}
                  onClick={() => void send(preset.message)}
                >
                  <span className={styles.outfitMenuIcon}>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          {dailyLimitReached ? (
            <div className={styles.limitBox}>
              <p>
                Daily limit reached ({messagesUsedToday}/{dailyMessageLimit} messages). Premium removes the cap.
              </p>
              <div className={styles.limitActions}>
                <Link href="/premium" className={styles.linkButton}>
                  Upgrade to Premium
                </Link>
                <Link href="/chats" className={styles.linkButtonGhost}>
                  Back to chats
                </Link>
              </div>
            </div>
          ) : insufficientPoints ? (
            <div className={styles.limitBox}>
              <p>You need at least {messageCost} point to send a message.</p>
              <div className={styles.limitActions}>
                <Link href="/premium" className={styles.linkButton}>
                  Get Premium points
                </Link>
                <Link href={`/virtual-girlfriend/profile?companionId=${companionId}`} className={styles.linkButtonGhost}>
                  Back to profile
                </Link>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.attachButton} ${outfitMenuOpen ? styles.attachButtonActive : ''}`}
                aria-label="Wardrobe and outfit options"
                aria-expanded={outfitMenuOpen}
                onClick={() => setOutfitMenuOpen((open) => !open)}
                disabled={pending || awaitingPhoto}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <textarea
                className={styles.composerInput}
                placeholder={`Send a message to ${companionName}`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={2500}
                disabled={awaitingPhoto}
              />
              <button className={styles.sendButton} onClick={() => void send()} disabled={!draft.trim() || pending || awaitingPhoto} aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9l20-7z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </main>

      <aside className={styles.infoPanel}>{companionPanel}</aside>

      {companionSheetOpen ? (
        <div className={styles.mobileCompanionOverlay} role="dialog" aria-modal="true" aria-label={`${companionName} profile`}>
          <div className={styles.mobileCompanionSheet}>
            <header className={styles.mobileCompanionHeader}>
              <button type="button" className={styles.mobileCompanionBack} onClick={() => setCompanionSheetOpen(false)} aria-label="Back to chat">
                ‹
              </button>
              <span className={styles.mobileCompanionTitle}>{companionName}</span>
            </header>
            {companionPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
};
