-- Stage 9 Phase 5: Virtual Girlfriend chat-integrated image messages

alter table public.ai_messages
  add column if not exists content_type text not null default 'text',
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create index if not exists ai_messages_content_type_idx
  on public.ai_messages (content_type, created_at desc);
