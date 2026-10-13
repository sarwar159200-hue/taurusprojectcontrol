-- Taurus Project Control — user administration and section permissions
-- Run this once after 0001_initial_schema.sql.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles
  add column if not exists section_permissions jsonb not null default
  '{"overview":"view","document_control":"view","progress":"view","schedule":"view","imports":"none","user_access":"none","activity_log":"none"}'::jsonb;

comment on column public.profiles.section_permissions is
  'Per-section access. Values are none, view, or manage.';

-- Users may read their profile, but role and authorization changes are performed
-- only by the server-side administration API using the Supabase service-role key.
drop policy if exists profiles_update_self on public.profiles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_taurus_owner boolean := lower(coalesce(new.email, '')) = 'sarwar.khalid@miranenergy.com';
begin
  insert into public.profiles (
    id,
    email,
    username,
    full_name,
    role,
    is_active,
    must_change_password,
    section_permissions
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@pending.local'),
    case
      when is_taurus_owner then 'sarwar.khalid'
      else lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'user'), '@', 1))) || '_' || left(new.id::text, 6)
    end,
    case
      when is_taurus_owner then 'Sarwar Khalid'
      else coalesce(new.raw_user_meta_data ->> 'full_name', '')
    end,
    case when is_taurus_owner then 'super_admin'::public.app_role else 'viewer'::public.app_role end,
    true,
    false,
    case
      when is_taurus_owner then
        '{"overview":"manage","document_control":"manage","progress":"manage","schedule":"manage","imports":"manage","user_access":"manage","activity_log":"manage"}'::jsonb
      else
        '{"overview":"view","document_control":"view","progress":"view","schedule":"view","imports":"none","user_access":"none","activity_log":"none"}'::jsonb
    end
  )
  on conflict (id) do nothing;

  if is_taurus_owner then
    insert into public.projects (code, name, created_by)
    values ('BAZYAN-II', 'Bazian II Power Plant Conversion Project', new.id)
    on conflict (code) do update
    set name = excluded.name,
        created_by = coalesce(public.projects.created_by, excluded.created_by),
        updated_at = now();

    insert into public.project_members (project_id, user_id, role)
    select project.id, new.id, 'super_admin'::public.app_role
    from public.projects project
    where project.code = 'BAZYAN-II'
    on conflict (project_id, user_id) do update set role = excluded.role;
  end if;

  return new;
end;
$$;

-- Give any pre-existing non-owner accounts sensible defaults for their role.
update public.profiles
set section_permissions = case role
  when 'project_admin'::public.app_role then
    '{"overview":"manage","document_control":"manage","progress":"manage","schedule":"manage","imports":"manage","user_access":"view","activity_log":"view"}'::jsonb
  when 'document_controller'::public.app_role then
    '{"overview":"view","document_control":"manage","progress":"view","schedule":"view","imports":"manage","user_access":"none","activity_log":"none"}'::jsonb
  when 'planner'::public.app_role then
    '{"overview":"view","document_control":"view","progress":"manage","schedule":"manage","imports":"manage","user_access":"none","activity_log":"none"}'::jsonb
  when 'super_admin'::public.app_role then
    '{"overview":"manage","document_control":"manage","progress":"manage","schedule":"manage","imports":"manage","user_access":"manage","activity_log":"manage"}'::jsonb
  else
    '{"overview":"view","document_control":"view","progress":"view","schedule":"view","imports":"none","user_access":"none","activity_log":"none"}'::jsonb
end
where section_permissions =
  '{"overview":"view","document_control":"view","progress":"view","schedule":"view","imports":"none","user_access":"none","activity_log":"none"}'::jsonb;

-- Promote the named owner if the Auth account already exists.
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

-- Ensure the controlled project exists. Copy the returned UUID to Vercel as
-- DEFAULT_PROJECT_ID after running this migration.
insert into public.projects (code, name, created_by)
select
  'BAZYAN-II',
  'Bazian II Power Plant Conversion Project',
  p.id
from public.profiles p
where lower(p.email::text) = 'sarwar.khalid@miranenergy.com'
on conflict (code) do update
set name = excluded.name,
    created_by = coalesce(public.projects.created_by, excluded.created_by),
    updated_at = now();

insert into public.project_members (project_id, user_id, role)
select project.id, owner.id, 'super_admin'::public.app_role
from public.projects project
join public.profiles owner on lower(owner.email::text) = 'sarwar.khalid@miranenergy.com'
where project.code = 'BAZYAN-II'
on conflict (project_id, user_id) do update set role = excluded.role;

select id as default_project_id, code, name
from public.projects
where code = 'BAZYAN-II';
