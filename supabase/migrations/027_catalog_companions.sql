-- Public catalog companions (auto-generated library) vs user-created companions.

alter table public.ai_companions
  add column if not exists source text not null default 'user'
    check (source in ('user', 'catalog'));

create index if not exists ai_companions_catalog_idx
  on public.ai_companions (source, setup_completed, generation_status, created_at asc)
  where source = 'catalog';

-- Catalog companions are readable by any authenticated user.
create policy "authenticated users can view catalog companions"
  on public.ai_companions for select
  to authenticated
  using (source = 'catalog' and setup_completed = true);

-- Canonical / gallery assets for catalog companions.
create policy "authenticated users can view catalog companion images"
  on public.ai_companion_images for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_companions c
      where c.id = ai_companion_images.companion_id
        and c.source = 'catalog'
        and c.setup_completed = true
    )
  );

create policy "authenticated users can view catalog visual profiles"
  on public.ai_companion_visual_profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_companions c
      where c.id = ai_companion_visual_profiles.companion_id
        and c.source = 'catalog'
        and c.setup_completed = true
    )
  );

-- Users may open conversations with catalog companions.
drop policy if exists "ai_conversations_insert_own" on public.ai_conversations;
create policy "ai_conversations_insert_own"
  on public.ai_conversations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_conversations.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  );

-- Memories + style profiles may attach to catalog companion chats.
drop policy if exists "ai_memories_insert_own" on public.ai_memories;
create policy "ai_memories_insert_own"
  on public.ai_memories for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_memories.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  );

drop policy if exists "ai_user_style_profiles_select_own" on public.ai_user_style_profiles;
create policy "ai_user_style_profiles_select_own"
  on public.ai_user_style_profiles for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  );

drop policy if exists "ai_user_style_profiles_insert_own" on public.ai_user_style_profiles;
create policy "ai_user_style_profiles_insert_own"
  on public.ai_user_style_profiles for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  );

drop policy if exists "ai_user_style_profiles_update_own" on public.ai_user_style_profiles;
create policy "ai_user_style_profiles_update_own"
  on public.ai_user_style_profiles for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.ai_companions c
      where c.id = ai_user_style_profiles.companion_id
        and (c.user_id = auth.uid() or c.source = 'catalog')
    )
  );

-- Block deletion of catalog companions.
create or replace function public.delete_companion(p_companion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_companion public.ai_companions%rowtype;
  v_was_active boolean;
  v_promoted uuid;
  v_remaining integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_companion_id is null then
    raise exception 'companion_id is required' using errcode = '22023';
  end if;

  select *
  into v_companion
  from public.ai_companions
  where id = p_companion_id
    and user_id = v_user;

  if not found then
    raise exception 'Companion not found' using errcode = 'P0002';
  end if;

  if v_companion.source = 'catalog' then
    raise exception 'Catalog companions cannot be deleted' using errcode = '42501';
  end if;

  v_was_active := v_companion.is_active;

  delete from public.image_unlocks
  where user_id = v_user
    and companion_id = p_companion_id;

  delete from public.ai_companions
  where id = p_companion_id
    and user_id = v_user;

  select count(*)::integer
  into v_remaining
  from public.ai_companions
  where user_id = v_user
    and source = 'user';

  v_promoted := null;
  if v_was_active and v_remaining > 0 then
    select id
    into v_promoted
    from public.ai_companions
    where user_id = v_user
      and source = 'user'
    order by updated_at desc
    limit 1;

    update public.ai_companions
    set is_active = false
    where user_id = v_user
      and source = 'user';

    update public.ai_companions
    set is_active = true
    where id = v_promoted
      and user_id = v_user;
  end if;

  return jsonb_build_object(
    'deleted', true,
    'companion_id', p_companion_id,
    'promoted_companion_id', v_promoted,
    'remaining_count', v_remaining
  );
end;
$$;