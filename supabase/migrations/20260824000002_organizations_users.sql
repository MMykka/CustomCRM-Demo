-- Organizations and users (multi-tenant root tables)

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mirrors auth.users with organization membership + role.
-- One organization per user for now; revisit with an org_members join
-- table if a user ever needs to belong to more than one organization.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_organization_id_idx on public.users (organization_id);

-- Generic updated_at maintenance, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Returns the organization_id of the currently authenticated user.
-- security definer so it can read public.users without recursing
-- through that table's own RLS policies.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.users where id = auth.uid();
$$;

-- Creates a public.users row whenever a new auth.users row appears.
-- The user starts with no organization; they get one via
-- create_organization() (defined in the next migration) right after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security -------------------------------------------------

alter table public.organizations enable row level security;
alter table public.users enable row level security;

create policy "organizations_select" on public.organizations
  for select using (id = public.current_org_id());

create policy "organizations_update" on public.organizations
  for update using (id = public.current_org_id())
  with check (id = public.current_org_id());

-- Org creation happens through the create_organization() rpc (security
-- definer), so no direct insert/delete policy is needed here.

create policy "users_select_same_org" on public.users
  for select using (
    id = auth.uid() or organization_id = public.current_org_id()
  );

create policy "users_update_self" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Supabase grants authenticated broad table-level privileges by default;
-- the policy above only gates which *rows* a user can touch, not which
-- columns. Without this, a user could UPDATE their own row and rewrite
-- role or organization_id to escalate privileges or hop tenants. Restrict
-- self-service updates to profile fields only; role and organization_id
-- changes happen through security definer functions (e.g.
-- create_organization).
revoke update on public.users from authenticated;
grant update (full_name, avatar_url) on public.users to authenticated;
