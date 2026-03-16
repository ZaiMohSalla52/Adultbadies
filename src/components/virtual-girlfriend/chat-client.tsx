'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendStyleControlPreset,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

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
};

const STYLE_PRESETS: Array<{ key: VirtualGirlfriendStyleControlPreset; label: string }> = [
  { key: 'more_playful', label: 'More playful' },
  { key: 'more_caring', label: 'More caring' },
  { key: 'shorter_replies', label: 'Shorter replies' },
  { key: 'bolder_flirting', label: 'Bolder flirting' },
];

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
}: ChatClientProps) => {
  const [messages, setMessages] = useState(initialMessages);
  const [styleProfile, setStyleProfile] = useState(initialStyleProfile);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const companionPulseTimeoutRef = useRef<number | null>(null);

  const limit = entitlements.limits.virtualGirlfriendMessagesPerDay;
  const reachedLimit = limit !== null && usedToday >= limit;

  const send = async () => {
    const text = draft.trim();
    if (!text || pending || reachedLimit) return;

    setPending(true);
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
    setDraft('');

    const response = await fetch('/api/virtual-girlfriend/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, companionId }),
    });

    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Unable to send message.');
      setPending(false);
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
                payload: { content: string; contentType: 'text' | 'image' | 'mixed'; attachments: VirtualGirlfriendMessageAttachment[] };
              };

          if (event.type === 'chunk') {
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
    window.location.reload();
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


  const clearCompanionPulse = () => {
    if (companionPulseTimeoutRef.current !== null) {
      window.clearTimeout(companionPulseTimeoutRef.current);
      companionPulseTimeoutRef.current = null;
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
    clearCompanionPulse();
    stopVoiceMeter();
    stopMicrophoneStream();
    setIsListening(false);
    setIsCompanionSpeaking(false);
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

      if (!micMuted && voiceSession) {
        setIsListening(true);

        if (level > 0.15) {
          userSpeakingFrames += 1;
          if (userSpeakingFrames > 2) {
            clearCompanionPulse();
            setIsMicActive(true);
            setIsCompanionSpeaking(false);
          }
        } else {
          userSpeakingFrames = 0;
          setIsMicActive(false);
          if (!isCompanionSpeaking) {
            clearCompanionPulse();
            companionPulseTimeoutRef.current = window.setTimeout(() => {
              setIsCompanionSpeaking(true);
              companionPulseTimeoutRef.current = window.setTimeout(() => {
                setIsCompanionSpeaking(false);
              }, 1300);
            }, 320);
          }
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
    if (!isPremium || voicePending) return;
    if (!companionId) {
      setError('No companion selected.');
      return;
    }

    setVoicePending(true);
    setVoiceStatus(voiceSession ? 'reconnecting' : 'connecting');
    setError(null);

    const mic = await checkMicrophoneAccess();
    if (!mic.ok) {
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
        const body = (await response.json().catch(() => ({}))) as { error?: string; upgradePath?: string };
        if (response.status === 402) {
          setError(body.error ?? 'Voice is available on Premium.');
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

      micStreamRef.current = mic.stream;
      setMicMuted(false);
      startVoiceMeter(mic.stream);
      setVoiceSession(body.session);
      setVoiceStatus('ready');
      setVoicePending(false);
    } catch {
      setError('Unable to start voice session. Check your connection and try again.');
      setVoiceSession(null);
      setVoiceStatus('disconnected');
      setVoicePending(false);
      teardownVoiceRealtimeUi();
      mic.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const endVoiceSession = () => {
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
    }
  };

  useEffect(() => {
    if (voiceSession && !voiceSession.expiresAt) return;
    if (!voiceSession?.expiresAt) return;

    const expiresAtMs = new Date(voiceSession.expiresAt).getTime();
    const timeout = window.setTimeout(
      () => {
        setVoiceStatus('expired');
        setIsListening(false);
        setIsCompanionSpeaking(false);
      },
      Math.max(0, expiresAtMs - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [voiceSession]);

  useEffect(() => {
    return () => {
      clearCompanionPulse();
      stopVoiceMeter();
      stopMicrophoneStream();
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
    if (voiceStatus === 'connecting') return 'Connecting…';
    if (voiceStatus === 'reconnecting') return 'Reconnecting…';
    if (voiceStatus === 'disconnected') return 'Connection dropped. Restart voice to continue.';
    if (voiceSession && (isVoiceExpired || voiceStatus === 'expired')) return 'Session expired, refresh to continue.';
    if (voiceStatus === 'ready' && voiceSession) return 'Voice session ready.';
    return 'This initializes a companion-scoped realtime token with persona, style adaptation, and memory context.';
  }, [companionId, isPremium, isVoiceExpired, voiceSession, voiceStatus]);

  const voiceStatusTone =
    voiceStatus === 'connecting' || voiceStatus === 'reconnecting'
      ? 'connecting'
      : voiceStatus === 'ready' && !isVoiceExpired
        ? 'ready'
        : voiceStatus === 'disconnected' || voiceStatus === 'expired' || isVoiceExpired
          ? 'warning'
          : 'idle';

  const helperText = useMemo(() => {
    if (limit === null) {
      return 'Premium messages available today.';
    }

    return `${usedToday}/${limit} messages today`;
  }, [limit, usedToday]);

  return (
    <div className="chat-screen">
      <header className="chat-conversation-header chat-conversation-header-refined">
        <div className="chat-title-wrap">
          <Avatar name={companionName} imageUrl={companionAvatarUrl} kind="ai" size="lg" ring isActive />
          <div>
            <h1 className="my-0 chat-title">{companionName}</h1>
            <p className="my-0 text-xs text-muted">{disclosureLabel}</p>
          </div>
        </div>
        <p className="my-0 text-xs text-muted chat-usage-pill">{helperText}</p>
      </header>

      <section className="chat-style-controls">
        <details>
          <summary className="chat-style-summary">Tone preferences</summary>
          <div className="chat-style-controls-grid">
            {STYLE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="secondary"
                disabled={!isPremium || !!stylePending}
                onClick={() => applyPreset(preset.key)}
              >
                {stylePending === preset.key ? 'Updating…' : preset.label}
              </Button>
            ))}
            {!isPremium ? <p className="my-0 text-xs text-muted">Premium unlocks tone steering.</p> : null}
          </div>
          <p className="my-0 text-xs text-muted">
            Adaptation {Math.round(styleProfile.adaptation_strength * 100)}% • stability{' '}
            {Math.round(styleProfile.stability_score * 100)}%
          </p>
        </details>
      </section>


      <section className="chat-style-controls">
        <details open className="vg-voice-panel">
          <summary className="chat-style-summary">Voice (Premium)</summary>
          <div className="vg-voice-header">
            <div className="vg-voice-avatar" aria-hidden>
              {companionName.slice(0, 1).toUpperCase()}
            </div>
            <div className="vg-voice-header-copy">
              <p className="my-0 vg-voice-title">Live voice with {companionName}</p>
              <p className="my-0 text-xs text-muted">Low-latency companion session</p>
            </div>
            <span className={`vg-voice-status-pill vg-voice-status-pill-${voiceStatusTone}`}>{voiceStatusText}</span>
          </div>

          <div className="vg-voice-wave" aria-label="Voice activity">
            {Array.from({ length: 16 }).map((_, idx) => {
              const phase = (idx % 4) / 4;
              const activity = isCompanionSpeaking ? 0.75 : isMicActive ? 0.58 : isListening && !micMuted ? Math.max(0.16, voiceLevel * 0.5) : 0.12;
              const barScale = 0.32 + activity + phase * 0.16;
              return <span key={idx} className="vg-voice-wave-bar" style={{ transform: `scaleY(${Math.min(1.8, barScale)})` }} />;
            })}
          </div>

          <div className="vg-voice-indicators">
            <span className={`vg-voice-indicator ${isCompanionSpeaking ? 'is-live' : ''}`}>Companion speaking</span>
            <span className={`vg-voice-indicator ${isMicActive && !micMuted ? 'is-live' : ''}`}>Your mic active</span>
            <span className={`vg-voice-indicator ${isListening && !micMuted ? 'is-live' : ''}`}>System listening</span>
          </div>

          <div className="chat-style-controls-grid">
            <Button type="button" variant="secondary" disabled={!isPremium || voicePending || !companionId} onClick={startVoiceSession}>
              {voicePending || voiceStatus === 'connecting' || voiceStatus === 'reconnecting'
                ? voiceStatus === 'reconnecting'
                  ? 'Reconnecting…'
                  : 'Connecting…'
                : voiceSession
                  ? 'Refresh voice session'
                  : 'Start voice session'}
            </Button>
            {voiceSession ? (
              <>
                <Button type="button" variant="ghost" onClick={toggleMicMute}>
                  {micMuted ? 'Unmute microphone' : 'Mute microphone'}
                </Button>
                <Button type="button" variant="ghost" onClick={endVoiceSession}>
                  End session
                </Button>
              </>
            ) : null}
            {(voiceStatus === 'disconnected' || isVoiceExpired || voiceStatus === 'expired') && isPremium ? (
              <Button type="button" variant="secondary" disabled={voicePending || !companionId} onClick={startVoiceSession}>
                Restart voice
              </Button>
            ) : null}
            {!isPremium ? (
              <p className="my-0 text-xs text-muted">Voice is available on Premium. Upgrade to unlock realtime companion calls.</p>
            ) : null}
          </div>

          {voiceSession ? (
            <p className="my-0 text-xs text-muted">
              {isVoiceExpired ? 'Session expired, refresh to continue.' : `Voice session ready for ${voiceSession.companion.name}.`} • model {voiceSession.model}
              {voiceSession.expiresAt ? ` • expires ${new Date(voiceSession.expiresAt).toLocaleTimeString()}` : ''} • memories in context{' '}
              {voiceSession.memoryCount}
            </p>
          ) : null}
        </details>
      </section>

      <section className="chat-messages-panel chat-messages-panel-refined">
        <div className="chat-thread">
          {messages.map((message) => {
            const isOwn = message.role === 'user';
            return (
              <div key={message.id} className={`chat-bubble-row ${isOwn ? 'chat-bubble-row-own' : ''}`}>
                <div className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}>
                  {message.content ? <p className="my-0 whitespace-pre-wrap">{message.content}</p> : null}
                  {message.attachments?.map((attachment) =>
                    attachment.kind === 'image' ? (
                      <div key={attachment.imageId} className="vg-image-card">
                        <Image
                          src={attachment.imageUrl}
                          alt={`${companionName} ${attachment.category}`}
                          className="vg-chat-image"
                          width={attachment.width ?? 1024}
                          height={attachment.height ?? 1024}
                          unoptimized
                        />
                        <p className="my-0 text-xs text-muted capitalize">
                          {attachment.category.replace('-', ' ')} • {attachment.source === 'fresh-generation' ? 'new photo' : 'gallery moment'}
                        </p>
                      </div>
                    ) : null,
                  )}
                  <p className="my-0 chat-bubble-meta">{isOwn ? 'You' : companionName}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="chat-composer-shell">
        {reachedLimit ? (
          <div className="space-y-3">
            <p className="my-0 text-sm">You reached today&apos;s free message limit.</p>
            <div className="flex gap-3">
              <Link href="/premium" className="ui-button">
                Upgrade to Premium
              </Link>
              <Link href={`/virtual-girlfriend/profile?companionId=${companionId}`} className="ui-button ui-button-ghost">
                Back to profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${companionName}...`}
              rows={3}
              maxLength={2500}
              className="chat-composer-input"
            />
            {error ? <p className="onboarding-error my-0">{error}</p> : null}
            <Button type="button" disabled={pending || !draft.trim()} onClick={send} className="chat-send-button">
              {pending ? 'She is typing…' : 'Send'}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
