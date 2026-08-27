-- Task type/category, snooze, and simple recurrence (interval + unit).

alter table public.tasks
  add column type text not null default 'task'
    check (type in ('task', 'call', 'email', 'follow_up')),
  add column snoozed_until timestamptz,
  add column recurrence_interval integer
    check (recurrence_interval is null or recurrence_interval > 0),
  add column recurrence_unit text
    check (recurrence_unit in ('day', 'week', 'month')),
  add constraint tasks_recurrence_pair_check
    check ((recurrence_interval is null) = (recurrence_unit is null));

create index tasks_snoozed_until_idx on public.tasks (organization_id, snoozed_until) where snoozed_until is not null;
