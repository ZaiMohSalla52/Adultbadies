-- Chat photos no longer auto-unblur on delivery. Only paid unlocks (points_spent > 0) count.

create or replace function public.unlock_companion_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost integer := 15;
  v_companion uuid;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if exists (
    select 1
    from public.image_unlocks
    where user_id = v_user
      and image_id = p_image_id
      and points_spent > 0
  ) then
    select balance into v_balance from public.point_balances where user_id = v_user;
    return jsonb_build_object('unlocked', true, 'already', true, 'balance', coalesce(v_balance, 0), 'cost', 0);
  end if;

  delete from public.image_unlocks
  where user_id = v_user
    and image_id = p_image_id
    and points_spent = 0;

  select companion_id into v_companion from public.ai_companion_images where id = p_image_id;
  if v_companion is null then
    raise exception 'Image not found' using errcode = '22023';
  end if;

  insert into public.point_balances (user_id, balance)
  values (v_user, 0)
  on conflict (user_id) do nothing;

  select balance into v_balance from public.point_balances where user_id = v_user for update;

  if v_balance < v_cost then
    return jsonb_build_object('unlocked', false, 'reason', 'insufficient_points', 'balance', v_balance, 'cost', v_cost);
  end if;

  update public.point_balances
  set balance = balance - v_cost, updated_at = now()
  where user_id = v_user
  returning balance into v_balance;

  insert into public.image_unlocks (user_id, image_id, companion_id, points_spent)
  values (v_user, p_image_id, v_companion, v_cost)
  on conflict (user_id, image_id) do update
    set points_spent = excluded.points_spent,
        companion_id = excluded.companion_id;

  insert into public.point_transactions (user_id, delta, reason, metadata)
  values (v_user, -v_cost, 'image_unlock', jsonb_build_object('image_id', p_image_id, 'companion_id', v_companion));

  return jsonb_build_object('unlocked', true, 'already', false, 'balance', v_balance, 'cost', v_cost);
end;
$$;

revoke all on function public.unlock_companion_image(uuid) from public;
grant execute on function public.unlock_companion_image(uuid) to authenticated;