-- Taurus Project Control V41 — security boundary + payment permissions
-- Run after 0001-0009. Safe to run more than once.
begin;

-- Existing section_permissions JSON can safely gain a new key without changing
-- any of the previous section rules.
update public.profiles
set section_permissions = jsonb_set(
  coalesce(section_permissions, '{}'::jsonb),
  '{payments}',
  case
    when lower(email) in ('sarwar.khalid@miranenergy.com','saiwan.salih@taurusenergy.com') then '"manage"'::jsonb
    else '"none"'::jsonb
  end,
  true
), updated_at = now();

-- Keep the named account roles/permissions aligned with the application rules.
update public.profiles
set role = 'super_admin'::public.app_role,
    is_active = true,
    section_permissions = jsonb_set(jsonb_set(coalesce(section_permissions, '{}'::jsonb), '{user_access}', '"manage"'::jsonb, true), '{payments}', '"manage"'::jsonb, true),
    updated_at = now()
where lower(email) = 'sarwar.khalid@miranenergy.com';

update public.profiles
set role = 'project_admin'::public.app_role,
    is_active = true,
    section_permissions = jsonb_set(coalesce(section_permissions, '{}'::jsonb), '{user_access}', '"manage"'::jsonb, true),
    updated_at = now()
where lower(email) = 'saman.tohidi@taurusenergy.com';

update public.profiles
set is_active = true,
    section_permissions = jsonb_set(coalesce(section_permissions, '{}'::jsonb), '{payments}', '"manage"'::jsonb, true),
    updated_at = now()
where lower(email) = 'saiwan.salih@taurusenergy.com';

-- Additional indexes for the most frequent authorization/navigation lookups.
create index if not exists idx_profiles_email_lower_active on public.profiles (lower(email), is_active);
create index if not exists idx_project_members_user_project on public.project_members (user_id, project_id);
create index if not exists idx_published_updates_project_updated on public.published_project_updates (project_id, updated_at desc);

commit;
-- Taurus Project Control V45 — Payment dashboard storage + permissions
-- Safe to run more than once. Run in Supabase SQL Editor.
begin;

create table if not exists public.payment_dashboard_snapshots (
  project_id uuid primary key references public.projects(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  source_file_name text not null,
  data_date date,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_payment_dashboard_uploaded_at
  on public.payment_dashboard_snapshots (uploaded_at desc);

alter table public.payment_dashboard_snapshots enable row level security;

grant select, insert, update, delete on public.payment_dashboard_snapshots to authenticated;
grant all on public.payment_dashboard_snapshots to service_role;

drop policy if exists "payment snapshots view" on public.payment_dashboard_snapshots;
create policy "payment snapshots view" on public.payment_dashboard_snapshots
for select to authenticated
using (
  public.has_project_access(project_id)
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'super_admin'::public.app_role
        or coalesce(p.section_permissions->>'payments','none') in ('view','manage')
      )
  )
);

drop policy if exists "payment snapshots manage" on public.payment_dashboard_snapshots;
create policy "payment snapshots manage" on public.payment_dashboard_snapshots
for all to authenticated
using (
  lower(coalesce(auth.jwt()->>'email','')) in ('sarwar.khalid@miranenergy.com','saiwan.salih@taurusenergy.com')
)
with check (
  lower(coalesce(auth.jwt()->>'email','')) in ('sarwar.khalid@miranenergy.com','saiwan.salih@taurusenergy.com')
);

commit;
