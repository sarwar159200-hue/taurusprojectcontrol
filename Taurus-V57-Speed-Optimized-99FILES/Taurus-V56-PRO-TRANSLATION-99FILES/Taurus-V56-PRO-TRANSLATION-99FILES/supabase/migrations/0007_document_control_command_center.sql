-- Taurus Project Control — MDR contractual review workflow
-- Run once after 0006_reliable_versioned_excel_publishing.sql.
-- Taurus review clock: ENKA latest submission + 14 calendar days.
-- ENKA comment-incorporation clock: Taurus latest response + 14 calendar days.

begin;

alter table public.document_records
  add column if not exists first_submission_date date,
  add column if not exists review_cycle_days integer,
  add column if not exists due_date date,
  add column if not exists responsible_party text,
  add column if not exists total_running_days integer,
  add column if not exists hold_by_taurus_days integer,
  add column if not exists hold_by_enka_days integer,
  add column if not exists delay_analysis text,
  add column if not exists transmittal_no text,
  add column if not exists transmittal_date date;

create index if not exists document_records_due_idx
  on public.document_records(version_id, due_date, responsible_party);

comment on column public.document_records.due_date is
  'Active contractual due date: latest ENKA submission + 14 days for Taurus action, or latest Taurus response + 14 days for ENKA action.';
comment on column public.document_records.responsible_party is
  'Party currently holding the action: Taurus, ENKA, Closed, On Hold, or Unassigned.';

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'document_records'
  and column_name in ('due_date', 'responsible_party', 'review_cycle_days')
order by column_name;
