-- Stage 9 Phase 9: Canonical portrait quality gate + lightweight admin review state

alter table public.ai_companion_visual_profiles
  add column if not exists canonical_review_status text not null default 'pending',
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

alter table public.ai_companion_visual_profiles
  drop constraint if exists ai_companion_visual_profiles_canonical_review_status_check;

alter table public.ai_companion_visual_profiles
  add constraint ai_companion_visual_profiles_canonical_review_status_check
  check (canonical_review_status in ('pending', 'approved', 'rejected'));

create index if not exists ai_companion_visual_profiles_canonical_review_status_idx
  on public.ai_companion_visual_profiles (canonical_review_status, created_at desc);
