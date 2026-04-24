-- Permissions hardening: server-trust boundaries and stricter access guarantees

begin;

-- ------------------------------------------------------------------
-- Preconditions: base permissions tables must exist.
-- ------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.campaign_user_access') is null
     or to_regclass('public.characters') is null
     or to_regclass('public.character_user_access') is null then
    raise exception 'Missing base permissions tables. Apply 0002_permissions_foundation.sql first.';
  end if;
end
$$;

-- ------------------------------------------------------------------
-- Recreate core helper functions to avoid dependency-order issues.
-- ------------------------------------------------------------------

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = p_user_id), false);
$$;

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

-- ------------------------------------------------------------------
-- Character access should require campaign access for non-admins.
-- ------------------------------------------------------------------

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

-- ------------------------------------------------------------------
-- Prevent non-admin removal of the final campaign editor.
-- ------------------------------------------------------------------

create or replace function public.can_remove_campaign_access(
  actor uuid,
  campaign uuid,
  target_user uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    public.is_admin(actor)
    or (
      public.is_campaign_editor(actor, campaign)
      and target_user <> actor
      and (
        target_role <> 'editor'
        or exists (
          select 1
          from public.campaign_user_access cua
          where cua.campaign_id = campaign
            and cua.role = 'editor'
            and cua.user_id <> target_user
        )
      )
    )
  );
$$;

drop policy if exists campaign_user_access_delete_admin_or_campaign_editor on public.campaign_user_access;
create policy campaign_user_access_delete_admin_or_campaign_editor on public.campaign_user_access
for delete
using (
  public.can_remove_campaign_access(auth.uid(), campaign_id, user_id, role)
);

-- Non-admin campaign editors should not mutate campaign roles directly.
-- Admin-only update prevents accidental demotion of final editor via UPDATE.
drop policy if exists campaign_user_access_update_admin_or_campaign_editor on public.campaign_user_access;
create policy campaign_user_access_update_admin_only on public.campaign_user_access
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

commit;
