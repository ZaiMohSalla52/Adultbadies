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
  const [sidebarImages, setSidebarImages] = useState(galleryImages);
  const [sidebarUnlocked, setSidebarUnlocked] = useState(unlockedImageIds);
  const [stylePending, setStylePending] = useState<VirtualGirlfriendStyleControlPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voicePending, setVoicePending] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'ready' | 'expired' | 'reconnecting' | 'disconnected'>('idle');
  const [voiceSession, setVoiceSession] = useState<{
    id: string | null;
    clientSecret: string;
    expiresAt: string | null;
    model: string;
    companion: { id: string; name: string };
    memoryCount: number;
    styleAdaptationStrength: number;
  } | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isCompanionSpeaking, setIsCompanionSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);

  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const companionAudioContextRef = useRef<AudioContext | null>(null);
  const companionAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const companionMeterFrameRef = useRef<number | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const eventsChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRunRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messageCost = POINTS.messageCost;
  const insufficientPoints = pointBalance < messageCost;
  const outfitPresets = useMemo(() => getOutfitPresetsForSex(companionSex), [companionSex]);
  const labels = useMemo(() => getCompanionLabels(companionSex), [companionSex]);

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
    scrollToBottom();
  }, []);

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

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || pending || insufficientPoints) return;

    setPending(true);
    setIsStreaming(true);
    setCompanionActivity('typing');
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
      };
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id));
      if (body.code === 'INSUFFICIENT_POINTS') {
        if (typeof body.balance === 'number') setPointBalance(body.balance);
        setError(`Not enough points. Each message costs ${messageCost} point.`);
      } else {
        setError(body.error ?? 'Unable to send message.');
      }
      setPending(false);
      setIsStreaming(false);
      setCompanionActivity('idle');
      return;
    }

    setPointBalance((prev) => Math.max(0, prev - messageCost));

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
      | { type: 'text_done'; payload: { content: string; segments?: string[]; contentType: 'text' | 'image' | 'mixed' } }
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
      if (!attachment.locked) {
        setSidebarUnlocked((prev) => (prev.includes(attachment.imageId) ? prev : [attachment.imageId, ...prev]));
        setChatUnlockedIds((prev) => new Set(prev).add(attachment.imageId));
      }
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
            setCompanionActivity('idle');
            return data.attachment;
          }
        } catch {
          // keep polling through transient mobile network drops
        }
      }
      return null;
    };

    const ensureStreamingAssistant = (token: string) => {
      const streamId = streamState.assistantId ?? `temp-assistant-${Date.now()}`;
      streamState.assistantId = streamId;

      setMessages((prev) => {
        const existing = prev.find((message) => message.id === streamId);
        const rawContent = existing ? `${existing.content}${token}` : token;
        const content = polishChatDisplayText(rawContent);
        if (existing) {
          return prev.map((message) =>
            message.id === streamId
              ? { ...message, content }
              : message,
          );
        }

        return [
          ...prev,
          {
            id: streamId,
            role: 'assistant' as const,
            content,
            conversation_id: 'temp',
            user_id: 'temp',
            created_at: new Date().toISOString(),
            moderation: {},
            model: null,
            token_count: null,
            content_type: 'text' as const,
            attachments: [],
          },
        ];
      });
      scrollToBottom();
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

    const finalizeSegments = (segments: string[], contentType: DonePayload['contentType']) => {
      if (!streamState.assistantId) return;

      const streamId = streamState.assistantId;
      if (segments.length > 1) {
        streamState.assistantId = `${streamId}-0`;
      }
      setMessages((prev) => {
        const withoutStream = prev.filter((message) => message.id !== streamId);
        const createdAt = new Date().toISOString();

        if (segments.length <= 1) {
          return [
            ...withoutStream,
            {
              id: streamId,
              role: 'assistant' as const,
              content: segments[0] ?? '',
              conversation_id: 'temp',
              user_id: 'temp',
              created_at: createdAt,
              moderation: {},
              model: null,
              token_count: null,
              content_type: liveAttachments.length > 0 ? contentType : 'text',
              attachments: liveAttachments,
            },
          ];
        }

        return [
          ...withoutStream,
          ...segments.map((segment, index) => ({
            id: `${streamId}-${index}`,
            role: 'assistant' as const,
            content: segment,
            conversation_id: 'temp',
            user_id: 'temp',
            created_at: createdAt,
            moderation: {},
            model: null,
            token_count: null,
            content_type: index === 0 && liveAttachments.length > 0 ? contentType : 'text',
            attachments: index === 0 ? liveAttachments : [],
          })),
        ];
      });
      scrollToBottom();
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
            ensureStreamingAssistant(event.payload.token);
          }

          if (event.type === 'text_done') {
            const segments =
              event.payload.segments && event.payload.segments.length > 0
                ? event.payload.segments
                : [event.payload.content];
            finalizeSegments(segments, event.payload.contentType);
            setCompanionActivity(photoPending ? 'sending_photo' : 'idle');
          }

          if (event.type === 'image_generating') {
            photoPending = event.payload.active;
            if (photoPending) setCompanionActivity('sending_photo');
          }

          if (event.type === 'ping') {
            if (photoPending) setCompanionActivity('sending_photo');
          }

          if (event.type === 'image') {
            photoPending = false;
            setCompanionActivity('idle');
            attachImageToAssistant(event.payload.attachment);
            registerChatImage(event.payload.attachment);
          }

          if (event.type === 'image_failed') {
            photoPending = false;
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
            return;
          }

          if (event.type === 'done') payload = event.payload;
        }
      }
    }

    if (!payload) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUser.id));
      setError('Unable to receive a reply right now.');
      setPending(false);
      setIsStreaming(false);
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

    if (payload.imageGeneration?.requested && !imageAttachment && payload.assistantMessageId) {
      setCompanionActivity('sending_photo');
      const polled = await pollForMessageAttachment(payload.assistantMessageId);
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

    setPending(false);
    setIsStreaming(false);
    setCompanionActivity('idle');
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

  const closeCompanionMeter = () => {
    if (companionMeterFrameRef.current !== null) {
      window.cancelAnimationFrame(companionMeterFrameRef.current);
      companionMeterFrameRef.current = null;
    }
    companionAnalyserRef.current = null;

    if (companionAudioContextRef.current) {
      void companionAudioContextRef.current.close();
      companionAudioContextRef.current = null;
    }
  };

  const stopVoiceMeter = () => {
    if (meterFrameRef.current !== null) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const stopMicrophoneStream = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setIsMicActive(false);
    setVoiceLevel(0);
  };

  const teardownVoiceRealtimeUi = () => {
    closeCompanionMeter();
    stopVoiceMeter();
    stopMicrophoneStream();
    if (eventsChannelRef.current) {
      eventsChannelRef.current.close();
      eventsChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    remoteStreamRef.current = null;
    setIsListening(false);
    setMicMuted(false);
    setVoiceLevel(0);
    setIsMicActive(false);
    setIsCompanionSpeaking(false);
  };

  const startCompanionMeter = (stream: MediaStream) => {
    closeCompanionMeter();

    const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    companionAudioContextRef.current = audioContext;
    companionAnalyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      const meter = companionAnalyserRef.current;
      if (!meter) return;

      meter.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      setIsCompanionSpeaking(rms > 0.03);
      companionMeterFrameRef.current = window.requestAnimationFrame(tick);
    };

    companionMeterFrameRef.current = window.requestAnimationFrame(tick);
  };

  const startVoiceMeter = (stream: MediaStream) => {
    stopVoiceMeter();

    const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    let userSpeakingFrames = 0;

    const tick = () => {
      const meter = analyserRef.current;
      if (!meter) return;

      meter.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 8.2);
      setVoiceLevel(level);

      if (!micMuted && voiceSession && peerConnectionRef.current) {
        setIsListening(true);

        if (level > 0.15) {
          userSpeakingFrames += 1;
          if (userSpeakingFrames > 2) {
            setIsMicActive(true);
          }
        } else {
          userSpeakingFrames = 0;
          setIsMicActive(false);
        }
      } else {
        setIsListening(false);
        setIsMicActive(false);
      }

      meterFrameRef.current = window.requestAnimationFrame(tick);
    };

    meterFrameRef.current = window.requestAnimationFrame(tick);
  };

  const checkMicrophoneAccess = async () => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      return { ok: false, message: 'Microphone access is required.' } as const;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { ok: true, stream } as const;
    } catch {
      return { ok: false, message: 'Microphone access is required.' } as const;
    }
  };

  const startVoiceSession = async () => {
    if (!isPremium || voicePending || voiceStatus === 'connecting' || voiceStatus === 'reconnecting') return;
    if (companionGenerationStatus !== 'ready') {
      setError('Voice unlocks once this companion finishes generation.');
      return;
    }
    if (!companionId) {
      setError('No companion selected.');
      return;
    }

    voiceRunRef.current += 1;
    const runId = voiceRunRef.current;
    const isCurrentRun = () => voiceRunRef.current === runId;

    if (voiceSession || peerConnectionRef.current || micStreamRef.current) {
      teardownVoiceRealtimeUi();
      setVoiceSession(null);
    }

    setVoicePending(true);
    setVoiceStatus(voiceSession ? 'reconnecting' : 'connecting');
    setError(null);

    const mic = await checkMicrophoneAccess();
    if (!mic.ok) {
      if (!isCurrentRun()) return;
      setError(mic.message);
      setVoicePending(false);
      setVoiceStatus('disconnected');
      teardownVoiceRealtimeUi();
      return;
    }

    try {
      const response = await fetch('/api/virtual-girlfriend/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });

      if (!response.ok) {
        if (!isCurrentRun()) {
          mic.stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const body = (await response.json().catch(() => ({}))) as { error?: string; upgradePath?: string; code?: string };
        if (response.status === 402) {
          setError(body.error ?? 'Voice is available on Premium.');
        } else if (response.status === 503 && body.code === 'VG_VOICE_PROVIDER_UNAVAILABLE') {
          setError(body.error ?? 'Voice chat is temporarily unavailable while we migrate to Together AI.');
        } else if (response.status === 409) {
          setError(body.error ?? 'Voice unlocks once this companion finishes generation.');
        } else if (response.status === 400) {
          setError(body.error ?? 'No companion selected.');
        } else {
          setError(body.error ?? 'Unable to start voice session. Check your connection and try again.');
        }
        setVoiceSession(null);
        setVoicePending(false);
        setVoiceStatus('disconnected');
        teardownVoiceRealtimeUi();
        mic.stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const body = (await response.json()) as {
        session: {
          id: string | null;
          clientSecret: string;
          expiresAt: string | null;
          model: string;
          companion: { id: string; name: string };
          memoryCount: number;
          styleAdaptationStrength: number;
        };
      };

      const session = body.session;
      if (!session || typeof session.clientSecret !== 'string' || !session.clientSecret || typeof session.model !== 'string' || !session.model) {
        throw new Error('Voice session bootstrap returned an invalid payload.');
      }

      const connectResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: await (async () => {
          const peerConnection = new RTCPeerConnection();
          peerConnectionRef.current = peerConnection;

          const remoteAudio = new Audio();
          remoteAudio.autoplay = true;
          remoteAudioRef.current = remoteAudio;

          peerConnection.ontrack = (event) => {
            const stream = event.streams[0];
            if (!stream) return;
            remoteStreamRef.current = stream;
            remoteAudio.srcObject = stream;
            void remoteAudio.play().catch(() => {
              setError('Audio playback was blocked. Tap Start voice again to resume playback.');
            });
            startCompanionMeter(stream);
          };

          peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            if (state === 'connected') {
              if (!isCurrentRun()) return;
              setVoiceStatus('ready');
              setError(null);
              return;
            }
            if (state === 'connecting') {
              if (!isCurrentRun()) return;
              setVoiceStatus('connecting');
              return;
            }
            if (state === 'disconnected') {
              if (!isCurrentRun()) return;
              setIsListening(false);
              setIsMicActive(false);
              setIsCompanionSpeaking(false);
              setVoiceStatus('disconnected');
              return;
            }
            if (state === 'failed') {
              if (!isCurrentRun()) return;
              setIsListening(false);
              setIsMicActive(false);
              setIsCompanionSpeaking(false);
              setVoiceStatus('disconnected');
              setError('Voice connection failed. Restart voice to continue.');
              return;
            }
            if (state === 'closed') {
              if (!isCurrentRun()) return;
              setIsListening(false);
              setIsMicActive(false);
              setIsCompanionSpeaking(false);
              setVoiceStatus('disconnected');
            }
          };

          peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            if (!isCurrentRun()) return;
            if (state === 'checking') setVoiceStatus('connecting');
            if (state === 'disconnected') {
              setIsListening(false);
              setIsMicActive(false);
              setIsCompanionSpeaking(false);
              setVoiceStatus('reconnecting');
            }
            if (state === 'failed') {
              setIsListening(false);
              setIsMicActive(false);
              setIsCompanionSpeaking(false);
              setVoiceStatus('disconnected');
              setError('Voice network path failed. Restart voice to reconnect.');
            }
          };

          const channel = peerConnection.createDataChannel('oai-events');
          eventsChannelRef.current = channel;
          channel.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data) as { type?: string };
              if (payload.type === 'response.audio.done') {
                setIsCompanionSpeaking(false);
              }
              if (payload.type === 'output_audio_buffer.started') {
                setIsCompanionSpeaking(true);
              }
              if (payload.type === 'output_audio_buffer.stopped') {
                setIsCompanionSpeaking(false);
              }
            } catch {
              // Ignore non-JSON event payloads from transport.
            }
          };

          mic.stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, mic.stream);
          });

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          return offer.sdp ?? '';
        })(),
      });

      if (!connectResponse.ok) {
        throw new Error(`Realtime SDP exchange failed (${connectResponse.status}).`);
      }

      const answerSdp = await connectResponse.text();
      if (!isCurrentRun()) {
        mic.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        throw new Error('Realtime peer connection was not initialized.');
      }
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      micStreamRef.current = mic.stream;
      setMicMuted(false);
      startVoiceMeter(mic.stream);
      setVoiceSession(session);
      setVoiceStatus('connecting');
      setVoicePending(false);
    } catch {
      if (!isCurrentRun()) return;
      setError('Unable to start voice session. Check your connection and try again.');
      setVoiceSession(null);
      setVoiceStatus('disconnected');
      setVoicePending(false);
      teardownVoiceRealtimeUi();
      mic.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const endVoiceSession = () => {
    voiceRunRef.current += 1;
    setVoiceSession(null);
    setVoiceStatus('idle');
    teardownVoiceRealtimeUi();
  };

  const toggleMicMute = () => {
    const next = !micMuted;
    setMicMuted(next);

    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }

    if (next) {
      setIsMicActive(false);
      setIsListening(false);
      setVoiceLevel(0);
      setIsCompanionSpeaking(false);
    }
  };

  useEffect(() => {
    if (voiceSession && !voiceSession.expiresAt) return;
    if (!voiceSession?.expiresAt) return;

    const expiresAtMs = new Date(voiceSession.expiresAt).getTime();
    const timeout = window.setTimeout(
      () => {
        voiceRunRef.current += 1;
        closeCompanionMeter();
        stopVoiceMeter();
        stopMicrophoneStream();
        if (eventsChannelRef.current) {
          eventsChannelRef.current.close();
          eventsChannelRef.current = null;
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause();
          remoteAudioRef.current.srcObject = null;
          remoteAudioRef.current = null;
        }
        remoteStreamRef.current = null;
        setVoiceSession(null);
        setVoiceStatus('expired');
        setIsListening(false);
        setIsMicActive(false);
        setVoiceLevel(0);
        setIsCompanionSpeaking(false);
      },
      Math.max(0, expiresAtMs - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [voiceSession]);

  useEffect(() => {
    return () => {
      closeCompanionMeter();
      stopVoiceMeter();
      stopMicrophoneStream();
      if (eventsChannelRef.current) {
        eventsChannelRef.current.close();
        eventsChannelRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current = null;
      }
      remoteStreamRef.current = null;
      setIsListening(false);
      setIsCompanionSpeaking(false);
    };
  }, []);

  const isVoiceExpired = useMemo(() => {
    if (!voiceSession?.expiresAt) return false;
    return new Date(voiceSession.expiresAt).getTime() <= Date.now();
  }, [voiceSession]);

  const voiceStatusText = useMemo(() => {
    if (!isPremium) return 'Voice is available on Premium.';
    if (!companionId) return 'No companion selected.';
    if (companionGenerationStatus !== 'ready') return 'Voice unlocks after this companion finishes profile generation.';
    if (voiceStatus === 'connecting') return 'Connecting…';
    if (voiceStatus === 'reconnecting') return 'Reconnecting…';
    if (voiceStatus === 'disconnected') return 'Connection dropped. Restart voice to continue.';
    if (voiceSession && (isVoiceExpired || voiceStatus === 'expired')) return 'Session expired, refresh to continue.';
    if (voiceStatus === 'ready' && voiceSession) return 'Voice session ready.';
    return 'This initializes a companion-scoped realtime token with persona, style adaptation, and memory context.';
  }, [companionGenerationStatus, companionId, isPremium, isVoiceExpired, voiceSession, voiceStatus]);

  const voiceStatusTone =
    voiceStatus === 'connecting' || voiceStatus === 'reconnecting'
      ? styles.voiceToneConnecting
      : voiceStatus === 'ready' && !isVoiceExpired
        ? styles.voiceToneReady
        : voiceStatus === 'disconnected' || voiceStatus === 'expired' || isVoiceExpired
          ? styles.voiceToneWarning
          : '';

  const helperText = useMemo(
    () => `💜 ${pointBalance} points · ${messageCost} per message · unblur ${POINTS.unblurCost} pts`,
    [pointBalance, messageCost],
  );

  const avatarUrl = liveAvatarUrl;
  const backdropUrl = liveBackdropUrl;

  const panelBio = companionBio?.trim() || personality?.trim() || occupation?.trim() || `${companionName} is ready to chat.`;

  let lastRenderedDate = '';

  return (
    <div className={styles.chatLayout}>
      <main className={styles.chatMain}>
        <div className={styles.chatToolbar}>
          <Link href="/chats" className={styles.allChatsBtn}>
            ‹ All Chats
          </Link>
        </div>

        <header className={styles.chatHeader}>
          <Link href="/chats" className={styles.backButton} aria-label="Back to chats">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className={styles.headerAvatar}>
            {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={36} height={36} sizes="36px" /> : <span>{companionName.charAt(0)}</span>}
          </div>
          <div className={styles.companionHeaderInfo}>
            <span className={styles.headerName}>{companionName}</span>
            <span
              className={
                companionActivity === 'idle'
                  ? styles.companionHeaderStatus
                  : `${styles.companionHeaderStatus} ${styles.companionHeaderStatusActive}`
              }
            >
              {companionActivity === 'typing'
                ? 'typing…'
                : companionActivity === 'sending_photo'
                  ? 'sending a photo…'
                  : 'online'}
            </span>
          </div>
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
              <p className={styles.menuLabel}>Voice (Premium)</p>
              <p className={styles.menuMeta}>{voiceStatusText}</p>
              <div className={styles.voiceControls}>
                <button
                  type="button"
                  className={styles.menuButton}
                  disabled={
                    !isPremium
                    || voicePending
                    || voiceStatus === 'connecting'
                    || voiceStatus === 'reconnecting'
                    || !companionId
                    || companionGenerationStatus !== 'ready'
                  }
                  onClick={startVoiceSession}
                >
                  {voicePending || voiceStatus === 'connecting' || voiceStatus === 'reconnecting'
                    ? voiceStatus === 'reconnecting'
                      ? 'Reconnecting…'
                      : 'Connecting…'
                    : voiceSession
                      ? 'Refresh voice session'
                      : 'Start voice session'}
                </button>
                {voiceSession ? (
                  <>
                    <button type="button" className={styles.menuButton} onClick={toggleMicMute}>
                      {micMuted ? 'Unmute microphone' : 'Mute microphone'}
                    </button>
                    <button type="button" className={styles.menuButton} onClick={endVoiceSession}>
                      End session
                    </button>
                  </>
                ) : null}
              </div>
              <div className={styles.voiceIndicators}>
                <span className={`${styles.voiceIndicator} ${voiceStatusTone}`}>Status</span>
                <span className={`${styles.voiceIndicator} ${isCompanionSpeaking ? styles.isLive : ''}`}>Companion</span>
                <span className={`${styles.voiceIndicator} ${isMicActive && !micMuted ? styles.isLive : ''}`}>Mic</span>
                <span className={`${styles.voiceIndicator} ${isListening && !micMuted ? styles.isLive : ''}`}>Listening</span>
              </div>
              <div className={styles.voiceWave} aria-label="Voice activity">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const phase = (idx % 4) / 4;
                  const activity = isCompanionSpeaking ? 0.75 : isMicActive ? 0.58 : isListening && !micMuted ? Math.max(0.16, voiceLevel * 0.5) : 0.12;
                  const barScale = 0.32 + activity + phase * 0.16;
                  return <span key={idx} className={styles.voiceWaveBar} style={{ transform: `scaleY(${Math.min(1.8, barScale)})` }} />;
                })}
              </div>
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

            const bubbles = (message.content || '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
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
                                initialUnlocked={chatUnlockedIds.has(attachment.imageId) || !attachment.locked}
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
                          <button type="button" className={styles.likeBtn} aria-label="Like message">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                          </button>
                          <button type="button" className={styles.dislikeBtn} aria-label="Dislike message">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            );
          })}

          {isStreaming && companionActivity === 'typing' && !messages.some((message) => message.id.startsWith('temp-assistant-')) ? (
            <div className={styles.messageCompanion}>
              <div className={styles.companionAvatar}>
                {avatarUrl ? <ChatAvatarImage src={avatarUrl} alt={companionName} width={32} height={32} sizes="32px" /> : <span>{companionName.charAt(0)}</span>}
              </div>
              <div className={styles.typingIndicator} aria-label={`${companionName} is typing`}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
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
              disabled={pending}
            >
              <span aria-hidden>{preset.icon}</span> {preset.label}
            </button>
          ))}
        </div>

        <div className={styles.composerArea}>
          {outfitMenuOpen ? (
            <div className={styles.outfitMenu}>
              {outfitPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.outfitMenuItem}
                  disabled={pending}
                  onClick={() => void send(preset.message)}
                >
                  <span className={styles.outfitMenuIcon}>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          {insufficientPoints ? (
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
                disabled={pending}
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
              />
              <button className={styles.sendButton} onClick={() => void send()} disabled={!draft.trim() || pending} aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9l20-7z" />
                </svg>
              </button>
            </>
          )}
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </main>

      <aside className={styles.infoPanel}>
        <div className={styles.infoPanelPortrait}>
          {backdropUrl ? <ChatAvatarImage src={backdropUrl} alt={companionName} width={320} height={420} sizes="320px" /> : null}
        </div>
        <h2 className={styles.infoPanelName}>{companionName}</h2>
        <p className={styles.infoPanelSub}>{panelBio}</p>

        <div className={styles.infoPanelActions}>
          <button type="button" className={styles.shareBtn}>↑ Share</button>
          <button type="button" className={styles.resetBtn} onClick={() => setMessages(initialMessages)}>Reset chat</button>
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
                  disabled={pending}
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
      </aside>
    </div>
  );
};
