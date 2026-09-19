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
