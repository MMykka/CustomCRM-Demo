-- Contacts feature expansion: scoring/lifecycle/consent fields on contacts,
-- a notes table (separate from the append-only activities log so notes can
-- be pinned/edited), a files table + Storage bucket for attachments, a
-- DB-backed saved_views table (replacing the previous localStorage-only
-- stub), and duplicate-detection + merge support.

create extension if not exists pg_trgm;

-- contacts: scoring, lifecycle, consent -----------------------------------

alter table public.contacts
  add column lead_score integer not null default 0 check (lead_score between 0 and 100),
  add column lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in ('subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'other')),
  add column consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'granted', 'revoked')),
  add column email_opt_out boolean not null default false,
  add column sms_opt_out boolean not null default false,
  add column consent_updated_at timestamptz,
  add column phone_normalized text generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

create index contacts_lifecycle_stage_idx on public.contacts (organization_id, lifecycle_stage);
create index contacts_owner_id_idx on public.contacts (owner_id);
create index contacts_phone_normalized_idx on public.contacts (organization_id, phone_normalized) where phone_normalized <> '';

-- Trigram index for fuzzy full-name matching, used by find_contact_duplicates.
create index contacts_fullname_trgm_idx on public.contacts
  using gin ((lower(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) gin_trgm_ops);

-- activities.type: widen for forward-compat with the timeline's "form
-- submission" filter chip. No forms/public-submission feature is built in
-- this pass -- this just reserves the value so the CHECK constraint doesn't
-- need another migration when one lands.
alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('note', 'call', 'email', 'sms', 'meeting', 'stage_change', 'task_completed', 'form_submission', 'other'));

-- notes ---------------------------------------------------------------------

-- Kept separate from activities: notes need mutable state (pinning, edits)
-- which conflicts with activities' deliberate append-only design (it *is*
-- the immutable CRM audit trail). The unified timeline merges activities +
-- messages + notes in application code instead.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  is_pinned boolean not null default false,
  pinned_at timestamptz,
  pinned_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_organization_id_idx on public.notes (organization_id);
create index notes_contact_id_idx on public.notes (contact_id, is_pinned);
create index notes_mentioned_user_ids_idx on public.notes using gin (mentioned_user_ids);

create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger notes_audit after insert or update or delete on public.notes for each row execute function public.audit_trigger_fn();

alter table public.notes enable row level security;

create policy "notes_select" on public.notes for select using (organization_id = public.current_org_id());
create policy "notes_insert" on public.notes for insert with check (organization_id = public.current_org_id());
create policy "notes_update" on public.notes for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy "notes_delete" on public.notes for delete using (organization_id = public.current_org_id());

-- files (attachment metadata; bytes live in Supabase Storage) --------------

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  uploaded_by uuid references public.users (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index files_organization_id_idx on public.files (organization_id);
create index files_contact_id_idx on public.files (contact_id);

-- Attachment metadata is immutable once uploaded (delete + re-upload rather
-- than edit), so no updated_at trigger -- but it's still audit-tracked
-- since deletions of contracts/screenshots are worth a paper trail.
create trigger files_audit after insert or update or delete on public.files for each row execute function public.audit_trigger_fn();

alter table public.files enable row level security;

create policy "files_select" on public.files for select using (organization_id = public.current_org_id());
create policy "files_insert" on public.files for insert with check (organization_id = public.current_org_id());
create policy "files_delete" on public.files for delete using (organization_id = public.current_org_id());

-- Storage bucket + RLS. Path convention: {organization_id}/{contact_id}/{uuid}-{filename}
-- so storage.foldername(name)[1] is always the caller's org for a policy check.
insert into storage.buckets (id, name, public)
values ('contact-files', 'contact-files', false)
on conflict (id) do nothing;

create policy "contact_files_select" on storage.objects for select using (
  bucket_id = 'contact-files' and (storage.foldername(name))[1] = public.current_org_id()::text
);
create policy "contact_files_insert" on storage.objects for insert with check (
  bucket_id = 'contact-files' and (storage.foldername(name))[1] = public.current_org_id()::text
);
create policy "contact_files_delete" on storage.objects for delete using (
  bucket_id = 'contact-files' and (storage.foldername(name))[1] = public.current_org_id()::text
);

-- saved_views ----------------------------------------------------------------

-- Replaces the previous localStorage-only "saved views" stub in
-- contacts-table.tsx. is_shared + created_by is the sharing model: everyone
-- in the org can *see* a shared view, only its creator can edit/delete it.
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  entity_type text not null default 'contact' check (entity_type in ('contact')),
  name text not null,
  created_by uuid references public.users (id) on delete set null,
  is_shared boolean not null default false,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb,
  column_visibility jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_views_organization_id_idx on public.saved_views (organization_id);

create trigger saved_views_set_updated_at before update on public.saved_views for each row execute function public.set_updated_at();
create trigger saved_views_audit after insert or update or delete on public.saved_views for each row execute function public.audit_trigger_fn();

alter table public.saved_views enable row level security;

create policy "saved_views_select" on public.saved_views for select using (
  organization_id = public.current_org_id() and (is_shared or created_by = auth.uid())
);
create policy "saved_views_insert" on public.saved_views for insert with check (
  organization_id = public.current_org_id() and created_by = auth.uid()
);
create policy "saved_views_update" on public.saved_views for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "saved_views_delete" on public.saved_views for delete using (created_by = auth.uid());

-- Duplicate detection ---------------------------------------------------------

-- On-demand, not a maintained flag column: at this scale a trigger-maintained
-- flag would add write-path overhead to every contact insert/update for
-- marginal benefit over just querying on page view.
create or replace function public.find_contact_duplicates(p_contact_id uuid)
returns table (candidate_id uuid, match_reason text, score numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with target as (
    select * from public.contacts where id = p_contact_id and organization_id = public.current_org_id()
  )
  select
    c.id,
    case
      when c.phone_normalized <> '' and c.phone_normalized = t.phone_normalized then 'same phone'
      when c.email is not null and t.email is not null and lower(c.email) = lower(t.email) then 'same email'
      when c.company_id is not distinct from t.company_id
        and lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) = lower(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, ''))
        then 'same name + company'
      else 'similar name'
    end as match_reason,
    greatest(
      similarity(
        lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
        lower(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, ''))
      ),
      case when c.phone_normalized <> '' and c.phone_normalized = t.phone_normalized then 1 else 0 end
    ) as score
  from public.contacts c, target t
  where c.organization_id = public.current_org_id()
    and c.id <> t.id
    and (
      (c.phone_normalized <> '' and c.phone_normalized = t.phone_normalized)
      or (c.email is not null and t.email is not null and lower(c.email) = lower(t.email))
      or similarity(
           lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
           lower(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, ''))
         ) > 0.55
    )
  order by score desc
  limit 10;
