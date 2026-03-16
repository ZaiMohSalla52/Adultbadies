-- Stage 9 Phase 8: Canonical reference lock foundation for identity-consistent image lineage

alter table public.ai_companion_visual_profiles
  add column if not exists canonical_reference_image_id uuid references public.ai_companion_images (id) on delete set null,
  add column if not exists canonical_reference_metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_companion_visual_profiles_canonical_reference_idx
  on public.ai_companion_visual_profiles (canonical_reference_image_id);
