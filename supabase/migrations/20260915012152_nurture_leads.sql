-- Persistent store for this app's own leads (replaces the in-memory array
-- previously kept on globalThis - see src/lib/store.ts). Shares the same
-- hosted Supabase project as the sibling "Custom CRM - the Hub" project but
-- lives in its own table, unrelated to the Hub's multi-tenant schema.
--
-- Storage shape: the full Lead object (as defined in src/lib/types.ts) is
-- kept as a single jsonb blob, since it nests emails/timeline/tagHistory
-- arrays that have no need to be queried relationally in this app. id and
-- submitted_at are pulled out as real columns purely for the primary key
-- and the dashboard's default sort order.
create table if not exists public.nurture_leads (
  id uuid primary key,
  submitted_at timestamptz not null,
  data jsonb not null
);
create index if not exists nurture_leads_submitted_at_idx
  on public.nurture_leads (submitted_at desc);
-- No policies are added on purpose: this table is only ever read/written
-- server-side with the service-role key (see src/lib/store.ts), which
-- bypasses RLS. Enabling RLS with zero policies means the anon/authenticated
-- roles (which this app never uses - it has no Supabase Auth users) get no
-- access at all if the key were ever leaked client-side.
alter table public.nurture_leads enable row level security;
