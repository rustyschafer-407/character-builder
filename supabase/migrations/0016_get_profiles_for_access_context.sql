begin;

-- Single clean function replacing 0014/0015 variants. Accepts text[] so
-- Supabase JS client string arrays bind without uuid casting issues.
create or replace function public.get_profiles_for_access_context(p_user_ids text[])
returns table (
  profile_id   uuid,
  display_name text,
  email        text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct
    p.id           as profile_id,
    nullif(btrim(coalesce(p.display_name, '')), '') as display_name,
    p.email
  from public.profiles p
  where p.id::text = any(coalesce(p_user_ids, array[]::text[]))
    and auth.uid() is not null
    and (
      -- always return caller's own profile
      p.id = auth.uid()
      -- admins see everything
      or public.is_admin(auth.uid())
      -- GMs see all profiles of users in any campaign the GM belongs to,
      -- plus any directly requested profile (so inherited rows resolve too)
      or (
        public.is_gm(auth.uid())
        and (
          -- target is a campaign member somewhere
          exists (
            select 1
            from public.campaign_user_access cua
            where cua.user_id = p.id
          )
          -- or they are an admin/gm themselves (so the GM row shows correctly)
          or p.is_admin = true
          or p.is_gm   = true
        )
      )
      -- non-GM campaign editors: see fellow members of shared campaigns
      or exists (
        select 1
        from public.campaign_user_access mine
        join public.campaign_user_access target
          on target.campaign_id = mine.campaign_id
        where mine.user_id   = auth.uid()
          and target.user_id = p.id
      )
      -- see users who have direct access to a character the caller manages
      or exists (
        select 1
        from public.character_user_access target
        join public.characters c on c.id = target.character_id
        where target.user_id = p.id
          and public.has_campaign_access(auth.uid(), c.campaign_id)
      )
    );
$$;

revoke all on function public.get_profiles_for_access_context(text[]) from public;
revoke all on function public.get_profiles_for_access_context(text[]) from anon;
revoke all on function public.get_profiles_for_access_context(text[]) from authenticated;
grant execute on function public.get_profiles_for_access_context(text[]) to authenticated;

commit;
