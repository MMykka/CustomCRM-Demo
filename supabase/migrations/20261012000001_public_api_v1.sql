-- Public REST API v1 (src/app/api/v1/**): contact external ids, indexes for
-- keyset pagination / incremental sync, and a single-round-trip API key
-- authentication + per-key rate limiting function.

-- contacts.external_id -------------------------------------------------------

-- The caller's own id for a contact (e.g. a website user id, "ig:1527..."),
-- so integrations can upsert/look up by their id instead of storing ours.
alter table public.contacts add column external_id text;

create unique index contacts_org_external_id_unique_idx on public.contacts (organization_id, external_id) where external_id is not null;

-- Keyset pagination (GET /api/v1/contacts) and "changed since" sync.
create index contacts_org_created_at_id_idx on public.contacts (organization_id, created_at desc, id desc);
create index contacts_org_updated_at_id_idx on public.contacts (organization_id, updated_at desc, id desc);

-- Every public API request looks a key up by hash; without this it's a seq scan.
create unique index api_keys_key_hash_idx on public.api_keys (key_hash);

-- Rate limiting --------------------------------------------------------------

-- Fixed-window request counters per API key. Service-role only: no RLS
-- policies, so the authenticated role can never read or write it.
create table public.api_rate_limits (
  api_key_id uuid not null references public.api_keys (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start)
);

alter table public.api_rate_limits enable row level security;

grant select, insert, update, delete on public.api_rate_limits to service_role;

-- Resolves a hashed API key to its org and counts the request against the
-- key's current window, in one round trip. Returns no row for an unknown or
-- revoked key. The caller compares request_count to its limit.
create or replace function public.api_authenticate(p_key_hash text, p_window_seconds integer)
returns table (api_key_id uuid, organization_id uuid, key_name text, request_count integer, window_reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
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
  on conflict (api_key_id, window_start) do update set request_count = r.request_count + 1
  returning r.request_count into v_count;

  -- last_used_at is informational; touching it at most once a minute keeps a
  -- busy key from turning every request into a write on the same row.
  update public.api_keys
  set last_used_at = now()
  where id = v_key.id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  -- Opportunistic cleanup of expired windows instead of a cron job.
  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  end if;

  return query select v_key.id, v_key.organization_id, v_key.name, v_count, v_window + make_interval(secs => p_window_seconds);
end;
$$;

revoke execute on function public.api_authenticate(text, integer) from public, anon, authenticated;
grant execute on function public.api_authenticate(text, integer) to service_role;
