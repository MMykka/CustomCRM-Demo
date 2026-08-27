-- Supports case-insensitive company lookup by email domain, used by the
-- "auto-link contacts by email domain" feature.
create index companies_domain_lower_idx on public.companies (organization_id, lower(domain)) where domain is not null;
