-- Stage 9 Phase 10: Backfill legacy companions into canonical reference workflow

with ranked_candidates as (
  select
    i.user_id,
    i.companion_id,
    i.id as image_id,
    i.image_kind,
    row_number() over (
      partition by i.user_id, i.companion_id
      order by
        case
          when i.image_kind = 'canonical' then 0
          when coalesce(i.lineage_metadata ->> 'generation_mode', '') = 'canonical' then 1
          when i.image_kind = 'gallery' then 2
          else 3
        end,
        coalesce(i.variant_index, 2147483647) asc,
        coalesce(i.quality_score, -1) desc,
        i.created_at asc
    ) as rank_index
  from public.ai_companion_images i
),
best_candidate as (
  select user_id, companion_id, image_id, image_kind
  from ranked_candidates
  where rank_index = 1
),
backfilled_visual_profiles as (
  update public.ai_companion_visual_profiles vp
    set canonical_reference_image_id = candidate.image_id,
        canonical_reference_metadata = coalesce(vp.canonical_reference_metadata, '{}'::jsonb) || jsonb_build_object(
          'backfilled_at', now(),
          'backfill_stage', 'stage9_phase10',
          'backfill_source', 'legacy_image_selection',
          'candidate_image_kind', candidate.image_kind
        ),
        canonical_review_status = case
          when candidate.image_kind = 'canonical' then 'approved'
          else 'pending'
        end,
        updated_at = now()
  from best_candidate candidate
  where vp.user_id = candidate.user_id
    and vp.companion_id = candidate.companion_id
    and vp.canonical_reference_image_id is null
  returning vp.id
)
select count(*) as backfilled_visual_profile_count
from backfilled_visual_profiles;

-- Keep ai_companions in sync when the column exists in this environment.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_companions'
      and column_name = 'canonical_reference_image_id'
  ) then
    with ranked_candidates as (
      select
        i.user_id,
        i.companion_id,
        i.id as image_id,
        row_number() over (
          partition by i.user_id, i.companion_id
          order by
            case
              when i.image_kind = 'canonical' then 0
              when coalesce(i.lineage_metadata ->> 'generation_mode', '') = 'canonical' then 1
              when i.image_kind = 'gallery' then 2
              else 3
            end,
            coalesce(i.variant_index, 2147483647) asc,
            coalesce(i.quality_score, -1) desc,
            i.created_at asc
        ) as rank_index
      from public.ai_companion_images i
    ),
    best_candidate as (
      select user_id, companion_id, image_id
      from ranked_candidates
      where rank_index = 1
    )
    update public.ai_companions c
      set canonical_reference_image_id = candidate.image_id,
          updated_at = now()
    from best_candidate candidate
    where c.user_id = candidate.user_id
      and c.id = candidate.companion_id
      and c.canonical_reference_image_id is null;
  end if;
end $$;
