-- Campaign email-based access invites for users who have not signed in yet.

begin;

create table if not exists public.campaign_email_access_invites (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email text not null,
  role text not null check (role in ('player', 'editor')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, email)
);

create index if not exists campaign_email_access_invites_email_idx
  on public.campaign_email_access_invites(lower(email));

alter table public.campaign_email_access_invites enable row level security;

drop trigger if exists set_campaign_email_access_invites_updated_at on public.campaign_email_access_invites;
create trigger set_campaign_email_access_invites_updated_at
before update on public.campaign_email_access_invites
for each row execute procedure public.set_updated_at();

drop trigger if exists set_campaign_email_access_invites_granted_by_default on public.campaign_email_access_invites;
create trigger set_campaign_email_access_invites_granted_by_default
before insert or update on public.campaign_email_access_invites
for each row execute function public.set_granted_by_default();

drop policy if exists campaign_email_access_invites_select_admin_or_campaign_editor on public.campaign_email_access_invites;
create policy campaign_email_access_invites_select_admin_or_campaign_editor on public.campaign_email_access_invites
for select
using (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
);

drop policy if exists campaign_email_access_invites_insert_admin_or_campaign_editor on public.campaign_email_access_invites;
create policy campaign_email_access_invites_insert_admin_or_campaign_editor on public.campaign_email_access_invites
for insert
with check (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
);

drop policy if exists campaign_email_access_invites_update_admin_or_campaign_editor on public.campaign_email_access_invites;
create policy campaign_email_access_invites_update_admin_or_campaign_editor on public.campaign_email_access_invites
for update
using (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
)
with check (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
);

drop policy if exists campaign_email_access_invites_delete_admin_or_campaign_editor on public.campaign_email_access_invites;
create policy campaign_email_access_invites_delete_admin_or_campaign_editor on public.campaign_email_access_invites
for delete
using (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
);

create or replace function public.claim_campaign_email_access_invites()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid;
  current_email text;
  claimed_count integer := 0;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return 0;
  end if;

  select lower(p.email)
    into current_email
  from public.profiles p
  where p.id = current_user_id;

  if current_email is null then
    return 0;
  end if;

  with matching_invites as (
    select i.campaign_id, i.role
    from public.campaign_email_access_invites i
    where lower(i.email) = current_email
  ),
  inserted as (
    insert into public.campaign_user_access (campaign_id, user_id, role)
    select m.campaign_id, current_user_id, m.role
    from matching_invites m
    on conflict (campaign_id, user_id) do update
      set role = excluded.role,
          updated_at = timezone('utc', now())
    returning campaign_id
  )
  select count(*) into claimed_count from inserted;

  delete from public.campaign_email_access_invites i
  where lower(i.email) = current_email;

  return claimed_count;
end;
$$;

revoke all on function public.claim_campaign_email_access_invites() from public;
grant execute on function public.claim_campaign_email_access_invites() to authenticated;

commit;
