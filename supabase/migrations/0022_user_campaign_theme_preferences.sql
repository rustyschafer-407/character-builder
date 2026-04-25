begin;

alter table public.profiles
  add column if not exists default_theme_id text;

create table if not exists public.user_campaign_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  theme_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, campaign_id)
);

create index if not exists user_campaign_preferences_campaign_idx
  on public.user_campaign_preferences(campaign_id);

create index if not exists user_campaign_preferences_user_idx
  on public.user_campaign_preferences(user_id);

alter table public.user_campaign_preferences enable row level security;

drop trigger if exists set_user_campaign_preferences_updated_at on public.user_campaign_preferences;
create trigger set_user_campaign_preferences_updated_at
before update on public.user_campaign_preferences
for each row execute function public.set_updated_at();

do $$
declare
  r record;
begin
  for r in
    select p.schemaname, p.tablename, p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'user_campaign_preferences'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

create policy user_campaign_preferences_select_own on public.user_campaign_preferences
for select
using (
  user_id = auth.uid()
  and public.has_campaign_access(auth.uid(), campaign_id)
);

create policy user_campaign_preferences_insert_own_accessible on public.user_campaign_preferences
for insert
with check (
  user_id = auth.uid()
  and public.has_campaign_access(auth.uid(), campaign_id)
);

create policy user_campaign_preferences_update_own_accessible on public.user_campaign_preferences
for update
using (
  user_id = auth.uid()
  and public.has_campaign_access(auth.uid(), campaign_id)
)
with check (
  user_id = auth.uid()
  and public.has_campaign_access(auth.uid(), campaign_id)
);

create policy user_campaign_preferences_delete_own_accessible on public.user_campaign_preferences
for delete
using (
  user_id = auth.uid()
  and public.has_campaign_access(auth.uid(), campaign_id)
);

grant select, insert, update, delete on table public.user_campaign_preferences to authenticated;

commit;
