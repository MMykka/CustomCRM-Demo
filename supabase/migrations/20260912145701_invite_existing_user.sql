-- inviteTeamMember() (src/lib/actions/team-members.ts) calls
-- admin.auth.admin.inviteUserByEmail(), which fails with error code
-- 'email_exists' when that email already has an account -- GoTrue's invite
-- flow only creates brand-new users. This RPC is the fallback for that
-- case: instead of an invite email + password setup, it just adds the
-- existing account straight into the caller's org (their *other*
-- memberships/active org are untouched -- they pick this one up next time
-- via the org switcher) and drops them a notification.

create or replace function public.add_existing_user_to_org(p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_caller_role text;
  v_target_user_id uuid;
  v_org_name text;
begin
  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_caller_role from public.organization_members where organization_id = v_org_id and user_id = auth.uid();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'not authorized';
  end if;

  if p_role not in ('owner', 'admin', 'rep', 'read-only') then
    raise exception 'invalid role';
  end if;

  select id into v_target_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_target_user_id is null then
    raise exception 'no account found for that email';
  end if;

  if exists (select 1 from public.organization_members where organization_id = v_org_id and user_id = v_target_user_id) then
    raise exception 'already a member of this organization';
  end if;

  insert into public.organization_members (organization_id, user_id, role, invited_at, invited_by)
  values (v_org_id, v_target_user_id, p_role, now(), auth.uid());

  select name into v_org_name from public.organizations where id = v_org_id;

  insert into public.notifications (organization_id, user_id, type, title, body)
  values (v_org_id, v_target_user_id, 'other', 'Added to a new organization', format('You now have access to %s. Switch to it from the org menu.', coalesce(v_org_name, 'an organization')));
end;
$$;

grant execute on function public.add_existing_user_to_org(text, text) to authenticated;
