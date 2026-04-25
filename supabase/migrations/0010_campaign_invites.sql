begin;

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email text,
  role text not null check (role in ('player', 'editor')),
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index campaign_invites_token_idx
  on public.campaign_invites(token);

create index campaign_invites_campaign_id_idx
  on public.campaign_invites(campaign_id);

alter table public.campaign_invites
  add constraint campaign_invites_token_key
  unique using index campaign_invites_token_idx;

commit;
