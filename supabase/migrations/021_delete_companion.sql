-- Owner-initiated hard delete for AI companions.
--
-- Child tables (images, visual profiles, conversations, messages, memories, etc.)
-- cascade from ai_companions, but many lack user DELETE RLS policies — so deletion
-- runs in a SECURITY DEFINER RPC (same pattern as points economy in 019).
--
-- Storage (R2 / Cloudinary) is purged by the app before calling this function.

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

  v_was_active := v_companion.is_active;

  -- image_unlocks.companion_id is denormalized without an FK.
  delete from public.image_unlocks
  where user_id = v_user
    and companion_id = p_companion_id;

  delete from public.ai_companions
  where id = p_companion_id
    and user_id = v_user;

  select count(*)::integer
  into v_remaining
  from public.ai_companions
  where user_id = v_user;

  v_promoted := null;
  if v_was_active and v_remaining > 0 then
    select id
    into v_promoted
    from public.ai_companions
    where user_id = v_user
    order by updated_at desc
    limit 1;

    update public.ai_companions
    set is_active = false
    where user_id = v_user;

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

revoke all on function public.delete_companion(uuid) from public;
grant execute on function public.delete_companion(uuid) to authenticated;