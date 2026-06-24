-- Age verification / 18+ gating for adult content access.
--
-- Adds verification state to profiles, protects those columns from
-- client-side forgery (RLS allows users to update their own row), and exposes
-- a SECURITY DEFINER attestation RPC that is the only sanctioned write path.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists age_verification_status text not null default 'unverified'
    check (age_verification_status in ('unverified', 'verified', 'rejected')),
  add column if not exists age_verified_at timestamptz,
  add column if not exists age_verification_method text,
  add column if not exists adult_content_consent_at timestamptz;

-- Prevent direct client writes to verification columns. Users keep the
-- existing "update own profile" policy for username/avatar, but the verification
-- columns can only change inside the attestation function below (which flips a
-- transaction-local flag).
create or replace function public.protect_age_verification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.age_verification_status is distinct from old.age_verification_status
    or new.age_verified_at is distinct from old.age_verified_at
    or new.date_of_birth is distinct from old.date_of_birth
    or new.age_verification_method is distinct from old.age_verification_method
    or new.adult_content_consent_at is distinct from old.adult_content_consent_at
  ) and coalesce(current_setting('app.age_verification', true), '') <> 'on' then
    new.age_verification_status := old.age_verification_status;
    new.age_verified_at := old.age_verified_at;
    new.date_of_birth := old.date_of_birth;
    new.age_verification_method := old.age_verification_method;
    new.adult_content_consent_at := old.adult_content_consent_at;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_age_verification_columns on public.profiles;

create trigger protect_age_verification_columns
  before update on public.profiles
  for each row
  execute procedure public.protect_age_verification_columns();

-- Sanctioned attestation path. Computes age server-side from the supplied date
-- of birth, records explicit adult-content consent, and rejects anyone under 18.
create or replace function public.submit_age_attestation(
  p_date_of_birth date,
  p_consent boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_age integer;
  v_status text;
  v_row public.profiles;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_date_of_birth is null then
    raise exception 'Date of birth is required' using errcode = '22023';
  end if;

  if p_consent is not true then
    raise exception 'Adult-content consent is required' using errcode = '22023';
  end if;

  if p_date_of_birth > current_date then
    raise exception 'Date of birth cannot be in the future' using errcode = '22023';
  end if;

  v_age := date_part('year', age(current_date, p_date_of_birth))::integer;
  v_status := case when v_age >= 18 then 'verified' else 'rejected' end;

  perform set_config('app.age_verification', 'on', true);

  update public.profiles
  set
    date_of_birth = p_date_of_birth,
    age_verification_status = v_status,
    age_verification_method = 'self_attestation',
    age_verified_at = case when v_status = 'verified' then now() else null end,
    adult_content_consent_at = case when v_status = 'verified' then now() else null end,
    updated_at = now()
  where id = v_user
  returning * into v_row;

  perform set_config('app.age_verification', 'off', true);

  return v_row;
end;
$$;

revoke all on function public.submit_age_attestation(date, boolean) from public;
grant execute on function public.submit_age_attestation(date, boolean) to authenticated;
