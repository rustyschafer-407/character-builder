begin;

-- Backfill campaigns.created_by for legacy rows where it is null.
-- Strategy: use the earliest campaign editor assignment as the canonical creator.
with first_editor as (
  select distinct on (cua.campaign_id)
    cua.campaign_id,
    cua.user_id
  from public.campaign_user_access cua
  where cua.role = 'editor'
  order by cua.campaign_id, cua.created_at asc, cua.user_id asc
)
update public.campaigns c
set
  created_by = fe.user_id,
  updated_at = timezone('utc', now())
from first_editor fe
where c.id = fe.campaign_id
  and c.created_by is null;

-- Ensure profiles exist for campaign creators referenced by campaigns.created_by.
insert into public.profiles (id, email, display_name, is_admin, is_gm, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    u.id::text
  ) as display_name,
  false as is_admin,
  false as is_gm,
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where u.id in (
  select distinct c.created_by
  from public.campaigns c
  where c.created_by is not null
)
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  )
on conflict (id) do nothing;

-- Backfill missing email/display_name for existing creator profiles.
update public.profiles p
set
  email = coalesce(p.email, u.email),
  display_name = coalesce(
    nullif(btrim(coalesce(p.display_name, '')), ''),
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
    nullif(split_part(coalesce(p.email, u.email, ''), '@', 1), ''),
    p.id::text
  ),
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and p.id in (
    select distinct c.created_by
    from public.campaigns c
    where c.created_by is not null
  )
  and (
    p.email is null
    or p.display_name is null
    or btrim(p.display_name) = ''
  );

commit;
