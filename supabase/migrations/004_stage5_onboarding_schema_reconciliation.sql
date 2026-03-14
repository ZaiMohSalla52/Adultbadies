-- Stage 5: onboarding schema reconciliation for production compatibility

-- Profiles fields used by onboarding/discovery APIs.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists interested_in text,
  add column if not exists location_text text,
  add column if not exists onboarding_completed boolean not null default false;

-- Dating preference fields used by onboarding/discovery APIs.
alter table public.dating_preferences
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists min_age integer,
  add column if not exists max_age integer,
  add column if not exists interested_in text,
  add column if not exists max_distance_km integer;

-- Align existing schema with app expectations.
alter table public.dating_preferences
  alter column max_distance_km drop not null;

-- Some existing projects have interested_in as text[] from early schema versions.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dating_preferences'
      and column_name = 'interested_in'
      and data_type = 'ARRAY'
  ) then
    alter table public.dating_preferences
      alter column interested_in drop default,
      alter column interested_in type text using (
        case
          when interested_in is null or array_length(interested_in, 1) is null then null
          else interested_in[1]
        end
      );
  end if;
end $$;

-- Profile photo fields used by onboarding APIs.
alter table public.profile_photos
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists storage_path text,
  add column if not exists sort_order integer,
  add column if not exists is_primary boolean not null default false;
