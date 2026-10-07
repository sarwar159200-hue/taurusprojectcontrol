-- Taurus Project Control — permission-safe portal operations
-- Run once after 0001, 0002 and 0003.

begin;

-- Super administrators use their signed-in session for database work. The
-- service-role secret is reserved for Supabase Auth user creation/passwords.
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

-- Username sign-in can resolve an active account without exposing the profiles
-- table to anonymous users. Email sign-in remains the recommended method.
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

create or replace function public.touch_own_login()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set last_login_at = now(), updated_at = now()
  where id = (select auth.uid());
$$;

create or replace function public.complete_own_password_change()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false, updated_at = now()
  where id = (select auth.uid());
$$;

revoke all on function public.touch_own_login() from public;
revoke all on function public.complete_own_password_change() from public;
grant execute on function public.touch_own_login() to authenticated;
grant execute on function public.complete_own_password_change() to authenticated;

commit;

-- Verification: each query should return true/one row for the signed-in owner.
select public.is_platform_admin() as owner_is_super_admin;
select id as default_project_id, code, name from public.projects where code = 'BAZYAN-II';
