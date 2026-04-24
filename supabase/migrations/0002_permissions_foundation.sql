-- Permissions foundation (RBAC + RLS) for Character Builder
-- SQL-only migration. No UI changes.

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  is_admin boolean not null default false,
  is_gm boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_user_access (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('player', 'editor')),
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, user_id)
);

create table if not exists public.character_user_access (
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (character_id, user_id)
);

alter table public.campaigns
  add column if not exists created_by uuid references public.profiles(id);

alter table public.characters
  add column if not exists created_by uuid references public.profiles(id);

alter table public.campaigns alter column created_by set default auth.uid();
alter table public.characters alter column created_by set default auth.uid();

create index if not exists campaign_user_access_user_campaign_idx
  on public.campaign_user_access(user_id, campaign_id);

create index if not exists character_user_access_user_character_idx
  on public.character_user_access(user_id, character_id);

create index if not exists characters_campaign_created_by_idx
  on public.characters(campaign_id, created_by);

-- ------------------------------------------------------------
-- Updated-at triggers
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_campaign_user_access_updated_at on public.campaign_user_access;
create trigger set_campaign_user_access_updated_at
before update on public.campaign_user_access
for each row execute function public.set_updated_at();

drop trigger if exists set_character_user_access_updated_at on public.character_user_access;
create trigger set_character_user_access_updated_at
before update on public.character_user_access
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Helper functions (search_path-safe, security-definer, stable)
-- ------------------------------------------------------------

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = p_user_id), false);
$$;

create or replace function public.is_gm(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_gm from public.profiles p where p.id = p_user_id), false);
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

create or replace function public.character_campaign_id(p_character_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.campaign_id
  from public.characters c
  where c.id = p_character_id;
$$;

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

-- ------------------------------------------------------------
-- Bootstrap admin function (idempotent; no hardcoded credentials)
-- Usage:
--   select public.bootstrap_set_initial_admin('owner@example.com');
-- Preconditions:
--   - Auth user already exists in auth.users (created via dashboard/admin flow)
--   - Execute with service role or postgres privileges
-- ------------------------------------------------------------

create or replace function public.bootstrap_set_initial_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'bootstrap_set_initial_admin requires a non-empty email';
  end if;

  select u.id, u.email
  into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.deleted_at is null
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users record found for email %', p_email;
  end if;

  insert into public.profiles (id, email, is_admin, is_gm)
  values (v_user_id, v_email, true, true)
  on conflict (id)
  do update set
    email = coalesce(excluded.email, public.profiles.email),
    is_admin = public.profiles.is_admin or excluded.is_admin,
    is_gm = public.profiles.is_gm or excluded.is_gm,
    updated_at = timezone('utc', now());

  return v_user_id;
end;
$$;

revoke all on function public.bootstrap_set_initial_admin(text) from public;
revoke all on function public.bootstrap_set_initial_admin(text) from anon;
revoke all on function public.bootstrap_set_initial_admin(text) from authenticated;
grant execute on function public.bootstrap_set_initial_admin(text) to service_role;

-- ------------------------------------------------------------
-- Profile sync from auth.users
-- ------------------------------------------------------------

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id)
  do update set
    email = excluded.email,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id)
do update set
  email = excluded.email,
  updated_at = timezone('utc', now());

-- ------------------------------------------------------------
-- Guardrail triggers
-- ------------------------------------------------------------

create or replace function public.set_granted_by_default()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.granted_by is null and auth.uid() is not null then
    new.granted_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_campaign_access_granted_by_default on public.campaign_user_access;
create trigger set_campaign_access_granted_by_default
before insert or update on public.campaign_user_access
for each row execute function public.set_granted_by_default();

drop trigger if exists set_character_access_granted_by_default on public.character_user_access;
create trigger set_character_access_granted_by_default
before insert or update on public.character_user_access
for each row execute function public.set_granted_by_default();

create or replace function public.enforce_created_by_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.created_by is distinct from old.created_by
     and not public.is_admin(auth.uid()) then
    raise exception 'created_by is immutable for non-admin users';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_campaign_created_by_immutable on public.campaigns;
create trigger enforce_campaign_created_by_immutable
before insert or update on public.campaigns
for each row execute function public.enforce_created_by_immutable();

drop trigger if exists enforce_character_created_by_immutable on public.characters;
create trigger enforce_character_created_by_immutable
before insert or update on public.characters
for each row execute function public.enforce_created_by_immutable();

create or replace function public.enforce_profile_role_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.is_admin is distinct from old.is_admin
       or new.is_gm is distinct from old.is_gm
     )
     and not public.is_admin(auth.uid()) then
    raise exception 'Only admins may change is_admin or is_gm';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_role_mutation on public.profiles;
create trigger enforce_profile_role_mutation
before update on public.profiles
for each row execute function public.enforce_profile_role_mutation();

create or replace function public.grant_creator_campaign_editor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.campaign_user_access (campaign_id, user_id, role, granted_by)
    values (new.id, new.created_by, 'editor', new.created_by)
    on conflict (campaign_id, user_id)
    do update set
      role = 'editor',
      granted_by = excluded.granted_by,
      updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists grant_creator_campaign_editor on public.campaigns;
create trigger grant_creator_campaign_editor
after insert on public.campaigns
for each row execute function public.grant_creator_campaign_editor();

