-- Charge 1 point per AI chat message (keep image unblur at 15).
-- Sync with src/lib/points/constants.ts: messageCost = 1, unblurCost = 15.

create or replace function public.spend_chat_message_point()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost integer := 1;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.point_balances (user_id, balance)
  values (v_user, 0)
  on conflict (user_id) do nothing;

  select balance into v_balance from public.point_balances where user_id = v_user for update;

  if coalesce(v_balance, 0) < v_cost then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_points',
      'balance', coalesce(v_balance, 0),
      'cost', v_cost
    );
  end if;

  update public.point_balances
  set balance = balance - v_cost, updated_at = now()
  where user_id = v_user
  returning balance into v_balance;

  insert into public.point_transactions (user_id, delta, reason, metadata)
  values (v_user, -v_cost, 'chat_message', jsonb_build_object('cost', v_cost));

  return jsonb_build_object('ok', true, 'balance', v_balance, 'cost', v_cost);
end;
$$;

revoke all on function public.spend_chat_message_point() from public;
grant execute on function public.spend_chat_message_point() to authenticated;