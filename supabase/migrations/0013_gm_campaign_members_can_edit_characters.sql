begin;

create or replace function public.can_edit_character(p_user_id uuid, p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    public.is_admin(p_user_id)
    or exists (
      select 1
      from public.characters c
      where c.id = p_character_id
        and public.has_campaign_access(p_user_id, c.campaign_id)
        and (
          (
            public.is_gm(p_user_id)
            and exists (
              select 1
              from public.campaign_user_access cua
              where cua.campaign_id = c.campaign_id
                and cua.user_id = p_user_id
            )
          )
          or exists (
            select 1
            from public.campaign_user_access cua
            where cua.campaign_id = c.campaign_id
              and cua.user_id = p_user_id
              and cua.role = 'editor'
          )
          or c.created_by = p_user_id
          or exists (
            select 1
            from public.character_user_access chua
            where chua.character_id = c.id
              and chua.user_id = p_user_id
              and chua.role = 'editor'
          )
        )
    )
  );
$$;

commit;