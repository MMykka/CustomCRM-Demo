-- 20260824000009_grants.sql granted the `authenticated` role table/function
-- privileges but missed `service_role`. RLS-bypass (BYPASSRLS) is a
-- separate thing from table-level GRANTs in Postgres — service_role still
-- needs its own GRANTs, and without them every service-role query (admin
-- scripts, webhook handlers writing to webhooks_log, etc.) fails with
-- "permission denied for table ...", the same failure mode `authenticated`
-- had before that migration.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- No column restriction on users.role/organization_id here (unlike the
-- authenticated grant): service_role is a trusted backend context, not
-- something a client can call with, so the self-escalation concern that
-- narrowed the authenticated grant doesn't apply.
