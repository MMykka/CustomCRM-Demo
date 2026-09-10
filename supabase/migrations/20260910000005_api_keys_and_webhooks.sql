-- API keys (for a future public API -- none exists yet, this is the
-- credential-management surface) and org-configurable outbound webhook
-- endpoints + their delivery log. Distinct from webhooks_log (inbound
-- webhooks from providers) and from the hardcoded n8n calls in
-- src/lib/n8n.ts -- nothing dispatches to webhook_endpoints yet, so
-- webhook_deliveries starts empty until that dispatcher is built.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_organization_id_idx on public.api_keys (organization_id);

alter table public.api_keys enable row level security;

create policy "api_keys_select" on public.api_keys for select using (organization_id = public.current_org_id());
create policy "api_keys_insert" on public.api_keys for insert with check (organization_id = public.current_org_id());
-- Only revocation (revoked_at) is mutable after creation; key_hash/prefix
-- never change, enforced by callers only ever setting revoked_at.
create policy "api_keys_update" on public.api_keys for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  url text not null,
  description text,
  events text[] not null default '{}',
  secret text not null,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_endpoints_organization_id_idx on public.webhook_endpoints (organization_id);

create trigger webhook_endpoints_set_updated_at before update on public.webhook_endpoints for each row execute function public.set_updated_at();
create trigger webhook_endpoints_audit after insert or update or delete on public.webhook_endpoints for each row execute function public.audit_trigger_fn();

alter table public.webhook_endpoints enable row level security;

create policy "webhook_endpoints_select" on public.webhook_endpoints for select using (organization_id = public.current_org_id());
create policy "webhook_endpoints_insert" on public.webhook_endpoints for insert with check (organization_id = public.current_org_id());
create policy "webhook_endpoints_update" on public.webhook_endpoints for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "webhook_endpoints_delete" on public.webhook_endpoints for delete using (organization_id = public.current_org_id());

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null check (status in ('success', 'failed')),
  response_status int,
  attempted_at timestamptz not null default now()
);

create index webhook_deliveries_organization_id_idx on public.webhook_deliveries (organization_id);
create index webhook_deliveries_endpoint_id_idx on public.webhook_deliveries (webhook_endpoint_id);

alter table public.webhook_deliveries enable row level security;

create policy "webhook_deliveries_select" on public.webhook_deliveries for select using (organization_id = public.current_org_id());

-- No insert/update/delete policy for authenticated: written only by a
-- future dispatcher via the service role, same posture as webhooks_log.
