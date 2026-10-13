-- Taurus Project Control V24 — user presence + user-admin repair
-- Run once in Supabase SQL Editor after the previous Taurus migrations.
-- Safe to run more than once.

begin;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Re-apply the table privileges required by the signed-in portal. RLS still
-- restricts who can see or change records; server-side administration uses the
-- secret/service-role key and therefore is not exposed to the browser.
grant select on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
grant select, insert, update, delete on public.project_members to service_role;
grant select, insert on public.audit_log to service_role;

-- Keep the signed-in read policy explicit and idempotent.
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using ((select auth.uid()) = id or public.is_platform_admin());

-- Lightweight heartbeat: users can update only their own presence timestamp.
create or replace function public.touch_my_presence()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched timestamptz := now();
begin
  update public.profiles
  set last_seen_at = touched,
      updated_at = now()
  where id = (select auth.uid())
    and is_active;
  return touched;
end;
$$;

revoke all on function public.touch_my_presence() from public;
grant execute on function public.touch_my_presence() to authenticated;

commit;
