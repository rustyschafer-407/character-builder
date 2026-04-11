-- Phase 1 baseline schema for no-login shared campaign access
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists characters_campaign_id_idx on public.characters(campaign_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists set_characters_updated_at on public.characters;
create trigger set_characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.characters enable row level security;

-- No-login trusted-group policy: anon/authenticated can read/write all rows.
-- This matches your chosen collaboration rules.
drop policy if exists campaigns_select_all on public.campaigns;
create policy campaigns_select_all on public.campaigns
for select
using (true);

drop policy if exists campaigns_insert_all on public.campaigns;
create policy campaigns_insert_all on public.campaigns
for insert
with check (true);

drop policy if exists campaigns_update_all on public.campaigns;
create policy campaigns_update_all on public.campaigns
for update
using (true)
with check (true);

drop policy if exists campaigns_delete_all on public.campaigns;
create policy campaigns_delete_all on public.campaigns
for delete
using (true);

drop policy if exists characters_select_all on public.characters;
create policy characters_select_all on public.characters
for select
using (true);

drop policy if exists characters_insert_all on public.characters;
create policy characters_insert_all on public.characters
for insert
with check (true);

drop policy if exists characters_update_all on public.characters;
create policy characters_update_all on public.characters
for update
using (true)
with check (true);

drop policy if exists characters_delete_all on public.characters;
create policy characters_delete_all on public.characters
for delete
using (true);
