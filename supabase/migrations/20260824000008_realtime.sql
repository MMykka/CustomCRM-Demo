-- Enables Supabase Realtime (postgres_changes) on the tables the UI needs
-- to live-update: the kanban board (deals), contact timeline (activities),
-- and the tasks / "my day" view (tasks). RLS still applies to realtime
-- change events, so a client only receives rows for their own organization.

alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.tasks;
