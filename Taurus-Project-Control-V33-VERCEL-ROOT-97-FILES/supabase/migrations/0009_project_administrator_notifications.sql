-- Taurus Project Control V33 — Project Administrator notification authorization
-- Run after migrations 0001-0008. Safe to run more than once.
-- Purpose:
--   1) Only Super Admin / Project Administrator may publish controlled updates.
--   2) Only those two roles are authorized to initiate project-wide notifications.
--   3) Remove Import/Publish UI permission from non-admin operational roles.

begin;

create or replace function public.can_send_project_notification(target_project_id uuid)
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
      and pm.role = 'project_admin'::public.app_role
      and p.is_active
  );
$$;

revoke all on function public.can_send_project_notification(uuid) from public;
grant execute on function public.can_send_project_notification(uuid) to authenticated;

-- Keep publishing at database level restricted to project management.
drop policy if exists published_updates_manage_admin on public.published_project_updates;
create policy published_updates_manage_admin on public.published_project_updates
for all to authenticated
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

-- Hide Import/Publish permission from all non-admin roles. Super Admin remains
-- unrestricted in application code; Project Administrator keeps manage access.
update public.profiles
set section_permissions = jsonb_set(
  coalesce(section_permissions, '{}'::jsonb),
  '{imports}',
  '"none"'::jsonb,
  true
), updated_at = now()
where role not in ('super_admin'::public.app_role, 'project_admin'::public.app_role);

update public.profiles
set section_permissions = jsonb_set(
  coalesce(section_permissions, '{}'::jsonb),
  '{imports}',
  '"manage"'::jsonb,
  true
), updated_at = now()
where role in ('super_admin'::public.app_role, 'project_admin'::public.app_role);

commit;