create or replace function public.grant_creator_character_editor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.character_user_access (character_id, user_id, role, granted_by)
    values (new.id, new.created_by, 'editor', new.created_by)
    on conflict (character_id, user_id)
    do update set
      role = 'editor',
      granted_by = excluded.granted_by,
      updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists grant_creator_character_editor on public.characters;
create trigger grant_creator_character_editor
after insert on public.characters
for each row execute function public.grant_creator_character_editor();

-- Backfill creator editor access rows where creator is already known.
insert into public.campaign_user_access (campaign_id, user_id, role, granted_by)
select c.id, c.created_by, 'editor', c.created_by
from public.campaigns c
where c.created_by is not null
on conflict (campaign_id, user_id)
do update set
  role = 'editor',
  granted_by = excluded.granted_by,
  updated_at = timezone('utc', now());

insert into public.character_user_access (character_id, user_id, role, granted_by)
select c.id, c.created_by, 'editor', c.created_by
from public.characters c
where c.created_by is not null
on conflict (character_id, user_id)
do update set
  role = 'editor',
  granted_by = excluded.granted_by,
  updated_at = timezone('utc', now());

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_user_access enable row level security;
alter table public.characters enable row level security;
alter table public.character_user_access enable row level security;

-- Drop all existing policies on controlled tables so we do not supplement
-- prior broad policies (for example USING (true)).
do $$
declare
  r record;
begin
  for r in
    select p.schemaname, p.tablename, p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename in (
        'profiles',
        'campaigns',
        'campaign_user_access',
        'characters',
        'character_user_access'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- profiles
create policy profiles_select_own_or_admin on public.profiles
for select
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy profiles_insert_self_or_admin on public.profiles
for insert
with check (
  (
    id = auth.uid()
    and is_admin = false
    and is_gm = false
  )
  or public.is_admin(auth.uid())
);

create policy profiles_update_own_or_admin on public.profiles
for update
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy profiles_delete_admin_only on public.profiles
for delete
using (public.is_admin(auth.uid()));

-- campaigns
create policy campaigns_select_accessible on public.campaigns
for select
using (public.has_campaign_access(auth.uid(), id));

create policy campaigns_insert_gm_or_admin on public.campaigns
for insert
with check (
  (
    created_by = auth.uid()
    and (
      public.is_gm(auth.uid())
      or public.is_admin(auth.uid())
    )
  )
  or public.is_admin(auth.uid())
);

create policy campaigns_update_editor_or_admin on public.campaigns
for update
using (public.is_campaign_editor(auth.uid(), id))
with check (public.is_campaign_editor(auth.uid(), id));

create policy campaigns_delete_editor_or_admin on public.campaigns
for delete
using (public.is_campaign_editor(auth.uid(), id));

-- campaign_user_access
create policy campaign_user_access_select_relevant on public.campaign_user_access
for select
using (
  public.is_admin(auth.uid())
  or user_id = auth.uid()
  or public.is_campaign_editor(auth.uid(), campaign_id)
);

create policy campaign_user_access_insert_admin_or_campaign_editor on public.campaign_user_access
for insert
with check (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), campaign_id)
    and user_id <> auth.uid()
    and role in ('player', 'editor')
    and granted_by = auth.uid()
  )
);

create policy campaign_user_access_update_admin_or_campaign_editor on public.campaign_user_access
for update
using (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), campaign_id)
)
with check (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), campaign_id)
    and user_id <> auth.uid()
    and role in ('player', 'editor')
    and granted_by = auth.uid()
  )
);

create policy campaign_user_access_delete_admin_or_campaign_editor on public.campaign_user_access
for delete
using (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), campaign_id)
    and user_id <> auth.uid()
  )
);

-- characters
create policy characters_select_visible on public.characters
for select
using (public.can_view_character(auth.uid(), id));

create policy characters_insert_by_campaign_member on public.characters
for insert
with check (
  public.is_admin(auth.uid())
  or (
    created_by = auth.uid()
    and public.has_campaign_access(auth.uid(), campaign_id)
  )
);

create policy characters_update_editable on public.characters
for update
using (public.can_edit_character(auth.uid(), id))
with check (public.can_edit_character(auth.uid(), id));

create policy characters_delete_editable on public.characters
for delete
using (public.can_edit_character(auth.uid(), id));

-- character_user_access
create policy character_user_access_select_relevant on public.character_user_access
for select
using (
  public.is_admin(auth.uid())
  or user_id = auth.uid()
  or public.is_campaign_editor(auth.uid(), public.character_campaign_id(character_id))
);

create policy character_user_access_insert_admin_or_campaign_editor on public.character_user_access
for insert
with check (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), public.character_campaign_id(character_id))
    and user_id <> auth.uid()
    and role in ('viewer', 'editor')
    and granted_by = auth.uid()
  )
);

create policy character_user_access_update_admin_or_campaign_editor on public.character_user_access
for update
using (
  public.is_admin(auth.uid())
  or public.is_campaign_editor(auth.uid(), public.character_campaign_id(character_id))
)
with check (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), public.character_campaign_id(character_id))
    and user_id <> auth.uid()
    and role in ('viewer', 'editor')
    and granted_by = auth.uid()
  )
);

create policy character_user_access_delete_admin_or_campaign_editor on public.character_user_access
for delete
using (
  public.is_admin(auth.uid())
  or (
    public.is_campaign_editor(auth.uid(), public.character_campaign_id(character_id))
    and user_id <> auth.uid()
  )
);

commit;
