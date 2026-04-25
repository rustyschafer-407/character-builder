begin;

create or replace function public.list_access_profile_summaries(p_user_ids uuid[])
returns table (
  profile_id uuid,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id as profile_id,
    nullif(btrim(p.display_name), '') as display_name,
    p.email
  from public.profiles p
  where p.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or public.is_admin(auth.uid())
      or public.is_gm(auth.uid())
      or exists (
        select 1
        from public.campaign_user_access mine
        join public.campaign_user_access target
          on target.campaign_id = mine.campaign_id
        where mine.user_id = auth.uid()
          and target.user_id = p.id
      )
      or exists (
        select 1
        from public.character_user_access mine
        join public.character_user_access target
          on target.character_id = mine.character_id
        where mine.user_id = auth.uid()
          and target.user_id = p.id
      )
    );
$$;

revoke all on function public.list_access_profile_summaries(uuid[]) from public;
revoke all on function public.list_access_profile_summaries(uuid[]) from anon;
revoke all on function public.list_access_profile_summaries(uuid[]) from authenticated;
grant execute on function public.list_access_profile_summaries(uuid[]) to authenticated;

commit;