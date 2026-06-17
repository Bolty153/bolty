-- =====================================================================
-- BOLTY — Esquema de datos del negocio
-- Pegá TODO esto en Supabase → SQL Editor → Run.
-- Es idempotente: se puede correr varias veces sin romper nada ni borrar datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla business_profiles (datos del negocio + flag de onboarding)
-- ---------------------------------------------------------------------
create table if not exists public.business_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  business_name       text default '',
  industry            text default '',
  description         text default '',
  address             text default '',
  phone               text default '',
  logo_url            text,
  business_hours      jsonb default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Si la tabla ya existía sin estas columnas, las agrega (no pisa datos).
alter table public.business_profiles add column if not exists onboarding_complete boolean not null default false;
alter table public.business_profiles add column if not exists business_hours jsonb default '{}'::jsonb;
alter table public.business_profiles add column if not exists logo_url text;

-- IMPORTANTE: el upsert del frontend usa onConflict: 'user_id'.
-- Sin esta restricción única, el guardado falla con
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
create unique index if not exists business_profiles_user_id_key on public.business_profiles(user_id);

-- ---------------------------------------------------------------------
-- 2) Tabla agent_configs (configuración del agente IA)
-- ---------------------------------------------------------------------
create table if not exists public.agent_configs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  agent_name       text default 'Bolty',
  tone             text default 'Cercano',
  business_type    text default 'Productos y turnos',
  instructions     text default '',
  features_enabled jsonb default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.agent_configs add column if not exists business_type text default 'Productos y turnos';
alter table public.agent_configs add column if not exists features_enabled jsonb default '{}'::jsonb;

create unique index if not exists agent_configs_user_id_key on public.agent_configs(user_id);

-- ---------------------------------------------------------------------
-- 3) Row Level Security: cada usuario sólo ve y edita SU propia fila
-- ---------------------------------------------------------------------
alter table public.business_profiles enable row level security;
alter table public.agent_configs    enable row level security;

-- business_profiles
drop policy if exists "bp_select_own" on public.business_profiles;
create policy "bp_select_own" on public.business_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "bp_insert_own" on public.business_profiles;
create policy "bp_insert_own" on public.business_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "bp_update_own" on public.business_profiles;
create policy "bp_update_own" on public.business_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- agent_configs
drop policy if exists "ac_select_own" on public.agent_configs;
create policy "ac_select_own" on public.agent_configs
  for select using (auth.uid() = user_id);

drop policy if exists "ac_insert_own" on public.agent_configs;
create policy "ac_insert_own" on public.agent_configs
  for insert with check (auth.uid() = user_id);

drop policy if exists "ac_update_own" on public.agent_configs;
create policy "ac_update_own" on public.agent_configs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3.b) Permisos de acceso (GRANT) para los roles de Supabase
--      Sin esto da "permission denied for table ...", incluso con RLS y
--      políticas creadas. RLS decide QUÉ filas; el GRANT decide si el rol
--      puede tocar la tabla. Hacen falta los dos.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.business_profiles to anon, authenticated;
grant select, insert, update, delete on public.agent_configs    to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Storage: bucket público "logos" (el logo se sube a {uid}/logo.ext)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_read" on storage.objects;
create policy "logos_read" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos_write_own" on storage.objects;
create policy "logos_write_own" on storage.objects
  for insert with check (
    bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "logos_update_own" on storage.objects;
create policy "logos_update_own" on storage.objects
  for update using (
    bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]
  );
