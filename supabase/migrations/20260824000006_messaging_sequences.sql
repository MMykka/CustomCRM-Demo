-- Messages (inbox) and follow-up sequences.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  channel text not null check (channel in ('sms', 'email', 'call', 'whatsapp', 'other')),
  direction text not null check (direction in ('inbound', 'outbound')),
  from_address text,
  to_address text,
  subject text,
  body text,
  status text not null default 'sent' check (status in ('queued', 'sent', 'delivered', 'failed', 'received', 'read')),
  provider text,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The ordered steps of a sequence. Needed for sequences/sequence_enrollments
-- to mean anything: an enrollment tracks a contact's position through this
-- list.
create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  step_order integer not null,
  delay_minutes integer not null default 0,
  channel text not null check (channel in ('email', 'sms', 'task', 'wait')),
  subject text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  current_step integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'exited')),
  enrolled_at timestamptz not null default now(),
  next_step_due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A contact can only have one *active* run through a given sequence at a
-- time, but can be re-enrolled after a previous run completed or exited.
create unique index sequence_enrollments_active_unique_idx
  on public.sequence_enrollments (sequence_id, contact_id)
  where status = 'active';

-- Indexes ---------------------------------------------------------------

create index messages_organization_id_idx on public.messages (organization_id);
create index messages_contact_id_idx on public.messages (contact_id);
create index messages_created_at_idx on public.messages (created_at);
create index sequences_organization_id_idx on public.sequences (organization_id);
create index sequence_steps_organization_id_idx on public.sequence_steps (organization_id);
create index sequence_steps_sequence_id_idx on public.sequence_steps (sequence_id);
create index sequence_enrollments_organization_id_idx on public.sequence_enrollments (organization_id);
create index sequence_enrollments_sequence_id_idx on public.sequence_enrollments (sequence_id);
create index sequence_enrollments_contact_id_idx on public.sequence_enrollments (contact_id);
create index sequence_enrollments_next_step_due_at_idx on public.sequence_enrollments (next_step_due_at);

-- updated_at + audit triggers -------------------------------------------

create trigger sequences_set_updated_at before update on public.sequences for each row execute function public.set_updated_at();
create trigger sequence_steps_set_updated_at before update on public.sequence_steps for each row execute function public.set_updated_at();
create trigger sequence_enrollments_set_updated_at before update on public.sequence_enrollments for each row execute function public.set_updated_at();

-- messages is an immutable log of sent/received communication, so it
-- carries no audit trigger.
create trigger sequences_audit after insert or update or delete on public.sequences for each row execute function public.audit_trigger_fn();
create trigger sequence_steps_audit after insert or update or delete on public.sequence_steps for each row execute function public.audit_trigger_fn();
create trigger sequence_enrollments_audit after insert or update or delete on public.sequence_enrollments for each row execute function public.audit_trigger_fn();

-- Row-level security ------------------------------------------------------

alter table public.messages enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.sequence_enrollments enable row level security;

create policy "messages_select" on public.messages for select using (organization_id = public.current_org_id());
create policy "messages_insert" on public.messages for insert with check (organization_id = public.current_org_id());
create policy "messages_update" on public.messages for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "messages_delete" on public.messages for delete using (organization_id = public.current_org_id());

create policy "sequences_select" on public.sequences for select using (organization_id = public.current_org_id());
create policy "sequences_insert" on public.sequences for insert with check (organization_id = public.current_org_id());
create policy "sequences_update" on public.sequences for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "sequences_delete" on public.sequences for delete using (organization_id = public.current_org_id());

create policy "sequence_steps_select" on public.sequence_steps for select using (organization_id = public.current_org_id());
create policy "sequence_steps_insert" on public.sequence_steps for insert with check (organization_id = public.current_org_id());
create policy "sequence_steps_update" on public.sequence_steps for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "sequence_steps_delete" on public.sequence_steps for delete using (organization_id = public.current_org_id());

create policy "sequence_enrollments_select" on public.sequence_enrollments for select using (organization_id = public.current_org_id());
create policy "sequence_enrollments_insert" on public.sequence_enrollments for insert with check (organization_id = public.current_org_id());
create policy "sequence_enrollments_update" on public.sequence_enrollments for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "sequence_enrollments_delete" on public.sequence_enrollments for delete using (organization_id = public.current_org_id());
