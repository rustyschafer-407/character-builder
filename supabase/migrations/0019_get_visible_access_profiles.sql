begin;

-- Returns only profiles visible within the requested campaign/character access scope.
-- This is used as an RLS-safe fallback when direct profile queries return partial rows
-- for non-admin campaign GMs/editors.
create or replace function public.get_visible_access_profiles(
  target_campaign_id uuid,
  target_character_id uuid default null
)
returns table (
  id uuid,
  email text,
  display_name text,
  is_admin boolean,
  is_gm boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select auth.uid() as uid
  ),
  allowed as (
    select
      c.uid is not null
      and target_campaign_id is not null
      and (
        public.is_admin(c.uid)
        or public.has_campaign_access(c.uid, target_campaign_id)
        or (
          target_character_id is not null
          and exists (
            select 1
            from public.characters ch
            where ch.id = target_character_id
              and ch.campaign_id = target_campaign_id
              and public.has_campaign_access(c.uid, ch.campaign_id)
          )
        )
      ) as ok
    from caller c
  ),
  scoped_user_ids as (
    -- Campaign-level memberships
    select cua.user_id
    from public.campaign_user_access cua
    where cua.campaign_id = target_campaign_id

    union

    -- Direct character access (when character is provided)
    select chua.user_id
    from public.character_user_access chua
    where target_character_id is not null
      and chua.character_id = target_character_id

    union

    -- Always include caller so self labels resolve
    select c.uid
    from caller c
    where c.uid is not null
  )
  select distinct
    su.user_id as id,
    coalesce(nullif(btrim(coalesce(p.email, '')), ''), nullif(btrim(coalesce(u.email, '')), '')) as email,
    coalesce(
      nullif(btrim(coalesce(p.display_name, '')), ''),
      nullif(btrim(coalesce((u.raw_user_meta_data ->> 'full_name'), (u.raw_user_meta_data ->> 'name'), '')), ''),
      nullif(split_part(coalesce(p.email, u.email, ''), '@', 1), '')
    ) as display_name,
    coalesce(p.is_admin, false) as is_admin,
    coalesce(p.is_gm, false) as is_gm
  from scoped_user_ids su
  join allowed a on a.ok = true
  left join public.profiles p on p.id = su.user_id
  left join auth.users u on u.id = su.user_id;
$$;

revoke all on function public.get_visible_access_profiles(uuid, uuid) from public;
revoke all on function public.get_visible_access_profiles(uuid, uuid) from anon;
revoke all on function public.get_visible_access_profiles(uuid, uuid) from authenticated;
grant execute on function public.get_visible_access_profiles(uuid, uuid) to authenticated;

commit;
