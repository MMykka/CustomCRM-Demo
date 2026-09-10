-- Message templates library (SMS/email), for Settings. Distinct from
-- `messages` (the inbox log of actually-sent/received messages).

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('sms', 'email')),
  subject text,
  body text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_templates_organization_id_idx on public.message_templates (organization_id);

create trigger message_templates_set_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
create trigger message_templates_audit after insert or update or delete on public.message_templates for each row execute function public.audit_trigger_fn();

alter table public.message_templates enable row level security;

create policy "message_templates_select" on public.message_templates for select using (organization_id = public.current_org_id());
create policy "message_templates_insert" on public.message_templates for insert with check (organization_id = public.current_org_id());
create policy "message_templates_update" on public.message_templates for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "message_templates_delete" on public.message_templates for delete using (organization_id = public.current_org_id());
