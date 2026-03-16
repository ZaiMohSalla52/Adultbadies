-- Stage 9 Phase 3: Virtual Girlfriend visual identity + premium image pipeline

create table if not exists public.ai_companion_visual_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  profile_version text not null default 'vg-v1',
  style_version text not null,
  prompt_hash text not null,
  source_setup jsonb not null default '{}'::jsonb,
  identity_pack jsonb not null default '{}'::jsonb,
  continuity_notes text,
  moderation_status text not null default 'pending',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_companion_visual_profiles_user_companion_idx
  on public.ai_companion_visual_profiles (user_id, companion_id, created_at desc);

create unique index if not exists ai_companion_visual_profiles_latest_idx
  on public.ai_companion_visual_profiles (companion_id, style_version, prompt_hash);

create trigger set_ai_companion_visual_profiles_updated_at
  before update on public.ai_companion_visual_profiles
  for each row
  execute function public.set_updated_at();

create table if not exists public.ai_companion_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references public.ai_companions (id) on delete cascade,
  visual_profile_id uuid not null references public.ai_companion_visual_profiles (id) on delete cascade,
  image_kind text not null,
  variant_index smallint not null default 0,
  origin_storage_provider text not null,
  origin_storage_key text not null,
  origin_mime_type text,
  origin_byte_size integer,
  delivery_provider text not null,
  delivery_public_id text,
  delivery_url text not null,
  width integer,
  height integer,
  prompt_hash text not null,
  style_version text not null,
  seed_metadata jsonb not null default '{}'::jsonb,
  lineage_metadata jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'pending',
  moderation jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  quality_score numeric(4,2),
  created_at timestamptz not null default now(),
  check (image_kind in ('canonical', 'gallery', 'thumbnail'))
);

create index if not exists ai_companion_images_user_companion_idx
  on public.ai_companion_images (user_id, companion_id, image_kind, created_at desc);

create unique index if not exists ai_companion_images_origin_key_idx
  on public.ai_companion_images (origin_storage_provider, origin_storage_key);

alter table public.ai_companion_visual_profiles enable row level security;
alter table public.ai_companion_images enable row level security;

drop policy if exists "ai_companion_visual_profiles_select_own" on public.ai_companion_visual_profiles;
drop policy if exists "ai_companion_visual_profiles_insert_own" on public.ai_companion_visual_profiles;
drop policy if exists "ai_companion_visual_profiles_update_own" on public.ai_companion_visual_profiles;
drop policy if exists "ai_companion_images_select_own" on public.ai_companion_images;
drop policy if exists "ai_companion_images_insert_own" on public.ai_companion_images;
drop policy if exists "ai_companion_images_update_own" on public.ai_companion_images;

create policy "ai_companion_visual_profiles_select_own"
  on public.ai_companion_visual_profiles for select
  using (auth.uid() = user_id);

create policy "ai_companion_visual_profiles_insert_own"
  on public.ai_companion_visual_profiles for insert
  with check (auth.uid() = user_id);

create policy "ai_companion_visual_profiles_update_own"
  on public.ai_companion_visual_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_companion_images_select_own"
  on public.ai_companion_images for select
  using (auth.uid() = user_id);

create policy "ai_companion_images_insert_own"
  on public.ai_companion_images for insert
  with check (auth.uid() = user_id);

create policy "ai_companion_images_update_own"
  on public.ai_companion_images for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
