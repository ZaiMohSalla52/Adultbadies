-- Stage 9 Phase 1: Virtual Girlfriend setup + text chat MVP foundation

alter table public.ai_companions
  add column if not exists display_bio text,
  add column if not exists persona_profile jsonb not null default '{}'::jsonb,
  add column if not exists archetype text,
  add column if not exists tone text,
  add column if not exists affection_style text,
  add column if not exists visual_aesthetic text,
  add column if not exists preference_hints text,
  add column if not exists profile_tags text[] not null default '{}',
  add column if not exists setup_completed boolean not null default false,
  add column if not exists disclosure_label text not null default 'AI-generated profile';

alter table public.ai_conversations
  add column if not exists mode text not null default 'virtual_girlfriend';

alter table public.ai_messages
  add column if not exists model text,
  add column if not exists moderation jsonb not null default '{}'::jsonb;

-- Allow app server paths using authenticated user token to persist assistant messages.
drop policy if exists "ai_messages_insert_own_user_role" on public.ai_messages;
create policy "ai_messages_insert_own"
  on public.ai_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
