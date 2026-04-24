-- Allow service-role context (auth.uid() IS NULL) to bypass the profile role mutation guard.
-- This is needed for the bootstrap-admin script which runs with the service role key.

begin;

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
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Only admins may change is_admin or is_gm';
  end if;

  return new;
end;
$$;

commit;
