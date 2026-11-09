-- MCCS 2.19.1 Owner security lockdown + owner-provisioned account allow-list.
-- Safe/idempotent: rerun this migration after deploying the 2.19.1 package.
begin;

create table if not exists public.mccs_authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  authorized_by uuid null references auth.users(id) on delete set null,
  authorized_email text null,
  authorized_at timestamptz not null default now()
);

alter table public.mccs_authorized_users enable row level security;

create or replace function public.mccs_is_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'sarwar.khalid@miranenergy.com';
$$;
grant execute on function public.mccs_is_owner() to authenticated;

create or replace function public.mccs_is_authorized()
returns boolean language sql stable security definer set search_path=public as $$
  select public.mccs_is_owner()
     or exists(select 1 from public.mccs_authorized_users a where a.user_id = auth.uid());
$$;
grant execute on function public.mccs_is_authorized() to authenticated;

-- Preserve existing legitimate MCCS users where the role was granted by the Owner.
-- This does NOT auto-authorize future accounts created in Supabase, by scripts, or by attackers.
-- Important for idempotent reruns: an older copy of the owner-guard trigger may
-- already exist from a previous migration run. Drop it before the trusted seed
-- operation, then recreate it in the protection section below.
drop trigger if exists trg_mccs_owner_authorized_users on public.mccs_authorized_users;

do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email)='sarwar.khalid@miranenergy.com' limit 1;
  if owner_id is not null then
    insert into public.mccs_authorized_users(user_id,authorized_by,authorized_email,authorized_at)
    values(owner_id,owner_id,'sarwar.khalid@miranenergy.com',now())
    on conflict(user_id) do nothing;

    if to_regclass('public.user_roles') is not null then
      insert into public.mccs_authorized_users(user_id,authorized_by,authorized_email,authorized_at)
      select distinct ur.user_id, owner_id, au.email, now()
      from public.user_roles ur
      join auth.users au on au.id=ur.user_id
      where ur.granted_by=owner_id
      on conflict(user_id) do nothing;
    end if;
  end if;
end $$;

-- Any legacy super-admin helper recognizes only the fixed MCCS Owner.
create or replace function public.vdrl_is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$ select public.mccs_is_owner(); $$;
grant execute on function public.vdrl_is_super_admin() to authenticated;

create or replace function public.current_user_is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$ select public.mccs_is_owner(); $$;
grant execute on function public.current_user_is_super_admin() to authenticated;

-- Protect authority tables. Service-role is used only by trusted MCCS server routes.
create or replace function public.mccs_guard_authority_changes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.mccs_is_owner() then
    raise exception 'Only the MCCS Owner may change user authority.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    drop trigger if exists trg_mccs_owner_user_roles on public.user_roles;
    create trigger trg_mccs_owner_user_roles before insert or update or delete on public.user_roles for each row execute function public.mccs_guard_authority_changes();
  end if;
  if to_regclass('public.user_tab_permissions') is not null then
    drop trigger if exists trg_mccs_owner_tab_permissions on public.user_tab_permissions;
    create trigger trg_mccs_owner_tab_permissions before insert or update or delete on public.user_tab_permissions for each row execute function public.mccs_guard_authority_changes();
  end if;
  drop trigger if exists trg_mccs_owner_authorized_users on public.mccs_authorized_users;
  create trigger trg_mccs_owner_authorized_users before insert or update or delete on public.mccs_authorized_users for each row execute function public.mccs_guard_authority_changes();
end $$;

-- Profiles remain editable for ordinary profile fields, but authority cannot be escalated client-side.
create or replace function public.mccs_guard_profile_authority()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (coalesce(new.is_super_admin,false) is distinct from coalesce(old.is_super_admin,false)
      or coalesce(new.is_active,true) is distinct from coalesce(old.is_active,true))
     and coalesce(auth.role(),'') <> 'service_role' and not public.mccs_is_owner() then
    raise exception 'Only the MCCS Owner may change account authority or activation.';
  end if;
  return new;
end; $$;

do $$ begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists trg_mccs_owner_profile_authority on public.profiles;
    create trigger trg_mccs_owner_profile_authority before update on public.profiles for each row execute function public.mccs_guard_profile_authority();
  end if;
