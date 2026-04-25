begin;

-- Scope campaign access to campaign membership (or admin), not global is_gm.
create or replace function public.has_campaign_access(p_user_id uuid, p_campaign_id uuid)
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
      from public.campaign_user_access cua
      where cua.campaign_id = p_campaign_id
        and cua.user_id = p_user_id
    )
  );
$$;

-- Scope campaign editor checks to explicit campaign editor membership (or admin).
create or replace function public.is_campaign_editor(p_user_id uuid, p_campaign_id uuid)
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
      from public.campaign_user_access cua
      where cua.campaign_id = p_campaign_id
        and cua.user_id = p_user_id
        and cua.role = 'editor'
    )
  );
$$;

-- Character view is campaign-scoped and/or direct access scoped.
create or replace function public.can_view_character(p_user_id uuid, p_character_id uuid)
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
          public.is_campaign_editor(p_user_id, c.campaign_id)
          or c.created_by = p_user_id
          or exists (
            select 1
            from public.character_user_access cua
            where cua.character_id = c.id
              and cua.user_id = p_user_id
              and cua.role in ('viewer', 'editor')
          )
        )
    )
  );
$$;

-- Character edit is campaign-scoped and/or direct editor scoped.
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
          public.is_campaign_editor(p_user_id, c.campaign_id)
          or c.created_by = p_user_id
          or exists (
            select 1
            from public.character_user_access cua
            where cua.character_id = c.id
              and cua.user_id = p_user_id
              and cua.role = 'editor'
          )
        )
    )
  );
$$;

commit;
