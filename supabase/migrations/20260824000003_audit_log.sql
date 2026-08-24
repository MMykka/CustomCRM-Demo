-- Audit log: generic trigger-based change history.
-- Created early so later migrations can attach the trigger as each
-- business table is defined.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index audit_log_organization_id_idx on public.audit_log (organization_id);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);

-- security definer + owned by the migration role, so it can write to
-- audit_log regardless of the caller's own RLS grants on that table.
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_org_id := OLD.organization_id;
  else
    v_org_id := NEW.organization_id;
  end if;

  insert into public.audit_log (
    organization_id, table_name, record_id, action, old_data, new_data, changed_by
  )
  values (
    v_org_id,
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end,
    auth.uid()
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log
  for select using (organization_id = public.current_org_id());

-- No insert/update/delete policy: rows are written only by
-- audit_trigger_fn (security definer), never directly by users.
