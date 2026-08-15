-- Taurus Project Control — automatic Excel analysis and latest published snapshot
-- Run once after 0001 and 0002.

create table if not exists public.published_project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  progress_file_name text,
  schedule_file_name text,
  data_date date,
  progress_analysis jsonb,
  schedule_analysis jsonb,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists published_updates_project_idx
  on public.published_project_updates(project_id, published_at desc);

alter table public.published_project_updates enable row level security;

drop policy if exists published_updates_read_member on public.published_project_updates;
create policy published_updates_read_member on public.published_project_updates
for select to authenticated
using (public.has_project_access(project_id));

grant select on public.published_project_updates to authenticated;

comment on table public.published_project_updates is
  'Latest controlled Excel analysis. Writes are restricted to server-side service-role APIs.';

select id as default_project_id, code, name
from public.projects
where code = 'BAZYAN-II';
