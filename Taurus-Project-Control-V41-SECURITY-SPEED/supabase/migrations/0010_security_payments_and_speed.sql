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
