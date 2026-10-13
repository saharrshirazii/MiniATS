-- =====================================================================
-- MiniATS · Promote a user to admin (bootstrap the first admin)
--
-- Admins normally create accounts in the app, but the very first admin
-- has to be created by hand:
--
--   1. Supabase dashboard → Authentication → Users → Add user
--      (tick "Auto Confirm User")
--   2. Supabase dashboard → SQL Editor → run this script with the email
--
-- The profile row is created automatically by the on_auth_user_created
-- trigger; this script only changes its role.
-- =====================================================================

update public.profiles
set role = 'admin',
    organization_id = null
where email = lower('you@example.com');  -- ← change this

-- Check the result
select email, role, organization_id
from public.profiles
order by created_at;
