-- Table/function-level privileges for the `authenticated` role.
--
-- RLS policies (defined per table in earlier migrations) are the real
-- access-control layer, but Postgres also requires a base GRANT before an
-- operation is possible at all — without it every query fails with
-- "permission denied for table ...", regardless of RLS. Supabase Studio
-- grants this automatically for tables created through its UI; tables
-- created via CLI migrations need it done explicitly here.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- Re-apply the narrower column grant from 20260824000002_organizations_users.sql:
-- the blanket grant above would otherwise let a user rewrite their own
-- role or organization_id and escalate privileges / hop tenants.
revoke update on public.users from authenticated;
grant update (full_name, avatar_url) on public.users to authenticated;
