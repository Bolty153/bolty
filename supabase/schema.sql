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
alter table public.business_profiles add column if not exists plan text not null default 'basico';

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

-- =====================================================================
-- 12) Pedidos de cambio de plan (el cliente pide, el admin los ve)
-- =====================================================================
create table if not exists public.plan_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  business_name  text,
  current_plan   text,
  requested_plan text not null,
  status         text not null default 'pendiente',   -- pendiente | hecho | rechazado
  created_at     timestamptz not null default now()
);

create index if not exists plan_requests_status_idx on public.plan_requests(status, created_at);

alter table public.plan_requests enable row level security;

-- El cliente crea y ve sus propios pedidos; el admin ve y actualiza todos.
drop policy if exists "plan_requests_insert_own" on public.plan_requests;
create policy "plan_requests_insert_own" on public.plan_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "plan_requests_select_own_or_admin" on public.plan_requests;
create policy "plan_requests_select_own_or_admin" on public.plan_requests
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "plan_requests_update_admin" on public.plan_requests;
create policy "plan_requests_update_admin" on public.plan_requests
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

grant select, insert, update, delete on public.plan_requests to anon, authenticated;

-- =====================================================================
-- 13) Soporte: fallas, sugerencias y pedidos de servicio a medida
-- =====================================================================
create table if not exists public.support_tickets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  business_name  text,
  phone          text,
  type           text not null,                       -- falla | sugerencia | medida
  title          text,
  description    text not null,
  screenshot_url text,
  status         text not null default 'pendiente',   -- pendiente | resuelto
  created_at     timestamptz not null default now()
);

alter table public.support_tickets add column if not exists phone text;

create index if not exists support_tickets_idx on public.support_tickets(type, status, created_at);

alter table public.support_tickets enable row level security;

drop policy if exists "support_insert_own" on public.support_tickets;
create policy "support_insert_own" on public.support_tickets
  for insert with check (auth.uid() = user_id);

drop policy if exists "support_select_own_or_admin" on public.support_tickets;
create policy "support_select_own_or_admin" on public.support_tickets
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "support_update_admin" on public.support_tickets;
create policy "support_update_admin" on public.support_tickets
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

grant select, insert, update, delete on public.support_tickets to anon, authenticated;

-- Bucket de capturas de soporte (path: {uid}/archivo.ext)
insert into storage.buckets (id, name, public)
values ('soporte', 'soporte', true)
on conflict (id) do nothing;

drop policy if exists "soporte_read" on storage.objects;
create policy "soporte_read" on storage.objects
  for select using (bucket_id = 'soporte');

drop policy if exists "soporte_write_own" on storage.objects;
create policy "soporte_write_own" on storage.objects
  for insert with check (
    bucket_id = 'soporte' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- 14) Contraseña provisoria: el cliente debe cambiarla al primer ingreso
-- =====================================================================
alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- Función segura: apaga must_change_password SÓLO para el usuario que la llama.
-- Así el cliente puede finalizar el cambio sin tener permiso para editar su
-- fila de profiles directamente (no puede tocar is_admin / is_active).
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;

-- =====================================================================
-- 15) Acceso al dashboard del cliente con permiso (modo soporte)
--     El admin PIDE acceso; el cliente lo acepta/rechaza y puede cortarlo.
--     Consentimiento + transparencia + registro (no es un sandbox de
--     seguridad: el admin ya puede leer por su rol, esto es el flujo de
--     permiso y auditoría). Acceso de única vez: cada vez, nueva fila.
-- =====================================================================
create table if not exists public.support_access_requests (
  id                uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references auth.users(id) on delete cascade,  -- a quién se accede
  admin_id          uuid not null references auth.users(id) on delete cascade,  -- quién pide
  -- pending → active (aceptó) / denied (rechazó)
  -- active  → revoked (cliente cortó) / expired (30 min) / ended (admin salió)
  status            text not null default 'pending',
  reason            text,
  duration_min      int not null default 30,   -- cuánto dura el acceso (lo elige el admin)
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  expires_at        timestamptz,   -- se setea al aceptar: responded_at + duration_min
  ended_at          timestamptz
);

-- Idempotente para bases que ya crearon la tabla sin la columna.
alter table public.support_access_requests add column if not exists duration_min int not null default 30;

create index if not exists sar_client_idx on public.support_access_requests(client_profile_id, status, created_at desc);
create index if not exists sar_admin_idx  on public.support_access_requests(admin_id, status, created_at desc);

alter table public.support_access_requests enable row level security;

