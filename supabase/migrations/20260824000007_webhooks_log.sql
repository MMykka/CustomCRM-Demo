-- Inbound webhook log (Twilio, email provider, Stripe, etc). organization_id
-- is nullable because a webhook may arrive before it can be matched to an
-- organization (e.g. an SMS from an unrecognized number). Rows are written
-- by backend services using the service role key, which bypasses RLS.

create table public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  source text not null,
  event_type text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index webhooks_log_organization_id_idx on public.webhooks_log (organization_id);
create index webhooks_log_source_idx on public.webhooks_log (source);
create index webhooks_log_status_idx on public.webhooks_log (status);

alter table public.webhooks_log enable row level security;

create policy "webhooks_log_select" on public.webhooks_log
  for select using (organization_id = public.current_org_id());

-- No insert/update/delete policy for authenticated users: only the
-- service role (which bypasses RLS) writes to this table.
