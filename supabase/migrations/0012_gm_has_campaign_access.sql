begin;

create or replace function public.has_campaign_access(p_user_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    public.is_admin(p_user_id)
    or public.is_gm(p_user_id)
    or exists (
      select 1
      from public.campaign_user_access cua
      where cua.campaign_id = p_campaign_id
        and cua.user_id = p_user_id
    )
  );
$$;

commit;