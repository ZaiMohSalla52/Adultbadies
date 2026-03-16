-- Stage 9 Phase 7: Explicit Virtual Girlfriend companion generation lifecycle state

alter table public.ai_companions
  add column if not exists generation_status text;

update public.ai_companions
set generation_status = case
  when setup_completed then 'ready'
  else 'generating'
end
where generation_status is null;

alter table public.ai_companions
  alter column generation_status set default 'generating',
  alter column generation_status set not null;

alter table public.ai_companions
  drop constraint if exists ai_companions_generation_status_check;

alter table public.ai_companions
  add constraint ai_companions_generation_status_check
  check (generation_status in ('generating', 'ready', 'failed'));
