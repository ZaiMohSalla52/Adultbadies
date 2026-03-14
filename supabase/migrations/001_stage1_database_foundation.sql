-- Stage 1: Supabase database foundation for Adult Badies MVP

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums -----------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'swipe_direction') then
    create type public.swipe_direction as enum ('like', 'dislike', 'super_like');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('active', 'unmatched', 'blocked');
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
  end if;

  if not exists (select 1 from pg_type where typname = 'report_category') then
    create type public.report_category as enum (
      'harassment',
      'spam',
      'impersonation',
      'explicit_content',
      'underage',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'expired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ai_message_role') then
    create type public.ai_message_role as enum ('system', 'user', 'assistant');
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_action') then
    create type public.moderation_action as enum (
      'report_opened',
      'report_reviewed',
      'report_resolved',
      'user_warned',
      'user_suspended',
      'user_banned',
      'content_removed'
    );
  end if;
end $$;

-- Profiles --------------------------------------------------------------------

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists bio text,
  add column if not exists date_of_birth date,
  add column if not exists location_text text,
  add column if not exists is_profile_complete boolean not null default false;

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Human dating data -----------------------------------------------------------

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create unique index if not exists profile_photos_single_primary_idx
  on public.profile_photos (user_id)
  where is_primary;

create index if not exists profile_photos_user_idx
  on public.profile_photos (user_id, created_at desc);

create table if not exists public.dating_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  min_age integer not null default 18 check (min_age >= 18),
  max_age integer not null default 99 check (max_age >= min_age),
  max_distance_km integer not null default 50 check (max_distance_km > 0),
  interested_in text[] not null default '{}',
  relationship_intent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_dating_preferences_updated_at
  before update on public.dating_preferences
  for each row
  execute function public.set_updated_at();

create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  unique (swiper_id, target_user_id),
  check (swiper_id <> target_user_id)
);

create index if not exists swipes_target_user_idx
  on public.swipes (target_user_id, created_at desc);

create index if not exists swipes_swiper_created_idx
  on public.swipes (swiper_id, created_at desc);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users (id) on delete cascade,
  user_b_id uuid not null references auth.users (id) on delete cascade,
  user_pair_low uuid generated always as (least(user_a_id, user_b_id)) stored,
  user_pair_high uuid generated always as (greatest(user_a_id, user_b_id)) stored,
  status public.match_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unique (user_pair_low, user_pair_high),
  check (user_a_id <> user_b_id)
);

create index if not exists matches_user_a_idx
  on public.matches (user_a_id, created_at desc);

create index if not exists matches_user_b_idx
  on public.matches (user_b_id, created_at desc);

create trigger set_matches_updated_at
  before update on public.matches
  for each row
  execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists messages_match_created_idx
  on public.messages (match_id, created_at asc);

create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

create index if not exists blocks_blocked_user_idx
  on public.blocks (blocked_user_id, created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  match_id uuid references public.matches (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  category public.report_category not null,
  status public.report_status not null default 'open',
  details text,
  moderator_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  check (
    reported_user_id is not null
    or match_id is not null
    or message_id is not null
  )
);

create index if not exists reports_reporter_idx
  on public.reports (reporter_id, created_at desc);

create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

create trigger set_reports_updated_at
  before update on public.reports
  for each row
  execute function public.set_updated_at();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

-- AI companion data -----------------------------------------------------------

create table if not exists public.ai_companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  persona_prompt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_companions_user_idx
  on public.ai_companions (user_id, created_at desc);

create trigger set_ai_companions_updated_at
  before update on public.ai_companions
  for each row
  execute function public.set_updated_at();

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  title text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, created_at desc);

create index if not exists ai_conversations_companion_idx
  on public.ai_conversations (companion_id, created_at desc);

create trigger set_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row
  execute function public.set_updated_at();

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  token_count integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at asc);

create index if not exists ai_messages_user_idx
  on public.ai_messages (user_id, created_at desc);

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  memory_key text not null,
  memory_value text not null,
  importance smallint not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  last_recalled_at timestamptz,
  unique (user_id, companion_id, memory_key)
);

create index if not exists ai_memories_user_companion_idx
  on public.ai_memories (user_id, companion_id, created_at desc);

-- Moderation ------------------------------------------------------------------

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  action public.moderation_action not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_logs_report_idx
  on public.moderation_logs (report_id, created_at desc);

create index if not exists moderation_logs_target_user_idx
  on public.moderation_logs (target_user_id, created_at desc);

-- RLS -------------------------------------------------------------------------

alter table public.profile_photos enable row level security;
alter table public.dating_preferences enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_companions enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_memories enable row level security;
alter table public.moderation_logs enable row level security;

-- profile_photos
create policy "profile_photos_select_own"
  on public.profile_photos for select
  using (auth.uid() = user_id);

create policy "profile_photos_insert_own"
  on public.profile_photos for insert
  with check (auth.uid() = user_id);

create policy "profile_photos_update_own"
  on public.profile_photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profile_photos_delete_own"
  on public.profile_photos for delete
  using (auth.uid() = user_id);

-- dating_preferences
create policy "dating_preferences_select_own"
  on public.dating_preferences for select
  using (auth.uid() = user_id);

create policy "dating_preferences_insert_own"
  on public.dating_preferences for insert
  with check (auth.uid() = user_id);

create policy "dating_preferences_update_own"
  on public.dating_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- swipes
create policy "swipes_select_own"
  on public.swipes for select
  using (auth.uid() = swiper_id);

create policy "swipes_insert_own"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

create policy "swipes_delete_own"
  on public.swipes for delete
  using (auth.uid() = swiper_id);

-- matches
create policy "matches_select_participant"
  on public.matches for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- messages
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

create policy "messages_insert_sender"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

create policy "messages_update_sender"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy "messages_delete_sender"
  on public.messages for delete
  using (sender_id = auth.uid());

-- blocks
create policy "blocks_select_own"
  on public.blocks for select
  using (auth.uid() = blocker_id);

create policy "blocks_insert_own"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

create policy "blocks_delete_own"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

-- reports
create policy "reports_select_own"
  on public.reports for select
  using (auth.uid() = reporter_id);

create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- subscriptions
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ai_companions
create policy "ai_companions_select_own"
  on public.ai_companions for select
  using (auth.uid() = user_id);

create policy "ai_companions_insert_own"
  on public.ai_companions for insert
  with check (auth.uid() = user_id);

create policy "ai_companions_update_own"
  on public.ai_companions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_companions_delete_own"
  on public.ai_companions for delete
  using (auth.uid() = user_id);

-- ai_conversations
create policy "ai_conversations_select_own"
  on public.ai_conversations for select
  using (auth.uid() = user_id);

create policy "ai_conversations_insert_own"
  on public.ai_conversations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_conversations.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_conversations_update_own"
  on public.ai_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_conversations_delete_own"
  on public.ai_conversations for delete
  using (auth.uid() = user_id);

-- ai_messages
create policy "ai_messages_select_own"
  on public.ai_messages for select
  using (auth.uid() = user_id);

create policy "ai_messages_insert_own_user_role"
  on public.ai_messages for insert
  with check (
    auth.uid() = user_id
    and role = 'user'
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ai_memories
create policy "ai_memories_select_own"
  on public.ai_memories for select
  using (auth.uid() = user_id);

create policy "ai_memories_insert_own"
  on public.ai_memories for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_memories.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_memories_update_own"
  on public.ai_memories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_memories_delete_own"
  on public.ai_memories for delete
  using (auth.uid() = user_id);

-- moderation_logs intentionally has no authenticated-user policies.
-- Access is expected via service role / privileged backend paths.
