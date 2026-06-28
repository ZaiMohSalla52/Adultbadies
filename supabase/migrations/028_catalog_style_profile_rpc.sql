-- Allow catalog companions in style-profile bootstrap RPC (matches 027 RLS).

create or replace function public.get_or_create_user_style_profile(p_companion_id uuid)
returns public.ai_user_style_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.ai_user_style_profiles;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.ai_companions c
    where c.id = p_companion_id
      and (c.user_id = v_user or c.source = 'catalog')
  ) then
    raise exception 'Companion not found' using errcode = '22023';
  end if;

  insert into public.ai_user_style_profiles (user_id, companion_id)
  values (v_user, p_companion_id)
  on conflict (user_id, companion_id) do update
    set updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.get_or_create_user_style_profile(uuid) from public;
grant execute on function public.get_or_create_user_style_profile(uuid) to authenticated;