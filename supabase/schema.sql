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

-- =====================================================================
-- 5) Inventario de productos
-- =====================================================================
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  price       numeric(12,2) not null default 0,
  stock       integer not null default 0,
  category    text,
  description text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Código de barras opcional (para negocios que usan lector)
alter table public.products add column if not exists barcode text;

create index if not exists products_user_id_idx on public.products(user_id);
create index if not exists products_barcode_idx on public.products(user_id, barcode);

-- RLS: cada cliente sólo ve y toca SUS productos
alter table public.products enable row level security;

drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select using (auth.uid() = user_id);

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert with check (auth.uid() = user_id);

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.products to anon, authenticated;

-- Bucket de fotos de productos (path: {uid}/archivo.ext)
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "productos_read" on storage.objects;
create policy "productos_read" on storage.objects
  for select using (bucket_id = 'productos');

drop policy if exists "productos_write_own" on storage.objects;
create policy "productos_write_own" on storage.objects
  for insert with check (
    bucket_id = 'productos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "productos_update_own" on storage.objects;
create policy "productos_update_own" on storage.objects
  for update using (
    bucket_id = 'productos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "productos_delete_own" on storage.objects;
create policy "productos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'productos' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- 6) Bucket de remitos (comprobantes de mercadería que llega)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('remitos', 'remitos', true)
on conflict (id) do nothing;

drop policy if exists "remitos_read" on storage.objects;
create policy "remitos_read" on storage.objects
  for select using (bucket_id = 'remitos');

drop policy if exists "remitos_write_own" on storage.objects;
create policy "remitos_write_own" on storage.objects
  for insert with check (
    bucket_id = 'remitos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "remitos_delete_own" on storage.objects;
create policy "remitos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'remitos' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- 7) Servicios (peluquerías, consultorios, talleres, estudios)
--    No tienen stock. El precio puede ser un número o "a consultar".
-- =====================================================================
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  price            numeric(12,2) not null default 0,
  price_on_request boolean not null default false,
  duration_min     integer,
  category         text,
  description      text,
  image_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists services_user_id_idx on public.services(user_id);

alter table public.services enable row level security;

drop policy if exists "services_select_own" on public.services;
create policy "services_select_own" on public.services
  for select using (auth.uid() = user_id);

drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own" on public.services
  for insert with check (auth.uid() = user_id);

drop policy if exists "services_update_own" on public.services;
create policy "services_update_own" on public.services
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "services_delete_own" on public.services;
create policy "services_delete_own" on public.services
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.services to anon, authenticated;

-- Bucket de fotos de servicios
insert into storage.buckets (id, name, public)
values ('servicios', 'servicios', true)
on conflict (id) do nothing;

drop policy if exists "servicios_read" on storage.objects;
create policy "servicios_read" on storage.objects
  for select using (bucket_id = 'servicios');

drop policy if exists "servicios_write_own" on storage.objects;
create policy "servicios_write_own" on storage.objects
  for insert with check (
    bucket_id = 'servicios' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "servicios_update_own" on storage.objects;
create policy "servicios_update_own" on storage.objects
  for update using (
    bucket_id = 'servicios' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "servicios_delete_own" on storage.objects;
create policy "servicios_delete_own" on storage.objects
  for delete using (
    bucket_id = 'servicios' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- 8) Agenda / turnos
-- =====================================================================
create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  service_name  text,
  appt_date     date not null,
  appt_time     text not null,         -- 'HH:MM'
  duration_min  integer,
  price         numeric(12,2),
  phone         text,
  notes         text,
  status        text not null default 'confirmado',
  source        text not null default 'manual',   -- manual | whatsapp | instagram | web
  paid          boolean not null default false,    -- turno ya cobrado
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- paid por si la tabla ya existía
alter table public.appointments add column if not exists paid boolean not null default false;

-- price por si la tabla ya existía de antes (seguro)
alter table public.appointments add column if not exists price numeric(12,2);

create index if not exists appointments_user_date_idx on public.appointments(user_id, appt_date);

alter table public.appointments enable row level security;

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments
  for select using (auth.uid() = user_id);

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments
  for insert with check (auth.uid() = user_id);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own" on public.appointments
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.appointments to anon, authenticated;

-- =====================================================================
-- 9) Clientes (memoria de clientes del negocio)
-- =====================================================================
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  doc_id     text,          -- DNI / CUIT
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_user_id_idx on public.customers(user_id);

alter table public.customers enable row level security;

drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select using (auth.uid() = user_id);

drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own" on public.customers
  for insert with check (auth.uid() = user_id);

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "customers_delete_own" on public.customers;
create policy "customers_delete_own" on public.customers
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.customers to anon, authenticated;

-- =====================================================================
-- 10) Finanzas (pagos de servicios + ventas de productos + ventas manuales)
-- =====================================================================
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'manual',   -- servicio | producto | manual
  customer_name text,                              -- cliente que pagó (opcional)
  description text,
  amount      numeric(12,2) not null default 0,   -- total final cobrado
  method      text not null default 'efectivo',   -- efectivo | transferencia
  account     text,                               -- cuenta destino si es transferencia
  adjustment  numeric(12,2) not null default 0,   -- + recargo / - descuento (en $)
  items       jsonb,                              -- detalle de productos vendidos (opcional)
  pay_date    date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Por si ya existía una tabla payments sin estas columnas (agrega lo que falte)
alter table public.payments add column if not exists user_id     uuid references auth.users(id) on delete cascade;
alter table public.payments add column if not exists kind          text not null default 'manual';
alter table public.payments add column if not exists customer_name text;
alter table public.payments add column if not exists description text;
alter table public.payments add column if not exists amount      numeric(12,2) not null default 0;
alter table public.payments add column if not exists method      text not null default 'efectivo';
alter table public.payments add column if not exists account     text;
alter table public.payments add column if not exists adjustment  numeric(12,2) not null default 0;
alter table public.payments add column if not exists items       jsonb;
alter table public.payments add column if not exists pay_date    date not null default current_date;
alter table public.payments add column if not exists created_at  timestamptz not null default now();

create index if not exists payments_user_date_idx on public.payments(user_id, pay_date);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments
  for insert with check (auth.uid() = user_id);

drop policy if exists "payments_update_own" on public.payments;
create policy "payments_update_own" on public.payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payments_delete_own" on public.payments;
create policy "payments_delete_own" on public.payments
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.payments to anon, authenticated;

-- =====================================================================
-- 11) Cuentas bancarias guardadas (para transferencias)
-- =====================================================================
create table if not exists public.bank_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,     -- nombre/alias de la cuenta (lo que se elige)
  bank       text,
  number     text,
  alias_cbu  text,
  holder     text,
  created_at timestamptz not null default now()
);

create index if not exists bank_accounts_user_idx on public.bank_accounts(user_id);

alter table public.bank_accounts enable row level security;

drop policy if exists "bank_accounts_select_own" on public.bank_accounts;
create policy "bank_accounts_select_own" on public.bank_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "bank_accounts_insert_own" on public.bank_accounts;
create policy "bank_accounts_insert_own" on public.bank_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "bank_accounts_update_own" on public.bank_accounts;
create policy "bank_accounts_update_own" on public.bank_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bank_accounts_delete_own" on public.bank_accounts;
create policy "bank_accounts_delete_own" on public.bank_accounts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.bank_accounts to anon, authenticated;
