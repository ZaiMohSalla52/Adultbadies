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

export const VirtualGirlfriendSetupFlow = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/virtual-girlfriend/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Unable to create your Virtual Girlfriend.');
        return;
      }

      router.push('/virtual-girlfriend/profile');
      router.refresh();
    });
  };

  return (
    <div className="app-page-stack">
      <Card className="app-page-header">
        <p className="chat-label">Virtual Girlfriend</p>
        <h1 className="my-0">Design your ideal virtual relationship</h1>
        <p className="my-0 text-muted">Craft her vibe, tone, and chemistry. Your profile is AI-generated and tailored to your setup.</p>
      </Card>

      <Card className="app-surface-card">
        <form action={submit} className="space-y-4">
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

          {error ? <p className="onboarding-error my-0">{error}</p> : null}

          <Button disabled={pending} type="submit">
            {pending ? 'Generating profile…' : 'Create Virtual Girlfriend'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
