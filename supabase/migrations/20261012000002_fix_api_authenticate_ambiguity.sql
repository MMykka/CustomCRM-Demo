-- api_authenticate() (20261012000001) failed for every valid key with
-- "column reference api_key_id is ambiguous": its RETURNS TABLE output
-- column api_key_id is also a PL/pgSQL variable, which clashes with
-- api_rate_limits.api_key_id in the ON CONFLICT target. Unknown keys
-- returned before reaching that statement, so they still got a clean 401.
-- Same function body, with the conflict target named by constraint and
-- column references resolved to columns.

create or replace function public.api_authenticate(p_key_hash text, p_window_seconds integer)
returns table (api_key_id uuid, organization_id uuid, key_name text, request_count integer, window_reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_key record;
  v_window timestamptz;
  v_count integer;
begin
  select k.id, k.organization_id, k.name into v_key
  from public.api_keys k
  where k.key_hash = p_key_hash and k.revoked_at is null;

  if not found then
    return;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits as r (api_key_id, window_start, request_count)
  values (v_key.id, v_window, 1)
  on conflict on constraint api_rate_limits_pkey do update set request_count = r.request_count + 1
  returning r.request_count into v_count;

  -- last_used_at is informational; touching it at most once a minute keeps a
  -- busy key from turning every request into a write on the same row.
  update public.api_keys k
  set last_used_at = now()
  where k.id = v_key.id and (k.last_used_at is null or k.last_used_at < now() - interval '1 minute');

  -- Opportunistic cleanup of expired windows instead of a cron job.
  if random() < 0.01 then
    delete from public.api_rate_limits r where r.window_start < now() - interval '1 hour';
  end if;

  return query select v_key.id, v_key.organization_id, v_key.name::text, v_count, v_window + make_interval(secs => p_window_seconds);
end;
$$;

revoke execute on function public.api_authenticate(text, integer) from public, anon, authenticated;
grant execute on function public.api_authenticate(text, integer) to service_role;
