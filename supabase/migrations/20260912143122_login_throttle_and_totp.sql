-- App-layer login throttling, keyed by email rather than IP (Supabase
-- Auth's built-in auth.rate_limit.sign_in_sign_ups is per-IP and easily
-- sidestepped by rotating IPs against one targeted account). Tracks failed
-- password sign-in attempts and blocks further attempts for an email once
-- too many failures land in a short window.
--
-- The table is only ever touched through the security definer functions
-- below (no RLS policy = no direct client access), since signIn() runs
-- before the caller is authenticated and needs to call this as `anon`.

create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

create index login_attempts_email_created_idx on public.login_attempts (email, created_at desc);

alter table public.login_attempts enable row level security;
-- No policies: every access goes through the functions below.

revoke all on public.login_attempts from anon, authenticated;

-- Threshold: 5 failures within 15 minutes blocks further attempts for that
-- email until the window ages out. Also opportunistically prunes rows
-- older than a day so the table doesn't grow unbounded without needing a
-- cron job.
create or replace function public.count_recent_login_failures(p_email text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.login_attempts where created_at < now() - interval '1 day';

  select count(*) into v_count
  from public.login_attempts
  where email = lower(trim(p_email)) and created_at > now() - interval '15 minutes';

  return v_count;
end;
$$;

create or replace function public.record_login_failure(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts (email) values (lower(trim(p_email)));
end;
$$;

create or replace function public.reset_login_failures(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_attempts where email = lower(trim(p_email));
end;
$$;

grant execute on function public.count_recent_login_failures(text) to anon, authenticated;
grant execute on function public.record_login_failure(text) to anon, authenticated;
grant execute on function public.reset_login_failures(text) to anon, authenticated;
