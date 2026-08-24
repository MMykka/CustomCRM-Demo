-- Core CRM entities: companies, contacts, pipelines, stages, deals.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  domain text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  owner_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  source text,
  owner_id uuid references public.users (id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  probability numeric(5, 2) not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  stage_id uuid not null references public.stages (id) on delete restrict,
  title text not null,
  value numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  owner_id uuid references public.users (id) on delete set null,
  expected_close_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------

create index companies_organization_id_idx on public.companies (organization_id);
create index contacts_organization_id_idx on public.contacts (organization_id);
create index contacts_company_id_idx on public.contacts (company_id);
create unique index contacts_org_email_unique_idx on public.contacts (organization_id, lower(email)) where email is not null;
create index pipelines_organization_id_idx on public.pipelines (organization_id);
create index stages_organization_id_idx on public.stages (organization_id);
create index stages_pipeline_id_idx on public.stages (pipeline_id);
create index deals_organization_id_idx on public.deals (organization_id);
create index deals_pipeline_id_idx on public.deals (pipeline_id);
create index deals_stage_id_idx on public.deals (stage_id);
create index deals_contact_id_idx on public.deals (contact_id);

-- updated_at + audit triggers -------------------------------------------

create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger pipelines_set_updated_at before update on public.pipelines for each row execute function public.set_updated_at();
create trigger stages_set_updated_at before update on public.stages for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();

create trigger companies_audit after insert or update or delete on public.companies for each row execute function public.audit_trigger_fn();
create trigger contacts_audit after insert or update or delete on public.contacts for each row execute function public.audit_trigger_fn();
create trigger pipelines_audit after insert or update or delete on public.pipelines for each row execute function public.audit_trigger_fn();
create trigger stages_audit after insert or update or delete on public.stages for each row execute function public.audit_trigger_fn();
create trigger deals_audit after insert or update or delete on public.deals for each row execute function public.audit_trigger_fn();

-- Row-level security ------------------------------------------------------

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.pipelines enable row level security;
alter table public.stages enable row level security;
alter table public.deals enable row level security;

create policy "companies_select" on public.companies for select using (organization_id = public.current_org_id());
create policy "companies_insert" on public.companies for insert with check (organization_id = public.current_org_id());
create policy "companies_update" on public.companies for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "companies_delete" on public.companies for delete using (organization_id = public.current_org_id());

create policy "contacts_select" on public.contacts for select using (organization_id = public.current_org_id());
create policy "contacts_insert" on public.contacts for insert with check (organization_id = public.current_org_id());
create policy "contacts_update" on public.contacts for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "contacts_delete" on public.contacts for delete using (organization_id = public.current_org_id());

create policy "pipelines_select" on public.pipelines for select using (organization_id = public.current_org_id());
create policy "pipelines_insert" on public.pipelines for insert with check (organization_id = public.current_org_id());
create policy "pipelines_update" on public.pipelines for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "pipelines_delete" on public.pipelines for delete using (organization_id = public.current_org_id());

create policy "stages_select" on public.stages for select using (organization_id = public.current_org_id());
create policy "stages_insert" on public.stages for insert with check (organization_id = public.current_org_id());
create policy "stages_update" on public.stages for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "stages_delete" on public.stages for delete using (organization_id = public.current_org_id());

create policy "deals_select" on public.deals for select using (organization_id = public.current_org_id());
create policy "deals_insert" on public.deals for insert with check (organization_id = public.current_org_id());
create policy "deals_update" on public.deals for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "deals_delete" on public.deals for delete using (organization_id = public.current_org_id());

-- Organization signup -----------------------------------------------------

-- Replaces the placeholder from the previous migration now that pipelines
-- and stages exist: creates the org, promotes the calling user to owner,
-- and seeds a default pipeline with a starter set of stages.
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_pipeline_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.users where id = auth.uid() and organization_id is not null) then
    raise exception 'user already belongs to an organization';
  end if;

  v_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organizations (name, slug)
  values (org_name, v_slug)
  returning id into v_org_id;

  update public.users
  set organization_id = v_org_id, role = 'owner'
  where id = auth.uid();

  insert into public.pipelines (organization_id, name, is_default, position)
  values (v_org_id, 'Sales Pipeline', true, 0)
  returning id into v_pipeline_id;

  insert into public.stages (organization_id, pipeline_id, name, position, probability, is_won, is_lost)
  values
    (v_org_id, v_pipeline_id, 'New', 0, 10, false, false),
    (v_org_id, v_pipeline_id, 'Contacted', 1, 25, false, false),
    (v_org_id, v_pipeline_id, 'Qualified', 2, 50, false, false),
    (v_org_id, v_pipeline_id, 'Proposal', 3, 75, false, false),
    (v_org_id, v_pipeline_id, 'Won', 4, 100, true, false),
    (v_org_id, v_pipeline_id, 'Lost', 5, 0, false, true);

  return v_org_id;
end;
$$;
