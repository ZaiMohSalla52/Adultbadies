-- Phase 5: Prompt lineage schema
-- Adds nullable prompt lineage columns for persisted image records and canonical profile seed locking without backfill.

alter table public.ai_companion_images
  add column if not exists prompt_text text default null,
  add column if not exists prompt_version text default null,
  add column if not exists surface_type text default null;

alter table public.ai_companion_visual_profiles
  add column if not exists seed_prompt text default null,
  add column if not exists prompt_version text default null,
  add column if not exists surface_type text default null;

create index if not exists idx_companion_images_prompt_version
  on public.ai_companion_images (prompt_version);

create index if not exists idx_companion_images_surface_type
  on public.ai_companion_images (surface_type);

create index if not exists idx_visual_profiles_prompt_version
  on public.ai_companion_visual_profiles (prompt_version);