$$;

-- Reassigns every FK that points at contacts.id from loser -> winner, then
-- deletes the loser. security definer since it writes across many tables
-- the caller may not have full direct-write RLS access patterns for in one
-- transaction; explicit org checks below stand in for RLS on those writes.
create or replace function public.merge_contacts(winner_id uuid, loser_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_loser record;
begin
  if winner_id = loser_id then
    raise exception 'cannot merge a contact with itself';
  end if;

  select organization_id into v_org from public.contacts where id = winner_id;
  if v_org is null or v_org <> public.current_org_id() then
    raise exception 'winner contact not found in this organization';
  end if;

  if not exists (select 1 from public.contacts where id = loser_id and organization_id = v_org) then
    raise exception 'loser contact not found in this organization';
  end if;

  select * into v_loser from public.contacts where id = loser_id;

  update public.deals set contact_id = winner_id where contact_id = loser_id;
  update public.activities set contact_id = winner_id where contact_id = loser_id;
  update public.tasks set contact_id = winner_id where contact_id = loser_id;
  update public.messages set contact_id = winner_id where contact_id = loser_id;
  update public.notes set contact_id = winner_id where contact_id = loser_id;
  update public.files set contact_id = winner_id where contact_id = loser_id;

  insert into public.contact_tags (contact_id, tag_id, organization_id)
    select winner_id, tag_id, organization_id from public.contact_tags where contact_id = loser_id
    on conflict (contact_id, tag_id) do nothing;
  delete from public.contact_tags where contact_id = loser_id;

  update public.custom_field_values v set entity_id = winner_id
    where v.entity_type = 'contact' and v.entity_id = loser_id
      and not exists (
        select 1 from public.custom_field_values w
        where w.custom_field_id = v.custom_field_id and w.entity_type = 'contact' and w.entity_id = winner_id
      );
  delete from public.custom_field_values where entity_type = 'contact' and entity_id = loser_id;

  -- Exit the loser's active enrollment first wherever the winner already has
  -- an active run of the same sequence, so the reassignment below never
  -- collides with sequence_enrollments_active_unique_idx.
  update public.sequence_enrollments se set status = 'exited', completed_at = now()
    where se.contact_id = loser_id and se.status = 'active'
      and exists (
        select 1 from public.sequence_enrollments w
        where w.sequence_id = se.sequence_id and w.contact_id = winner_id and w.status = 'active'
      );
  update public.sequence_enrollments set contact_id = winner_id where contact_id = loser_id;

  update public.contacts set
    email = coalesce(email, v_loser.email),
    phone = coalesce(phone, v_loser.phone),
    company_id = coalesce(company_id, v_loser.company_id),
    job_title = coalesce(job_title, v_loser.job_title),
    source = coalesce(source, v_loser.source),
    avatar_url = coalesce(avatar_url, v_loser.avatar_url)
  where id = winner_id;

  insert into public.activities (organization_id, contact_id, user_id, type, body, metadata)
  values (
    v_org,
    winner_id,
    auth.uid(),
    'other',
    'Merged duplicate contact',
    jsonb_build_object(
      'event', 'contact_merged',
      'loser_id', loser_id,
      'loser_name', trim(coalesce(v_loser.first_name, '') || ' ' || coalesce(v_loser.last_name, '')),
      'loser_email', v_loser.email
    )
  );

  delete from public.contacts where id = loser_id;
end;
$$;

-- Grants ----------------------------------------------------------------------

-- Both roles need explicit grants -- alter default privileges from
-- 20260824000009/20260825000002 covers this automatically for tables/
-- functions created by the same migration role, but these are listed
-- explicitly to match this project's established, defensive convention.
grant select, insert, update, delete on public.notes, public.files, public.saved_views to authenticated, service_role;
grant execute on function public.find_contact_duplicates(uuid) to authenticated, service_role;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated, service_role;
