-- Project Controls Intelligence Portal — Phase 1
-- Run once in a new Supabase project using SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum (
  'super_admin',
  'project_admin',
  'document_controller',
  'planner',
  'viewer'
);

create type public.import_kind as enum ('progress', 'schedule', 'xer');
create type public.import_status as enum ('uploaded', 'validating', 'ready', 'failed', 'published', 'superseded');
create type public.version_status as enum ('staging', 'published', 'superseded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  username citext not null unique,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null default 'Asia/Baghdad',
  is_active boolean not null default true,
  status_thresholds jsonb not null default '{"ahead":1.01,"on_plan_min":0.99,"slightly_behind_min":0.96}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind public.import_kind not null,
  status public.import_status not null default 'uploaded',
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  checksum_sha256 text,
  storage_provider text not null default 'onedrive',
  drive_item_id text,
  drive_web_url text,
  validation_result jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.data_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  import_run_id uuid references public.import_runs(id) on delete set null,
  version_number integer not null check (version_number > 0),
  status public.version_status not null default 'staging',
  data_date date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  unique (project_id, version_number)
);

alter table public.projects
  add column published_version_id uuid references public.data_versions(id) on delete set null;

create table public.document_records (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.data_versions(id) on delete cascade,
  document_no text not null,
  title text,
  system_division text,
  document_type text,
  discipline text,
  subdiscipline text,
  revision text,
  purpose text,
  last_submission_date date,
  last_response_date date,
  last_status text,
  current_action text,
  review_cycles integer,
  overdue_days integer,
  drive_item_id text,
  drive_web_url text,
  source_row integer,
  unique (version_id, document_no)
);

create table public.progress_points (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.data_versions(id) on delete cascade,
  frequency text not null check (frequency in ('monthly', 'weekly')),
  area text not null,
  discipline text not null default 'Overall',
  subdiscipline text,
  measure text not null check (measure in ('baseline', 'planned', 'actual', 'forecast')),
  period_date date not null,
  incremental_value numeric(12,8),
  cumulative_value numeric(12,8),
  unique (version_id, frequency, area, discipline, subdiscipline, measure, period_date)
);

create table public.schedule_activities (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.data_versions(id) on delete cascade,
  activity_id text not null,
  activity_name text not null,
  wbs_path text,
  discipline text,
  activity_status text,
  activity_type text,
  baseline_start date,
  baseline_finish date,
  current_start date,
  current_finish date,
  original_duration numeric,
  remaining_duration numeric,
  total_float numeric,
  schedule_percent_complete numeric,
  performance_percent_complete numeric,
  is_critical boolean not null default false,
  calendar_name text,
  primary_constraint text,
  constraint_date date,
  predecessors jsonb not null default '[]'::jsonb,
  successors jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  source_row integer,
  unique (version_id, activity_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  project_id uuid references public.projects(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index project_members_user_idx on public.project_members(user_id, project_id);
create index import_runs_project_idx on public.import_runs(project_id, created_at desc);
create index data_versions_project_idx on public.data_versions(project_id, version_number desc);
create index document_records_version_idx on public.document_records(version_id, discipline, last_status);
create index progress_points_version_idx on public.progress_points(version_id, area, frequency, period_date);
create index schedule_activities_version_idx on public.schedule_activities(version_id, is_critical, total_float);
create index audit_log_project_idx on public.audit_log(project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, username, full_name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@pending.local'),
    lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'user'), '@', 1))) || '_' || left(new.id::text, 6),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.is_active
  );
$$;

create or replace function public.has_project_access(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid())
      and p.is_active
  );
$$;

create or replace function public.can_manage_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid())
      and pm.role = 'project_admin'
      and p.is_active
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.has_project_access(uuid) from public;
revoke all on function public.can_manage_project(uuid) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_project_access(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.import_runs enable row level security;
alter table public.data_versions enable row level security;
alter table public.document_records enable row level security;
alter table public.progress_points enable row level security;
alter table public.schedule_activities enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using ((select auth.uid()) = id or public.is_platform_admin());

create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy projects_read_member on public.projects
for select to authenticated
using (public.has_project_access(id));

create policy projects_manage_admin on public.projects
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy project_members_read on public.project_members
for select to authenticated
using (public.has_project_access(project_id));

create policy project_members_manage on public.project_members
for all to authenticated
using (public.is_platform_admin() or public.can_manage_project(project_id))
with check (public.is_platform_admin() or public.can_manage_project(project_id));

create policy import_runs_read on public.import_runs
for select to authenticated
using (public.has_project_access(project_id));

create policy import_runs_manage on public.import_runs
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create policy versions_read on public.data_versions
for select to authenticated
using (public.has_project_access(project_id));

create policy versions_manage on public.data_versions
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create policy documents_read on public.document_records
for select to authenticated
using (exists (
  select 1 from public.data_versions v
  where v.id = version_id and public.has_project_access(v.project_id)
));

create policy progress_read on public.progress_points
for select to authenticated
using (exists (
  select 1 from public.data_versions v
  where v.id = version_id and public.has_project_access(v.project_id)
));

create policy schedule_read on public.schedule_activities
for select to authenticated
using (exists (
  select 1 from public.data_versions v
  where v.id = version_id and public.has_project_access(v.project_id)
));

create policy audit_read_admin on public.audit_log
for select to authenticated
using (public.is_platform_admin() or (project_id is not null and public.can_manage_project(project_id)));

grant select on public.profiles, public.projects, public.project_members, public.import_runs,
  public.data_versions, public.document_records, public.progress_points,
  public.schedule_activities, public.audit_log to authenticated;
grant insert, update, delete on public.projects, public.project_members, public.import_runs,
  public.data_versions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Create the first project after replacing the administrator UUID if desired:
-- insert into public.projects (code, name, created_by)
-- values ('BAZYAN-II', 'Bazian II Power Plant Conversion Project', 'YOUR-ADMIN-UUID');
