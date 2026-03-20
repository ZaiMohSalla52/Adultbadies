'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendStyleControlPreset,
  VirtualGirlfriendUserStyleProfileRecord,
  VirtualGirlfriendChatImageOutcome,
  VirtualGirlfriendGenerationStatus,
} from '@/lib/virtual-girlfriend/types';
import styles from './chat-client.module.css';

type ChatClientProps = {
  companionId: string;
  companionName: string;
  companionAvatarUrl?: string | null;
  disclosureLabel: string;
  initialMessages: VirtualGirlfriendMessageRecord[];
  entitlements: Entitlements;
  usedToday: number;
  initialStyleProfile: VirtualGirlfriendUserStyleProfileRecord;
  isPremium: boolean;
  companionGenerationStatus: VirtualGirlfriendGenerationStatus;
  occupation?: string | null;
  personality?: string | null;
  sexuality?: string | null;
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

export const VirtualGirlfriendChatClient = ({
  companionId,
  companionName,
  companionAvatarUrl,
  disclosureLabel,
  initialMessages,
  entitlements,
  usedToday,
  initialStyleProfile,
  isPremium,
  companionGenerationStatus,
  occupation,
  personality,
  sexuality,
}: ChatClientProps) => {
  const [messages, setMessages] = useState(initialMessages);
  const [styleProfile, setStyleProfile] = useState(initialStyleProfile);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStarted, setStreamStarted] = useState(false);
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

  const limit = entitlements.limits.virtualGirlfriendMessagesPerDay;
  const reachedLimit = limit !== null && usedToday >= limit;

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || pending || reachedLimit) return;

    setPending(true);
    setIsStreaming(true);
    setStreamStarted(false);
    setError(null);

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
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Unable to send message.');
      setPending(false);
      setIsStreaming(false);
      return;
    }

    const assistantTempId = `temp-assistant-${Date.now()}`;
    const imageRequested = /\b(selfie|photo|pic|picture|look like)\b/i.test(text);
    setMessages((prev) => [
      ...prev,
      {
        id: assistantTempId,
        role: 'assistant',
        content: imageRequested ? 'Picking the perfect photo for you…' : '',
        conversation_id: 'temp',
        user_id: 'temp',
        created_at: new Date().toISOString(),
        moderation: {},
        model: null,
        token_count: null,
        content_type: 'text',
        attachments: [],
      },
    ]);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';

    while (!done) {
      const next = await reader.read();
      done = next.done;
      if (next.value) {
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: 'chunk'; chunk: string }
            | {
                type: 'done';
                payload: {
                  content: string;
                  contentType: 'text' | 'image' | 'mixed';
                  attachments: VirtualGirlfriendMessageAttachment[];
                  imageGeneration?: { requested: boolean; outcome: VirtualGirlfriendChatImageOutcome; reason: string | null };
                };
              };

          if (event.type === 'chunk') {
            setStreamStarted(true);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? {
                      ...message,
                      content: `${message.content === 'Picking the perfect photo for you…' ? '' : message.content}${event.chunk}`,
                    }
                  : message,
              ),
            );
          }

          if (event.type === 'done') {
            if (
              event.payload.imageGeneration?.requested
              && (event.payload.imageGeneration.outcome === 'failed_generation' || event.payload.imageGeneration.outcome === 'skipped_prerequisites')
            ) {
              setError('Photo request received, but we could not attach an image this turn. Try again in a moment.');
            }

            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? {
                      ...message,
                      content: event.payload.content,
                      content_type: event.payload.contentType,
                      attachments: event.payload.attachments,
                    }
                  : message,
              ),
            );
          }
        }
      }
    }

    setPending(false);
    setIsStreaming(false);
    setStreamStarted(false);
    setDraft('');
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
        const body = (await response.json().catch(() => ({}))) as { error?: string; upgradePath?: string };
        if (response.status === 402) {
          setError(body.error ?? 'Voice is available on Premium.');
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

  const helperText = useMemo(() => {
    if (limit === null) {
      return 'Premium messages available today.';
    }

    return `${usedToday}/${limit} messages today`;
  }, [limit, usedToday]);

  const avatarUrl = companionAvatarUrl ?? '';

  return (
    <div className={styles.chatLayout}>
      <main className={styles.chatMain}>
        <header className={styles.chatHeader}>
          <Link href="/virtual-girlfriend" className={styles.backButton} aria-label="Back to companions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className={styles.headerAvatar}>
            {avatarUrl ? <Image src={avatarUrl} alt={companionName} width={36} height={36} unoptimized /> : <span>{companionName.charAt(0)}</span>}
          </div>
          <div className={styles.companionHeaderInfo}>
            <span className={styles.headerName}>{companionName}</span>
            <span className={styles.companionHeaderStatus}>Online • {helperText}</span>
          </div>
          <details className={styles.headerMenu}>
            <summary className={styles.menuTrigger}>⋯</summary>
            <div className={styles.menuPanel}>
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

        <div className={styles.messagesArea} ref={scrollRef}>
          {messages.map((message) => {
            const isUser = message.role === 'user';

            if (isUser) {
              return (
                <div key={message.id} className={styles.messageUser}>
                  <div className={styles.bubbleUser}>
                    <p>{message.content}</p>
                    <span className={styles.timestamp}>{formatTime(message.created_at)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className={styles.messageCompanion}>
                <div className={styles.companionAvatar}>
                  {companionAvatarUrl ? <Image src={companionAvatarUrl} alt={companionName} width={32} height={32} unoptimized /> : <span>{companionName.charAt(0)}</span>}
                </div>
                <div className={styles.bubbleCompanion}>
                  {message.attachments?.map((attachment) =>
                    attachment.kind === 'image' ? (
                      <div key={attachment.imageId} className={styles.chatImage}>
                        <Image
                          src={attachment.imageUrl}
                          alt="Generated"
                          width={attachment.width ?? 1024}
                          height={attachment.height ?? 1024}
                          unoptimized
                        />
                      </div>
                    ) : null,
                  )}
                  <p>{message.content}</p>
                  <div className={styles.messageActions}>
                    <span className={styles.timestamp}>{formatTime(message.created_at)}</span>
                    <button type="button" className={styles.likeBtn} aria-label="Like message">👍</button>
                    <button type="button" className={styles.dislikeBtn} aria-label="Dislike message">👎</button>
                  </div>
                </div>
              </div>
            );
          })}

          {isStreaming && !streamStarted ? (
            <div className={styles.messageCompanion}>
              <div className={styles.companionAvatar}>
                {companionAvatarUrl ? <Image src={companionAvatarUrl} alt={companionName} width={32} height={32} unoptimized /> : <span>{companionName.charAt(0)}</span>}
              </div>
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.composerArea}>
          {reachedLimit ? (
            <div className={styles.limitBox}>
              <p>You reached today&apos;s free message limit.</p>
              <div className={styles.limitActions}>
                <Link href="/premium" className={styles.linkButton}>
                  Upgrade to Premium
                </Link>
                <Link href={`/virtual-girlfriend/profile?companionId=${companionId}`} className={styles.linkButtonGhost}>
                  Back to profile
                </Link>
              </div>
            </div>
          ) : (
            <>
              <textarea
                className={styles.composerInput}
                placeholder={`Message ${companionName}...`}
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
              <button className={styles.sendButton} onClick={() => void send()} disabled={!draft.trim() || pending}>
                →
              </button>
            </>
          )}
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </main>

      <aside className={styles.infoPanel}>
        <div className={styles.infoPanelPortrait}>
          {companionAvatarUrl ? <Image src={companionAvatarUrl} alt={companionName} width={320} height={420} unoptimized /> : null}
        </div>
        <h2 className={styles.infoPanelName}>{companionName}</h2>
        <p className={styles.infoPanelSub}>{disclosureLabel}</p>

        <div className={styles.infoPanelActions}>
          <button type="button" className={styles.shareBtn}>↑ Share</button>
          <button type="button" className={styles.resetBtn} onClick={() => setMessages(initialMessages)}>Reset chat</button>
        </div>

        <div className={styles.infoPanelTraits}>
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
      </aside>
    </div>
  );
};
