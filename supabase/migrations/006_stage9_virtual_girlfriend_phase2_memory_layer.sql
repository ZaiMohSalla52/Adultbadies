-- Stage 9 Phase 2: Virtual Girlfriend memory extraction + retrieval foundation

alter table public.ai_memories
  add column if not exists category text not null default 'user_fact',
  add column if not exists summary text,
  add column if not exists source_role public.ai_message_role not null default 'user',
  add column if not exists salience smallint not null default 3 check (salience between 1 and 5),
  add column if not exists confidence numeric(3,2) not null default 0.70 check (confidence >= 0 and confidence <= 1),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists archived boolean not null default false,
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists embedding_status text not null default 'pending';

create index if not exists ai_memories_active_user_companion_idx
  on public.ai_memories (user_id, companion_id, archived, last_recalled_at desc);

create index if not exists ai_memories_category_idx
  on public.ai_memories (user_id, companion_id, category, created_at desc);
