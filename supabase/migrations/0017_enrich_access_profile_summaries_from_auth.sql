begin;

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
    p.id as profile_id,
    coalesce(
      nullif(btrim(coalesce(p.display_name, '')), ''),
      nullif(btrim(coalesce((u.raw_user_meta_data ->> 'full_name'), (u.raw_user_meta_data ->> 'name'), '')), ''),
      nullif(split_part(coalesce(p.email, u.email, ''), '@', 1), '')
    ) as display_name,
    coalesce(nullif(btrim(coalesce(p.email, '')), ''), nullif(btrim(coalesce(u.email, '')), '')) as email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id::text = any(coalesce(p_user_ids, array[]::text[]))
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or public.is_admin(auth.uid())
      or (
        public.is_gm(auth.uid())
        and (
          exists (
            select 1
            from public.campaign_user_access cua
            where cua.user_id = p.id
          )
          or p.is_admin = true
          or p.is_gm = true
        )
      )
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
        from public.character_user_access target
        join public.characters c on c.id = target.character_id
        where target.user_id = p.id
          and public.has_campaign_access(auth.uid(), c.campaign_id)
      )
    );
$$;

commit;