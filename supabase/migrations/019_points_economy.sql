-- Points economy: balances, ledger, and per-user image unlocks for gated galleries.
--
-- Economy constants are authoritative on the server (inside the functions below),
-- never client-supplied. Keep in sync with src/lib/points/constants.ts:
--   UNBLUR_COST = 15, PREMIUM_MONTHLY_STIPEND = 300.

create table if not exists public.point_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  last_stipend_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.point_balances enable row level security;

create policy "point_balances_select_own"
  on public.point_balances for select
  using (auth.uid() = user_id);
-- No direct insert/update/delete by users: all writes go through the
-- SECURITY DEFINER functions below.

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.point_transactions enable row level security;

create policy "point_transactions_select_own"
  on public.point_transactions for select
  using (auth.uid() = user_id);

create index if not exists point_transactions_user_idx
  on public.point_transactions (user_id, created_at desc);

create table if not exists public.image_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_id uuid not null references public.ai_companion_images (id) on delete cascade,
  companion_id uuid,
  points_spent integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, image_id)
);

alter table public.image_unlocks enable row level security;

create policy "image_unlocks_select_own"
  on public.image_unlocks for select
  using (auth.uid() = user_id);

create index if not exists image_unlocks_user_idx
  on public.image_unlocks (user_id, companion_id);

-- Grant the premium monthly stipend, idempotent per billing period.
create or replace function public.claim_point_stipend()
returns public.point_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_amount integer := 300;
  v_period_end timestamptz;
  v_row public.point_balances;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.point_balances (user_id, balance)
  values (v_user, 0)
  on conflict (user_id) do nothing;

  select s.current_period_end into v_period_end
  from public.subscriptions s
  where s.user_id = v_user
    and s.status in ('active', 'trialing')
    and s.current_period_end is not null
    and s.current_period_end > now()
  order by s.current_period_end desc
  limit 1;

  if v_period_end is null then
    select * into v_row from public.point_balances where user_id = v_user;
    return v_row;
  end if;

  update public.point_balances
  set balance = balance + v_amount,
      last_stipend_period_end = v_period_end,
      updated_at = now()
  where user_id = v_user
    and (last_stipend_period_end is null or last_stipend_period_end < v_period_end)
  returning * into v_row;

  if found then
    insert into public.point_transactions (user_id, delta, reason, metadata)
    values (v_user, v_amount, 'premium_monthly_stipend', jsonb_build_object('period_end', v_period_end));
  else
    select * into v_row from public.point_balances where user_id = v_user;
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_point_stipend() from public;
grant execute on function public.claim_point_stipend() to authenticated;

-- Atomically spend points to permanently unlock a gallery image.
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

  if exists (select 1 from public.image_unlocks where user_id = v_user and image_id = p_image_id) then
    select balance into v_balance from public.point_balances where user_id = v_user;
    return jsonb_build_object('unlocked', true, 'already', true, 'balance', coalesce(v_balance, 0), 'cost', 0);
  end if;

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
  on conflict (user_id, image_id) do nothing;

  insert into public.point_transactions (user_id, delta, reason, metadata)
  values (v_user, -v_cost, 'image_unlock', jsonb_build_object('image_id', p_image_id, 'companion_id', v_companion));

  return jsonb_build_object('unlocked', true, 'already', false, 'balance', v_balance, 'cost', v_cost);
end;
$$;

revoke all on function public.unlock_companion_image(uuid) from public;
grant execute on function public.unlock_companion_image(uuid) to authenticated;
