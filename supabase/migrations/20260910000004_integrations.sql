-- Integrations: config-storage stub for external providers (Twilio,
-- Resend, Google Calendar, Slack, Meta). No real OAuth/API calls yet --
-- this is the admin surface for storing connection config, ready to be
-- wired up to real calls later.

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('twilio', 'resend', 'google_calendar', 'slack', 'meta')),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected')),
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index integrations_organization_id_idx on public.integrations (organization_id);

create trigger integrations_set_updated_at before update on public.integrations for each row execute function public.set_updated_at();

-- No audit trigger: config may hold secrets, which audit_log.old_data/
-- new_data would otherwise duplicate verbatim.

alter table public.integrations enable row level security;

create policy "integrations_select" on public.integrations for select using (organization_id = public.current_org_id());
create policy "integrations_insert" on public.integrations for insert with check (organization_id = public.current_org_id());
create policy "integrations_update" on public.integrations for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "integrations_delete" on public.integrations for delete using (organization_id = public.current_org_id());
