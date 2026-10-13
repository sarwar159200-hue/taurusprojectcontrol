-- Taurus Project Control V34 — Project Administrator / notification authorization
-- Run after migrations 0001-0008. Safe to run more than once.
--
-- Guarantees:
--   * Every active project member may READ the currently published dashboard.
--   * Only Super Admin / Project Administrator may INSERT/UPDATE/DELETE publishes.
--   * Only those two roles may initiate a project-wide notification.
--   * Import/Publish is hidden from and denied to all other roles.

begin;

grant select, insert, update, delete on public.published_project_updates to authenticated;
grant select on public.project_members to authenticated;

create or replace function public.can_send_project_notification(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'super_admin'::public.app_role
  ) or exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid())
      and pm.role = 'project_admin'::public.app_role
      and p.role = 'project_admin'::public.app_role
      and p.is_active
  );
$$;

revoke all on function public.can_send_project_notification(uuid) from public;
grant execute on function public.can_send_project_notification(uuid) to authenticated;

-- Keep member reading separate from management. This prevents an admin-only
-- FOR ALL policy from accidentally becoming the only usable policy.
drop policy if exists published_updates_read_member on public.published_project_updates;
create policy published_updates_read_member
on public.published_project_updates
for select to authenticated
using (public.has_project_access(project_id));

drop policy if exists published_updates_manage_admin on public.published_project_updates;
drop policy if exists published_updates_insert_admin on public.published_project_updates;
drop policy if exists published_updates_update_admin on public.published_project_updates;
drop policy if exists published_updates_delete_admin on public.published_project_updates;

create policy published_updates_insert_admin
on public.published_project_updates
for insert to authenticated
with check (public.can_send_project_notification(project_id));

create policy published_updates_update_admin
on public.published_project_updates
for update to authenticated
using (public.can_send_project_notification(project_id))
with check (public.can_send_project_notification(project_id));

create policy published_updates_delete_admin
on public.published_project_updates
for delete to authenticated
using (public.can_send_project_notification(project_id));

-- Non-admin roles are explicitly denied Import/Publish permission.
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
