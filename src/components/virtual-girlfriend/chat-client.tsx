'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Entitlements } from '@/lib/subscriptions/types';
import type {
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendStyleControlPreset,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

type ChatClientProps = {
  companionName: string;
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
  companionName,
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
      body: JSON.stringify({ message: text }),
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
      body: JSON.stringify({ preset }),
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
    if (limit === null) {
      return 'Premium access active: expanded Virtual Girlfriend messaging.';
    }

    return `Free plan usage today: ${usedToday}/${limit} messages.`;
  }, [limit, usedToday]);

  return (
    <div className="app-page-stack">
      <Card className="chat-conversation-header">
        <div>
          <p className="chat-label">Virtual Girlfriend Chat</p>
          <h1 className="my-0">{companionName}</h1>
          <p className="my-0 text-sm text-muted">{disclosureLabel} • AI-generated conversation</p>
          <p className="my-0 text-xs text-muted">{helperText}</p>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <div>
            <p className="my-0 text-sm font-medium">Style controls</p>
            <p className="my-0 text-xs text-muted">Steer her vibe while preserving identity consistency.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
          {!isPremium ? <p className="my-0 text-xs text-muted">Premium unlock: adaptive style steering.</p> : null}
          <p className="my-0 text-xs text-muted">
            Adaptive profile strength {Math.round(styleProfile.adaptation_strength * 100)}% • stability{' '}
            {Math.round(styleProfile.stability_score * 100)}%
          </p>
        </div>
      </Card>

      <Card className="chat-messages-panel">
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
      </Card>

      <Card>
        {reachedLimit ? (
          <div className="space-y-3">
            <p className="my-0 text-sm">You reached today&apos;s free Virtual Girlfriend message limit.</p>
            <div className="flex gap-3">
              <Link href="/premium" className="ui-button">
                Upgrade to Premium
              </Link>
              <Link href="/virtual-girlfriend/profile" className="ui-button ui-button-ghost">
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
            />
            {error ? <p className="onboarding-error my-0">{error}</p> : null}
            <Button type="button" disabled={pending || !draft.trim()} onClick={send}>
              {pending ? 'She is typing…' : 'Send'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
