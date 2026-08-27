-- Free-text campaign field mirroring `source`, for the Reports funnel-by-campaign breakdown.
alter table public.contacts add column campaign text;
