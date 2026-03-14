'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ComposerState = {
  error: string | null;
};

const initialState: ComposerState = {
  error: null,
};

export const MessageComposer = ({
  sendMessageAction,
}: {
  sendMessageAction: (state: ComposerState, formData: FormData) => Promise<ComposerState>;
}) => {
  const [state, formAction, pending] = useActionState(sendMessageAction, initialState);

  return (
    <form action={formAction} style={{ display: 'grid', gap: '0.7rem' }}>
      <Textarea name="body" placeholder="Type your message..." required rows={3} maxLength={2000} />
      {state.error ? <p className="onboarding-error" style={{ margin: 0 }}>{state.error}</p> : null}
      <Button disabled={pending} type="submit">
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
};
