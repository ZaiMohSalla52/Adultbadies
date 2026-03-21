-- Add is_discoverable flag to ai_companions so members can opt their VG into the discovery deck
alter table public.ai_companions
  add column if not exists is_discoverable boolean not null default true;

-- Allow any authenticated user to SELECT discoverable + completed companions owned by others
-- (The existing owner-only policy still allows owners to see their own companions)
create policy "authenticated users can view discoverable companions"
  on public.ai_companions for select
  to authenticated
  using (
    is_discoverable = true
    and setup_completed = true
    and user_id <> auth.uid()
  );
