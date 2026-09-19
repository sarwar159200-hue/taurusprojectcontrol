-- Taurus Project Control — final access, audit and publishing repair
-- Run once after migrations 0001 through 0003. This script is idempotent and
-- remains safe when migration 0004 was already installed.

begin;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert on public.audit_log to authenticated;
grant select, insert, update, delete on public.published_project_updates to authenticated;

alter table public.schedule_activities
  add column if not exists subdiscipline text;

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check (public.is_platform_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists audit_insert_authenticated on public.audit_log;
create policy audit_insert_authenticated on public.audit_log
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (project_id is null or public.has_project_access(project_id))
);

drop policy if exists published_updates_manage_admin on public.published_project_updates;
create policy published_updates_manage_admin on public.published_project_updates
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create or replace function public.resolve_login_email(login_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.email::text
  from public.profiles p
  where lower(p.username::text) = lower(trim(login_username))
    and p.is_active
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

update public.profiles
set
  username = 'sarwar.khalid',
  full_name = 'Sarwar Khalid',
  role = 'super_admin',
  is_active = true,
  must_change_password = false,
  section_permissions =
    '{"overview":"manage","document_control":"manage","progress":"manage","schedule":"manage","imports":"manage","user_access":"manage","activity_log":"manage"}'::jsonb,
  updated_at = now()
where lower(email::text) = 'sarwar.khalid@miranenergy.com';

insert into public.projects (code, name, created_by)
select 'BAZYAN-II', 'Bazian II Power Plant Conversion Project', owner.id
from public.profiles owner
where lower(owner.email::text) = 'sarwar.khalid@miranenergy.com'
on conflict (code) do update
set name = excluded.name,
    created_by = coalesce(public.projects.created_by, excluded.created_by),
    updated_at = now();

insert into public.project_members (project_id, user_id, role)
select project.id, owner.id, 'super_admin'::public.app_role
from public.projects project
join public.profiles owner
  on lower(owner.email::text) = 'sarwar.khalid@miranenergy.com'
where project.code = 'BAZYAN-II'
on conflict (project_id, user_id) do update set role = excluded.role;

commit;

select
  owner.id as owner_id,
  owner.email,
  owner.role,
  owner.is_active,
  project.id as default_project_id,
  (owner.role = 'super_admin'::public.app_role and owner.is_active) as owner_is_super_admin
from public.profiles owner
join public.project_members member on member.user_id = owner.id
join public.projects project on project.id = member.project_id
where lower(owner.email::text) = 'sarwar.khalid@miranenergy.com'
  and project.code = 'BAZYAN-II';
