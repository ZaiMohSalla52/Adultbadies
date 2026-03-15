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
    <form action={formAction} className="chat-composer-form">
      <Textarea name="body" placeholder="Type your message..." required rows={3} maxLength={2000} />
      <div className="chat-composer-footer">
        {state.error ? <p className="onboarding-error my-0">{state.error}</p> : <span />}
        <Button disabled={pending} type="submit">
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
};
