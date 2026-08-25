-- Multi-organization membership (needed for the org switcher: a user like
-- an agency owner belongs to several orgs — their own, demos, clients) and
-- a notifications table for the notification center.

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_organization_id_idx on public.organization_members (organization_id);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- Backfill from the existing single-org relationship.
insert into public.organization_members (organization_id, user_id, role)
select organization_id, id, role from public.users where organization_id is not null
on conflict (organization_id, user_id) do nothing;

alter table public.organization_members enable row level security;

create policy "organization_members_select" on public.organization_members
  for select using (
    user_id = auth.uid() or organization_id = public.current_org_id()
  );

-- No insert/update/delete policy: membership changes only happen through
-- the security definer RPCs below (create_organization, and later an
-- invite flow), never by a client writing this table directly.

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_trigger_fn();

-- users.organization_id is the *active* org (what current_org_id() and
-- every RLS policy already key off of); organization_members is the
-- full set of orgs a user belongs to. Broaden organizations_select so a
-- user can see every org they're a member of, not just the active one —
-- otherwise the switcher couldn't list the others.
drop policy if exists "organizations_select" on public.organizations;
create policy "organizations_select" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- create_organization no longer blocks a user who already belongs to an
-- org — it creates an additional one, adds membership, and switches the
-- caller's active org to it. Signup already calls this once; a signed-in
-- user can now also call it again from Settings to spin up another org.
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

  v_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organizations (name, slug)
  values (org_name, v_slug)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

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

-- Switches which org is "active" (users.organization_id) for the org
-- switcher. Keeps users.role in sync with the caller's role in that org,
-- since role is really "role within the active org."
create or replace function public.switch_active_organization(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select role into v_role
  from public.organization_members
  where organization_id = target_org_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'not a member of this organization';
  end if;

  update public.users
  set organization_id = target_org_id, role = v_role
  where id = auth.uid();
end;
$$;

-- Notifications ------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('task_assigned', 'mention', 'reply', 'other')),
  title text not null,
  body text,
  link_url text,
  related_table text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_organization_id_idx on public.notifications (organization_id);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert policy: rows are written only by trigger functions below
-- (security definer), never directly by a client.

-- Notifies a task's assignee when they're assigned (on insert, or when
-- assigned_to changes on update). Self-assignment doesn't notify.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null
     and (TG_OP = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is distinct from auth.uid()
  then
    insert into public.notifications (organization_id, user_id, type, title, body, link_url, related_table, related_id)
    values (
      new.organization_id,
      new.assigned_to,
      'task_assigned',
      'New task assigned to you',
      new.title,
      '/tasks',
      'tasks',
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger tasks_notify_assigned
  after insert or update of assigned_to on public.tasks
  for each row execute function public.notify_task_assigned();
