-- Stage 9 structured semantic profile foundation.
-- Canonical semantic source-of-truth container for richer companion profile data.
alter table public.ai_companions
  add column if not exists structured_profile jsonb;
