'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  VIRTUAL_GIRLFRIEND_AFFECTION_STYLES,
  VIRTUAL_GIRLFRIEND_ARCHETYPES,
  VIRTUAL_GIRLFRIEND_TONES,
  VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS,
} from '@/lib/virtual-girlfriend/types';

export const VirtualGirlfriendSetupFlow = ({ createNew = false }: { createNew?: boolean }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generationStarted, setGenerationStarted] = useState(false);

  const submit = (formData: FormData) => {
    setError(null);
    setGenerationStarted(true);

    startTransition(async () => {
      let response: Response;

      try {
        response = await fetch('/api/virtual-girlfriend/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...Object.fromEntries(formData), createNew }),
        });
      } catch {
        setGenerationStarted(false);
        setError('Unable to start generation right now. Please try again in a moment.');
        return;
      }

      const body = (await response.json()) as { error?: string; companionId?: string };

      if (!response.ok) {
        setError(body.error ?? 'Unable to create your Virtual Girlfriend.');
        setGenerationStarted(false);
        return;
      }

      const destination = body.companionId
        ? `/virtual-girlfriend/profile?companionId=${body.companionId}`
        : '/virtual-girlfriend/profile';

      router.push(destination);
      router.refresh();
    });
  };

  const isSubmitting = generationStarted || pending;

  return (
    <div className="app-page-stack">
      <Card className="app-page-header">
        <p className="chat-label">Virtual Girlfriend</p>
        <h1 className="my-0">{createNew ? 'Create another relationship profile' : 'Design your ideal virtual relationship'}</h1>
        <p className="my-0 text-muted">{createNew
            ? 'Build a distinct companion with her own tone, identity, and chat memory track.'
            : 'Craft her vibe, tone, and chemistry. Your profile is AI-generated and tailored to your setup.'}</p>
      </Card>

      <Card className="app-surface-card">
        <form action={submit} className="space-y-4">
          {isSubmitting ? (
            <div
              className="rounded-2xl border border-white/20 bg-white/5 px-4 py-4 sm:px-5"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
                <p className="my-0 text-sm font-semibold text-white">Your companion is on the way.</p>
              </div>
              <p className="mb-0 mt-3 text-sm text-muted">
                We&rsquo;re building her profile, photos, and memory setup. You can leave this page and check back in Virtual
                Girlfriend shortly&mdash;we&rsquo;ll save everything automatically.
              </p>
            </div>
          ) : null}

          <fieldset disabled={isSubmitting} className={isSubmitting ? 'space-y-4 opacity-60' : 'space-y-4'}>
            <Input name="name" placeholder="Name (optional, auto-generated if blank)" maxLength={40} />

            <Select name="archetype" required defaultValue="">
              <option value="" disabled>Select personality archetype</option>
              {VIRTUAL_GIRLFRIEND_ARCHETYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>

            <Select name="tone" required defaultValue="">
              <option value="" disabled>Select texting tone</option>
              {VIRTUAL_GIRLFRIEND_TONES.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>

            <Select name="affectionStyle" required defaultValue="">
              <option value="" disabled>Select affection / flirt direction</option>
              {VIRTUAL_GIRLFRIEND_AFFECTION_STYLES.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>

            <Select name="visualAesthetic" required defaultValue="">
              <option value="" disabled>Select visual aesthetic preference</option>
              {VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>

            <Textarea
              name="preferenceHints"
              placeholder="Optional: any details she should naturally weave into your conversations"
              rows={4}
              maxLength={300}
            />
          </fieldset>

          {error ? <p className="onboarding-error my-0">{error}</p> : null}

          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Generation in progress…' : createNew ? 'Create another companion' : 'Create Virtual Girlfriend'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
