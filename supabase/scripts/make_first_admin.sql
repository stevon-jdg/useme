-- Run this ONCE in the Supabase dashboard: SQL Editor > New query.
--
-- 1. Sign up in the app with the email that should become the first administrator.
-- 2. Replace the email below with that address.
-- 3. Run the query. It must report two rows: admin and super_admin.
--
-- This is the only way to create the first super administrator. The app has no screen for it,
-- and nobody can promote themselves. Later admins are added from the app by a super admin.

insert into public.user_roles (user_id, role)
select u.id, r.role
from auth.users u
cross join (values ('admin'::public.app_role), ('super_admin'::public.app_role)) as r(role)
where lower(u.email) = lower('REPLACE-WITH-ADMIN-EMAIL@example.com')
on conflict do nothing
returning user_id, role;
