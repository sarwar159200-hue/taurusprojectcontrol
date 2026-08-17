-- Taurus Project Control — reliable batched Excel publishing
-- Run once after 0005_final_portal_repair.sql.
--
-- Large Excel analyses are stored in the existing normalized version tables
-- instead of one oversized JSON request. The latest progress and schedule
-- versions are referenced independently so either workbook can be updated.

begin;

alter table public.published_project_updates
  add column if not exists progress_version_id uuid
    references public.data_versions(id) on delete set null,
  add column if not exists schedule_version_id uuid
    references public.data_versions(id) on delete set null;

alter table public.schedule_activities
  add column if not exists subdiscipline text;

create index if not exists published_updates_progress_version_idx
  on public.published_project_updates(progress_version_id);

create index if not exists published_updates_schedule_version_idx
  on public.published_project_updates(schedule_version_id);

grant select, insert, update, delete on public.import_runs,
  public.data_versions, public.document_records, public.progress_points,
  public.schedule_activities, public.published_project_updates to authenticated;

grant usage, select on all sequences in schema public to authenticated;

drop policy if exists published_updates_manage_admin on public.published_project_updates;
create policy published_updates_manage_admin on public.published_project_updates
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

drop policy if exists audit_insert_authenticated on public.audit_log;
create policy audit_insert_authenticated on public.audit_log
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (project_id is null or public.has_project_access(project_id))
);

drop policy if exists documents_manage_admin on public.document_records;
create policy documents_manage_admin on public.document_records
for all to authenticated
using (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
))
with check (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
));

drop policy if exists progress_manage_admin on public.progress_points;
create policy progress_manage_admin on public.progress_points
for all to authenticated
using (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
))
with check (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
));

drop policy if exists schedule_manage_admin on public.schedule_activities;
create policy schedule_manage_admin on public.schedule_activities
for all to authenticated
using (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
))
with check (exists (
  select 1 from public.data_versions version
  where version.id = version_id
    and public.can_manage_project(version.project_id)
));

update public.profiles
set
  role = 'super_admin',
  is_active = true,
  section_permissions =
    '{"overview":"manage","document_control":"manage","progress":"manage","schedule":"manage","imports":"manage","user_access":"manage","activity_log":"manage"}'::jsonb,
  updated_at = now()
where lower(email::text) = 'sarwar.khalid@miranenergy.com';

commit;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'published_project_updates'
  and column_name in ('progress_version_id', 'schedule_version_id')
order by column_name;
