begin;

alter table public.profiles
  add column if not exists show_on_login boolean not null default true;

update public.profiles
set show_on_login = true
where show_on_login is null;

create index if not exists profiles_login_picker_idx
  on public.profiles(show_on_login, is_admin);

create or replace function public.list_login_picker_profiles(p_include_admin boolean default false)
returns table (
  profile_id uuid,
  display_label text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id as profile_id,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(split_part(p.email, '@', 1), '')
    ) as display_label
  from public.profiles p
  where p.show_on_login = true
    and (p_include_admin or p.is_admin = false)
    and p.email is not null
    and coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(split_part(p.email, '@', 1), '')
    ) is not null
  order by lower(
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(split_part(p.email, '@', 1), '')
    )
  );
$$;

create or replace function public.resolve_login_profile_email(
  p_profile_id uuid,
  p_include_admin boolean default false
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.email
  from public.profiles p
  where p.id = p_profile_id
    and p.show_on_login = true
    and (p_include_admin or p.is_admin = false)
    and p.email is not null
  limit 1;
$$;

revoke all on function public.list_login_picker_profiles(boolean) from public;
revoke all on function public.list_login_picker_profiles(boolean) from anon;
revoke all on function public.list_login_picker_profiles(boolean) from authenticated;
grant execute on function public.list_login_picker_profiles(boolean) to anon;
grant execute on function public.list_login_picker_profiles(boolean) to authenticated;

revoke all on function public.resolve_login_profile_email(uuid, boolean) from public;
revoke all on function public.resolve_login_profile_email(uuid, boolean) from anon;
revoke all on function public.resolve_login_profile_email(uuid, boolean) from authenticated;
grant execute on function public.resolve_login_profile_email(uuid, boolean) to anon;
grant execute on function public.resolve_login_profile_email(uuid, boolean) to authenticated;

commit;
