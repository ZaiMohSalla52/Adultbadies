-- Grant free gallery access for images the user already received in chat (no point spend).

create or replace function public.grant_companion_image_access(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_companion uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select companion_id into v_companion
  from public.ai_companion_images
  where id = p_image_id;

  if v_companion is null then
    raise exception 'Image not found' using errcode = '22023';
  end if;

  insert into public.image_unlocks (user_id, image_id, companion_id, points_spent)
  values (v_user, p_image_id, v_companion, 0)
  on conflict (user_id, image_id) do nothing;

  return jsonb_build_object('granted', true, 'image_id', p_image_id);
end;
$$;

revoke all on function public.grant_companion_image_access(uuid) from public;
grant execute on function public.grant_companion_image_access(uuid) to authenticated;