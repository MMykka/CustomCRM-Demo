-- Timeline activities, tasks, tags, and custom fields.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  type text not null check (type in ('note', 'call', 'email', 'sms', 'meeting', 'stage_change', 'task_completed', 'other')),
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  assigned_to uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- Many-to-many contacts <-> tags. organization_id is denormalized from
-- the parent contact so RLS can filter this join table directly instead
-- of joining out to contacts on every check.
create table public.contact_tags (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'company', 'deal')),
  name text not null,
  field_key text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'boolean', 'select', 'multiselect')),
  options jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, field_key)
);

-- Stores the actual per-record values for custom_fields, keyed by
-- whichever entity (contact/company/deal) the field applies to.
create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  custom_field_id uuid not null references public.custom_fields (id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'company', 'deal')),
  entity_id uuid not null,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (custom_field_id, entity_id)
);

-- Indexes ---------------------------------------------------------------

create index activities_organization_id_idx on public.activities (organization_id);
create index activities_contact_id_idx on public.activities (contact_id);
create index activities_deal_id_idx on public.activities (deal_id);
create index tasks_organization_id_idx on public.tasks (organization_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_due_at_idx on public.tasks (due_at);
create index tags_organization_id_idx on public.tags (organization_id);
create index contact_tags_organization_id_idx on public.contact_tags (organization_id);
create index contact_tags_tag_id_idx on public.contact_tags (tag_id);
create index custom_fields_organization_id_idx on public.custom_fields (organization_id);
create index custom_field_values_organization_id_idx on public.custom_field_values (organization_id);
create index custom_field_values_entity_idx on public.custom_field_values (entity_type, entity_id);

-- updated_at + audit triggers -------------------------------------------

create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger custom_fields_set_updated_at before update on public.custom_fields for each row execute function public.set_updated_at();
create trigger custom_field_values_set_updated_at before update on public.custom_field_values for each row execute function public.set_updated_at();

-- activities is an immutable append-only log and contact_tags is a plain
-- join table, so neither carries an audit trigger.
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function public.audit_trigger_fn();
create trigger tags_audit after insert or update or delete on public.tags for each row execute function public.audit_trigger_fn();
create trigger custom_fields_audit after insert or update or delete on public.custom_fields for each row execute function public.audit_trigger_fn();
create trigger custom_field_values_audit after insert or update or delete on public.custom_field_values for each row execute function public.audit_trigger_fn();

-- Row-level security ------------------------------------------------------

alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_field_values enable row level security;

create policy "activities_select" on public.activities for select using (organization_id = public.current_org_id());
create policy "activities_insert" on public.activities for insert with check (organization_id = public.current_org_id());
create policy "activities_update" on public.activities for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "activities_delete" on public.activities for delete using (organization_id = public.current_org_id());

create policy "tasks_select" on public.tasks for select using (organization_id = public.current_org_id());
create policy "tasks_insert" on public.tasks for insert with check (organization_id = public.current_org_id());
create policy "tasks_update" on public.tasks for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "tasks_delete" on public.tasks for delete using (organization_id = public.current_org_id());

create policy "tags_select" on public.tags for select using (organization_id = public.current_org_id());
create policy "tags_insert" on public.tags for insert with check (organization_id = public.current_org_id());
create policy "tags_update" on public.tags for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "tags_delete" on public.tags for delete using (organization_id = public.current_org_id());

create policy "contact_tags_select" on public.contact_tags for select using (organization_id = public.current_org_id());
create policy "contact_tags_insert" on public.contact_tags for insert with check (organization_id = public.current_org_id());
create policy "contact_tags_delete" on public.contact_tags for delete using (organization_id = public.current_org_id());

create policy "custom_fields_select" on public.custom_fields for select using (organization_id = public.current_org_id());
create policy "custom_fields_insert" on public.custom_fields for insert with check (organization_id = public.current_org_id());
create policy "custom_fields_update" on public.custom_fields for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "custom_fields_delete" on public.custom_fields for delete using (organization_id = public.current_org_id());

create policy "custom_field_values_select" on public.custom_field_values for select using (organization_id = public.current_org_id());
create policy "custom_field_values_insert" on public.custom_field_values for insert with check (organization_id = public.current_org_id());
create policy "custom_field_values_update" on public.custom_field_values for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "custom_field_values_delete" on public.custom_field_values for delete using (organization_id = public.current_org_id());