end $$;

-- Audit history is append-only for normal authenticated sessions.
create or replace function public.mccs_guard_audit_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'MCCS audit history is append-only.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;

do $$ begin
  if to_regclass('public.audit_logs') is not null then
    drop trigger if exists trg_mccs_append_only_audit on public.audit_logs;
    create trigger trg_mccs_append_only_audit before update or delete on public.audit_logs for each row execute function public.mccs_guard_audit_history();
  end if;
end $$;

-- Critical defense-in-depth gate: even if an outside account manages to authenticate,
-- restrictive RLS requires that it was provisioned through the MCCS Owner workflow.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','user_roles','user_tab_permissions','vendors','projects','currencies',
    'purchase_orders','purchase_order_items','payment_milestones','invoices','invoice_approvals',
    'payments','documents','audit_logs','vdrl_registers','vdrl_documents','vdrl_revisions',
    'vdrl_stages','vdrl_return_codes','vdrl_import_batches','vdrl_mapping_templates',
    'chat_messages','chat_groups','chat_group_members','chat_calls','chat_call_signals'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists mccs_authorized_account_gate on public.%I',t);
      execute format('create policy mccs_authorized_account_gate on public.%I as restrictive for all to authenticated using (public.mccs_is_authorized()) with check (public.mccs_is_authorized())',t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- MCCS security event ledger
-- Captures Auth users created/deleted from ANY source. This is deliberately
-- independent of the MCCS UI so an outside-created account leaves evidence.
-- ---------------------------------------------------------------------------
create table if not exists public.mccs_security_events (
  id bigint generated by default as identity primary key,
  event_type text not null,
  user_id uuid null,
  email text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mccs_security_events enable row level security;
revoke insert, update, delete on public.mccs_security_events from anon, authenticated;
grant select on public.mccs_security_events to authenticated;

drop policy if exists mccs_security_events_owner_read on public.mccs_security_events;
create policy mccs_security_events_owner_read
on public.mccs_security_events
for select
to authenticated
using (public.mccs_is_owner());

create or replace function public.mccs_capture_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  owner_provisioned boolean := false;
  provider_name text := null;
begin
  begin
    owner_provisioned := coalesce((new.raw_app_meta_data->>'mccs_owner_provisioned')::boolean,false);
  exception when others then
    owner_provisioned := false;
  end;

  provider_name := coalesce(new.raw_app_meta_data->>'provider', new.raw_user_meta_data->>'provider');

  insert into public.mccs_security_events(event_type,user_id,email,details,created_at)
  values(
    case when owner_provisioned then 'AUTH_USER_CREATED_OWNER' else 'AUTH_USER_CREATED_EXTERNAL' end,
    new.id,
    lower(new.email),
    jsonb_build_object(
      'owner_provisioned', owner_provisioned,
      'provider', provider_name,
      'email_confirmed_at', new.email_confirmed_at
    ),
    now()
  );
  return new;
end;
$$;

create or replace function public.mccs_capture_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  insert into public.mccs_security_events(event_type,user_id,email,details,created_at)
  values(
    'AUTH_USER_DELETED',
    old.id,
    lower(old.email),
    jsonb_build_object('provider', old.raw_app_meta_data->>'provider'),
    now()
  );
  return old;
end;
$$;

drop trigger if exists trg_mccs_auth_user_created on auth.users;
create trigger trg_mccs_auth_user_created
after insert on auth.users
for each row execute function public.mccs_capture_auth_user_created();

drop trigger if exists trg_mccs_auth_user_deleted on auth.users;
create trigger trg_mccs_auth_user_deleted
after delete on auth.users
for each row execute function public.mccs_capture_auth_user_deleted();

-- Security ledger is immutable to normal authenticated users. Service-role may
-- maintain it through trusted server operations if required.
create or replace function public.mccs_guard_security_event_history()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'MCCS security event history is append-only.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_mccs_security_events_immutable on public.mccs_security_events;
create trigger trg_mccs_security_events_immutable
before update or delete on public.mccs_security_events
for each row execute function public.mccs_guard_security_event_history();

commit;