-- Realtime necesita la fila completa para evaluar RLS y mandar el payload.
alter table public.support_access_requests replica identity full;

-- El admin crea la solicitud (y sólo a nombre propio).
drop policy if exists "sar_insert_admin" on public.support_access_requests;
create policy "sar_insert_admin" on public.support_access_requests
  for insert with check (
    admin_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- La ve el cliente dueño o cualquier admin.
drop policy if exists "sar_select_own_or_admin" on public.support_access_requests;
create policy "sar_select_own_or_admin" on public.support_access_requests
  for select using (
    client_profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- El cliente actualiza SÓLO las suyas (aceptar / rechazar / cortar).
drop policy if exists "sar_update_client" on public.support_access_requests;
create policy "sar_update_client" on public.support_access_requests
  for update using (client_profile_id = auth.uid())
  with check (client_profile_id = auth.uid());

-- El admin actualiza (salir / expirar / cancelar la espera).
drop policy if exists "sar_update_admin" on public.support_access_requests;
create policy "sar_update_admin" on public.support_access_requests
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

grant select, insert, update, delete on public.support_access_requests to anon, authenticated;

-- Sumar la tabla a la publicación de Realtime (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_access_requests'
  ) then
    alter publication supabase_realtime add table public.support_access_requests;
  end if;
end $$;

-- =====================================================================
-- 16) Acceso del admin a los datos del cliente (necesario para el modo
--     soporte: ver y MODIFICAR el panel real del cliente).
--     El consentimiento y la auditoría los maneja la app (support_access_requests);
--     a nivel base, el admin tiene acceso completo a los datos de negocio.
-- =====================================================================

-- Helper: ¿el usuario actual es admin? (security definer para poder leer profiles)
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin);
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- Una política "for all" por tabla: se SUMA (OR) a las políticas del cliente,
-- así el cliente sigue viendo sólo lo suyo y el admin ve/edita todo.
do $$
declare t text;
begin
  foreach t in array array[
    'business_profiles', 'agent_configs', 'products', 'services',
    'appointments', 'customers', 'payments', 'bank_accounts'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_current_user_admin()) with check (public.is_current_user_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- Storage: el admin puede leer/subir/actualizar/borrar archivos de cualquier
-- cliente en los buckets del negocio (fotos de productos, logos, etc.).
drop policy if exists "buckets_admin_all" on storage.objects;
create policy "buckets_admin_all" on storage.objects
  for all using (
    bucket_id in ('logos', 'productos', 'remitos', 'servicios', 'soporte')
    and public.is_current_user_admin()
  ) with check (
    bucket_id in ('logos', 'productos', 'remitos', 'servicios', 'soporte')
    and public.is_current_user_admin()
  );

-- =====================================================================
-- 17) Buscador global insensible a acentos y mayúsculas
--     Usa unaccent() en ambos lados del ilike. Una sola función (RPC) que
--     devuelve los 5 grupos ya armados. security invoker => respeta RLS.
--     Recibe target_uid para funcionar también en modo soporte (el admin
--     busca sobre los datos del cliente; RLS admin-all lo habilita).
-- =====================================================================
create extension if not exists unaccent with schema extensions;

create or replace function public.global_search(target_uid uuid, q text, per int default 5)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with pat as (select '%' || unaccent(coalesce(q, '')) || '%' as p)
  select jsonb_build_object(
    'productos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.products x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.barcode, '')) ilike (select p from pat)
             or unaccent(coalesce(x.category, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    ),
    'servicios', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.services x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.category, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    ),
    'clientes', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.customers x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.phone, '')) ilike (select p from pat)
             or unaccent(coalesce(x.doc_id, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    ),
    'turnos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.appt_date desc), '[]'::jsonb) from (
        select * from public.appointments x
        where x.user_id = target_uid
          and ( unaccent(x.customer_name) ilike (select p from pat)
             or unaccent(coalesce(x.service_name, '')) ilike (select p from pat)
             or unaccent(coalesce(x.phone, '')) ilike (select p from pat) )
        order by x.appt_date desc limit per
      ) t
    ),
    'pagos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.pay_date desc), '[]'::jsonb) from (
        select * from public.payments x
        where x.user_id = target_uid
          and ( unaccent(coalesce(x.customer_name, '')) ilike (select p from pat)
             or unaccent(coalesce(x.description, '')) ilike (select p from pat)
             or unaccent(coalesce(x.account, '')) ilike (select p from pat) )
        order by x.pay_date desc limit per
      ) t
    )
  );
$$;

grant execute on function public.global_search(uuid, text, int) to authenticated;
