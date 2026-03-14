-- Stage 4: discovery visibility and match-safe insert policies

-- Ensure onboarding completion flag exists on profiles for discovery gating.
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

drop policy if exists "profiles_select_onboarded_for_discovery" on public.profiles;
create policy "profiles_select_onboarded_for_discovery"
  on public.profiles for select
  using (onboarding_completed = true);

drop policy if exists "profile_photos_select_primary_for_onboarded_profiles" on public.profile_photos;
create policy "profile_photos_select_primary_for_onboarded_profiles"
  on public.profile_photos for select
  using (
    is_primary = true
    and exists (
      select 1
      from public.profiles p
      where p.id = profile_photos.user_id
        and p.onboarding_completed = true
    )
  );

drop policy if exists "blocks_select_when_blocked" on public.blocks;
create policy "blocks_select_when_blocked"
  on public.blocks for select
  using (auth.uid() = blocked_user_id);

drop policy if exists "swipes_select_inbound" on public.swipes;
create policy "swipes_select_inbound"
  on public.swipes for select
  using (auth.uid() = target_user_id);

drop policy if exists "matches_insert_mutual_like_participant" on public.matches;
create policy "matches_insert_mutual_like_participant"
  on public.matches for insert
  with check (
    (
      auth.uid() = user_a_id
      or auth.uid() = user_b_id
    )
    and exists (
      select 1
      from public.swipes own_like
      where own_like.swiper_id = auth.uid()
        and own_like.target_user_id = case when auth.uid() = user_a_id then user_b_id else user_a_id end
        and own_like.direction = 'like'
    )
    and exists (
      select 1
      from public.swipes reciprocal_like
      where reciprocal_like.swiper_id = case when auth.uid() = user_a_id then user_b_id else user_a_id end
        and reciprocal_like.target_user_id = auth.uid()
        and reciprocal_like.direction = 'like'
    )
  );
