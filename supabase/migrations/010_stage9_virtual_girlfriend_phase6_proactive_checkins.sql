-- Stage 9 Phase 6: Virtual Girlfriend proactive check-ins

create table if not exists public.ai_proactive_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  trigger_type text not null,
  scheduled_at timestamptz not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'processing', 'delivered', 'failed', 'canceled')),
  context_snapshot jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  delivered_message_id uuid references public.ai_messages (id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_proactive_events_due_idx
  on public.ai_proactive_events (user_id, companion_id, delivery_status, scheduled_at asc);

create index if not exists ai_proactive_events_created_idx
  on public.ai_proactive_events (user_id, companion_id, created_at desc);

alter table public.ai_proactive_events enable row level security;

create trigger set_ai_proactive_events_updated_at
  before update on public.ai_proactive_events
  for each row
  execute function public.set_updated_at();

drop policy if exists "ai_proactive_events_select_own" on public.ai_proactive_events;
drop policy if exists "ai_proactive_events_insert_own" on public.ai_proactive_events;
drop policy if exists "ai_proactive_events_update_own" on public.ai_proactive_events;
drop policy if exists "ai_proactive_events_delete_own" on public.ai_proactive_events;

create policy "ai_proactive_events_select_own"
  on public.ai_proactive_events for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_proactive_events.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_proactive_events_insert_own"
  on public.ai_proactive_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_proactive_events.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_proactive_events_update_own"
  on public.ai_proactive_events for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_proactive_events.companion_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_proactive_events.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_proactive_events_delete_own"
  on public.ai_proactive_events for delete
  using (auth.uid() = user_id);
