-- Team members: expand roles from owner/admin/member to
-- owner/admin/rep/read-only, add deactivation, and track invites.

alter table public.users drop constraint users_role_check;
alter table public.users add constraint users_role_check check (role in ('owner', 'admin', 'rep', 'read-only'));
update public.users set role = 'rep' where role = 'member';
alter table public.users alter column role set default 'rep';

alter table public.organization_members drop constraint organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check check (role in ('owner', 'admin', 'rep', 'read-only'));
update public.organization_members set role = 'rep' where role = 'member';
alter table public.organization_members alter column role set default 'rep';

alter table public.organization_members
  add column status text not null default 'active' check (status in ('active', 'deactivated')),
  add column invited_at timestamptz,
  add column invited_by uuid references public.users (id) on delete set null;

-- Auto-joins an invited user to the inviting org at the invited role, if
-- they signed up via inviteTeamMember() (src/lib/actions/team-members.ts),
-- which stamps invited_org_id/invited_role/invited_by into
-- auth.users.raw_user_meta_data. Otherwise this is unchanged from the
-- original handle_new_user() -- the user starts org-less and goes through
-- onboarding (create_organization()).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invited_org_id uuid;
  v_invited_role text;
  v_invited_by uuid;
begin
  v_invited_org_id := (new.raw_user_meta_data ->> 'invited_org_id')::uuid;
  v_invited_role := new.raw_user_meta_data ->> 'invited_role';
  v_invited_by := (new.raw_user_meta_data ->> 'invited_by')::uuid;

  insert into public.users (id, email, full_name, avatar_url, organization_id, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    v_invited_org_id,
    coalesce(v_invited_role, 'rep')
  );

  if v_invited_org_id is not null then
    insert into public.organization_members (organization_id, user_id, role, invited_at, invited_by)
    values (v_invited_org_id, new.id, coalesce(v_invited_role, 'rep'), now(), v_invited_by);
  end if;

  return new;
end;
$$;

-- Changes another member's role within the caller's active org. Only
-- owner/admin may call this; the last remaining owner can't be demoted.
create or replace function public.set_member_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_caller_role text;
  v_owner_count int;
begin
  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_caller_role from public.organization_members where organization_id = v_org_id and user_id = auth.uid();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'not authorized';
  end if;

  if new_role not in ('owner', 'admin', 'rep', 'read-only') then
    raise exception 'invalid role';
  end if;

  if new_role != 'owner' then
    select count(*) into v_owner_count from public.organization_members where organization_id = v_org_id and role = 'owner';
    if v_owner_count <= 1 and exists (
      select 1 from public.organization_members where organization_id = v_org_id and user_id = target_user_id and role = 'owner'
    ) then
      raise exception 'cannot demote the last owner';
    end if;
  end if;

  update public.organization_members set role = new_role where organization_id = v_org_id and user_id = target_user_id;
  update public.users set role = new_role where id = target_user_id and organization_id = v_org_id;
end;
$$;

-- Activates/deactivates a member within the caller's active org. Only
-- owner/admin may call this; the last remaining owner can't be deactivated.
create or replace function public.set_member_status(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_caller_role text;
  v_owner_count int;
begin
  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_caller_role from public.organization_members where organization_id = v_org_id and user_id = auth.uid();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'not authorized';
  end if;

  if new_status not in ('active', 'deactivated') then
    raise exception 'invalid status';
  end if;

  if new_status = 'deactivated' then
    select count(*) into v_owner_count from public.organization_members where organization_id = v_org_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 and exists (
      select 1 from public.organization_members where organization_id = v_org_id and user_id = target_user_id and role = 'owner'
    ) then
      raise exception 'cannot deactivate the last owner';
    end if;
  end if;

  update public.organization_members set status = new_status where organization_id = v_org_id and user_id = target_user_id;
end;
$$;
