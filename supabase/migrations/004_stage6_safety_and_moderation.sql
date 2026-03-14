-- Stage 6: Safety, blocking, reporting, and moderation foundation

create or replace function public.users_are_blocked(user_one uuid, user_two uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = user_one and b.blocked_user_id = user_two)
       or (b.blocker_id = user_two and b.blocked_user_id = user_one)
  );
$$;

grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_participant"
  on public.blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_user_id);

drop policy if exists "swipes_insert_own" on public.swipes;
create policy "swipes_insert_own"
  on public.swipes for insert
  with check (
    auth.uid() = swiper_id
    and not public.users_are_blocked(swiper_id, target_user_id)
  );

drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant"
  on public.matches for select
  using (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not public.users_are_blocked(user_a_id, user_b_id)
  );

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and m.status = 'active'
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
        and not public.users_are_blocked(m.user_a_id, m.user_b_id)
    )
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and m.status = 'active'
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
        and not public.users_are_blocked(m.user_a_id, m.user_b_id)
    )
  );

create or replace function public.log_report_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.moderation_logs (actor_user_id, target_user_id, report_id, action, notes, metadata)
  values (
    new.reporter_id,
    new.reported_user_id,
    new.id,
    'report_opened',
    null,
    jsonb_build_object(
      'category', new.category,
      'match_id', new.match_id,
      'message_id', new.message_id
    )
  );

  return new;
end;
$$;

drop trigger if exists reports_log_opened on public.reports;
create trigger reports_log_opened
  after insert on public.reports
  for each row
  execute function public.log_report_opened();
