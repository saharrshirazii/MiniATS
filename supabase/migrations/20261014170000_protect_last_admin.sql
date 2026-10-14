-- =====================================================================
-- MiniATS · There must always be at least one admin
--
-- Blocks deleting the last admin profile (including the cascade from
-- deleting the auth user) and changing the last admin's role to customer.
-- Without an admin, nobody could create accounts or manage the app.
-- =====================================================================

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other_admins integer;
begin
  -- Only relevant when an admin is removed or demoted.
  if old.role <> 'admin' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;

  select count(*) into other_admins
  from public.profiles
  where role = 'admin' and id <> old.id;

  if other_admins = 0 then
    raise exception 'This is the last admin. Create another admin before removing this one.'
      using errcode = 'restrict_violation';  -- SQLSTATE 23001
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.protect_last_admin() from public, anon, authenticated;

create trigger profiles_protect_last_admin
  before update of role or delete on public.profiles
  for each row execute function public.protect_last_admin();
