-- Allow authenticated users to update their own chat messages (e.g. late image attachments).

drop policy if exists "ai_messages_update_own" on public.ai_messages;

create policy "ai_messages_update_own"
  on public.ai_messages for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );