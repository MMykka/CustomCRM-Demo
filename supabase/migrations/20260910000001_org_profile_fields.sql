-- Organization profile: logo, timezone, business hours, quiet hours.

alter table public.organizations
  add column logo_url text,
  add column timezone text not null default 'UTC',
  add column business_hours jsonb,
  add column quiet_hours jsonb;

-- Storage bucket + RLS for org logos, same convention as contact-files
-- (supabase/migrations/20260826000001_contact_expansion_schema.sql):
-- path is {organization_id}/{uuid}-{filename}. Public (unlike
-- contact-files) since a logo is displayed broadly and isn't sensitive.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy "org_logos_select" on storage.objects for select using (
  bucket_id = 'org-logos'
);
create policy "org_logos_insert" on storage.objects for insert with check (
  bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.current_org_id()::text
);
create policy "org_logos_update" on storage.objects for update using (
  bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.current_org_id()::text
);
create policy "org_logos_delete" on storage.objects for delete using (
  bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.current_org_id()::text
);
