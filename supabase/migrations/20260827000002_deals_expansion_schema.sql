-- Deals/Pipeline expansion: stage colors, won/lost reasons, line items,
-- a partial-unique guard on "one default pipeline per org", and widening
-- saved_views to cover deals.

-- stages: color -------------------------------------------------------------

alter table public.stages
  add column color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$');

-- deals: won/lost reasons ----------------------------------------------------

alter table public.deals
  add column won_reason text,
  add column lost_reason text;

-- Indexes for list/forecast queries ------------------------------------------

create index deals_status_idx on public.deals (organization_id, status);
create index deals_expected_close_date_idx on public.deals (organization_id, expected_close_date) where status = 'open';

-- deal_line_items -------------------------------------------------------------

create table public.deal_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  name text not null,
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deal_line_items_deal_id_idx on public.deal_line_items (deal_id);
create index deal_line_items_organization_id_idx on public.deal_line_items (organization_id);

create trigger deal_line_items_set_updated_at before update on public.deal_line_items for each row execute function public.set_updated_at();
create trigger deal_line_items_audit after insert or update or delete on public.deal_line_items for each row execute function public.audit_trigger_fn();

alter table public.deal_line_items enable row level security;

create policy "deal_line_items_select" on public.deal_line_items for select using (organization_id = public.current_org_id());
create policy "deal_line_items_insert" on public.deal_line_items for insert with check (organization_id = public.current_org_id());
create policy "deal_line_items_update" on public.deal_line_items for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "deal_line_items_delete" on public.deal_line_items for delete using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.deal_line_items to authenticated, service_role;

-- saved_views: allow 'deal' views --------------------------------------------

alter table public.saved_views drop constraint saved_views_entity_type_check;
alter table public.saved_views add constraint saved_views_entity_type_check check (entity_type in ('contact', 'deal'));

-- pipelines: only one default per org -----------------------------------------

-- Safe against create_organization()'s existing seeding (exactly one
-- is_default=true insert per org). setDefaultPipeline() must unset the old
-- default before setting the new one -- two sequential updates, which this
-- partial index allows since it only constrains rows where is_default is
-- currently true, never disallowing zero defaults momentarily.
create unique index pipelines_one_default_per_org_idx on public.pipelines (organization_id) where is_default;
