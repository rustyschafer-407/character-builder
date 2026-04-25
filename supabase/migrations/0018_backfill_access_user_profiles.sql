-- Backfill missing profile data for users in access tables
-- Ensures all users referenced in campaign_user_access and character_user_access have valid profile records
-- This fixes the "Unknown user / No email on profile" issue in production

begin;

-- Step 1: Create missing profile rows for auth users who are referenced in access tables but don't have profiles
insert into public.profiles (id, email, display_name, is_admin, is_gm, created_at, updated_at)
select distinct
  u.id,
  u.email,
  coalesce(
    (u.raw_user_meta_data ->> 'full_name'),
    (u.raw_user_meta_data ->> 'name'),
    split_part(u.email, '@', 1)
  ) as display_name,
  false as is_admin,
  false as is_gm,
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where u.id in (
  select distinct user_id from public.campaign_user_access
  union
  select distinct user_id from public.character_user_access
)
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  )
on conflict (id) do nothing;

-- Step 2: Backfill email for profile rows that are missing it
update public.profiles p
set
  email = u.email,
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and p.email is null;

-- Step 3: Backfill display_name for profile rows that are missing it
update public.profiles p
set
  display_name = coalesce(
    (u.raw_user_meta_data ->> 'full_name'),
    (u.raw_user_meta_data ->> 'name'),
    split_part(u.email, '@', 1)
  ),
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and (p.display_name is null or trim(p.display_name) = '');

-- Step 4: Also backfill for users referenced by granted_by FK
update public.profiles p
set
  email = u.email,
  display_name = coalesce(
    (u.raw_user_meta_data ->> 'full_name'),
    (u.raw_user_meta_data ->> 'name'),
    split_part(u.email, '@', 1)
  ),
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and (p.email is null or p.display_name is null or trim(p.display_name) = '')
  and u.id in (
    select distinct granted_by from public.campaign_user_access where granted_by is not null
    union
    select distinct granted_by from public.character_user_access where granted_by is not null
    union
    select distinct created_by from public.campaigns where created_by is not null
    union
    select distinct created_by from public.characters where created_by is not null
  );

commit;
