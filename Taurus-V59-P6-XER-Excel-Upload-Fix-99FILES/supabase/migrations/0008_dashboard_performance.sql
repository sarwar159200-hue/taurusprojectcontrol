-- Taurus dashboard read-path indexes. Safe to run more than once.
create index if not exists document_records_version_id_id_idx
  on public.document_records(version_id, id);
create index if not exists progress_points_version_id_id_idx
  on public.progress_points(version_id, id);
create index if not exists schedule_activities_version_id_id_idx
  on public.schedule_activities(version_id, id);
create index if not exists published_project_updates_project_id_idx
  on public.published_project_updates(project_id);
analyze public.document_records;
analyze public.progress_points;
analyze public.schedule_activities;
analyze public.published_project_updates;

-- V58 navigation/read-path reinforcement. Safe to run more than once.
-- These indexes support the exact equality + ordered reads used by the portal.
create index if not exists data_versions_project_version_idx
  on public.data_versions(project_id, version_number desc);
create index if not exists project_members_project_user_idx
  on public.project_members(project_id, user_id);
create index if not exists profiles_active_id_idx
  on public.profiles(id) where is_active = true;

analyze public.data_versions;
analyze public.project_members;
analyze public.profiles;
