-- Stage 9 Phase 4: Runtime style adaptation for Virtual Girlfriend

create table if not exists public.ai_user_style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  verbosity_preference numeric(4,3) not null default 0.550 check (verbosity_preference between 0 and 1),
  emoji_tone numeric(4,3) not null default 0.350 check (emoji_tone between 0 and 1),
  flirt_intensity_preference numeric(4,3) not null default 0.500 check (flirt_intensity_preference between 0 and 1),
  warmth_reassurance_preference numeric(4,3) not null default 0.650 check (warmth_reassurance_preference between 0 and 1),
  conversational_pacing_preference numeric(4,3) not null default 0.500 check (conversational_pacing_preference between 0 and 1),
  directness_preference numeric(4,3) not null default 0.500 check (directness_preference between 0 and 1),
  playful_serious_balance numeric(4,3) not null default 0.500 check (playful_serious_balance between 0 and 1),
  conversational_energy numeric(4,3) not null default 0.550 check (conversational_energy between 0 and 1),
  adaptation_strength numeric(4,3) not null default 0.200 check (adaptation_strength between 0 and 1),
  stability_score numeric(4,3) not null default 0.700 check (stability_score between 0 and 1),
  signals jsonb not null default '{}'::jsonb,
  explicit_overrides jsonb not null default '{}'::jsonb,
  last_learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, companion_id)
);

create index if not exists ai_user_style_profiles_user_companion_idx
  on public.ai_user_style_profiles (user_id, companion_id, updated_at desc);

alter table public.ai_user_style_profiles enable row level security;

create trigger set_ai_user_style_profiles_updated_at
  before update on public.ai_user_style_profiles
  for each row
  execute function public.set_updated_at();

create policy "ai_user_style_profiles_select_own"
  on public.ai_user_style_profiles for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_user_style_profiles_insert_own"
  on public.ai_user_style_profiles for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and c.user_id = auth.uid()
    )
  );

create policy "ai_user_style_profiles_update_own"
  on public.ai_user_style_profiles for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and c.user_id = auth.uid()
    )
  );
