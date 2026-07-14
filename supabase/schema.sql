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
    ),
    'empleados', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.employees x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.role, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    ),
    'gastos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.expense_date desc), '[]'::jsonb) from (
        select * from public.expenses x
        where x.user_id = target_uid
          and ( unaccent(coalesce(x.description, '')) ilike (select p from pat)
             or unaccent(coalesce(x.category, '')) ilike (select p from pat)
             or unaccent(coalesce(x.supplier, '')) ilike (select p from pat) )
        order by x.expense_date desc limit per
      ) t
    ),
    'cuentas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.bank_accounts x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.bank, '')) ilike (select p from pat)
             or unaccent(coalesce(x.number, '')) ilike (select p from pat)
             or unaccent(coalesce(x.alias_cbu, '')) ilike (select p from pat)
             or unaccent(coalesce(x.holder, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    ),
    'tarjetas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from (
        select * from public.cards x
        where x.user_id = target_uid
          and ( unaccent(x.name) ilike (select p from pat)
             or unaccent(coalesce(x.bank, '')) ilike (select p from pat)
             or unaccent(coalesce(x.last4, '')) ilike (select p from pat) )
        order by x.name limit per
      ) t
    )
  );
$$;

grant execute on function public.global_search(uuid, text, int) to authenticated;

-- =====================================================================
-- 18) Ingreso con TARJETA + GASTOS (egresos)
--     Distinción clave: en el INGRESO, method='tarjeta' es cómo te pagó el
--     cliente (card_type débito/crédito; account = terminal/cuenta destino).
--     En el GASTO, source es de DÓNDE sale la plata (efectivo / cuenta / tarjeta
--     de la empresa). Son conceptos separados y viven en tablas distintas.
-- =====================================================================

-- (a) Ingreso con tarjeta: sub-tipo débito/crédito en payments.
--     El destino (terminal/cuenta) sigue en payments.account, igual que transferencia.
alter table public.payments add column if not exists card_type text;   -- 'debito' | 'credito'

-- (b) Gastos: tabla separada (un gasto NUNCA es facturación/ingreso).
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric not null,
  category     text not null,
  -- de DÓNDE sale la plata: 'efectivo' | 'cuenta_bancaria' | 'tarjeta_empresa'
  source       text not null,
  account      text,           -- si source es cuenta_bancaria o tarjeta_empresa: cuál
  description  text,
  supplier     text,
  expense_date date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists expenses_idx on public.expenses(user_id, expense_date desc);

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

-- Modo soporte: el admin ve/edita los gastos del cliente (igual que el resto).
drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_all" on public.expenses
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());

grant select, insert, update, delete on public.expenses to anon, authenticated;

-- =====================================================================
-- 19) Tarjetas de la empresa (débito / crédito)
--     Se usan para clasificar gastos (expenses.source='tarjeta_empresa')
--     y para avisar cuándo cierra/vence una tarjeta de crédito.
-- =====================================================================
create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,           -- nombre/alias de la tarjeta (lo que se elige)
  bank         text,
  type         text not null,           -- 'credito' | 'debito'
  last4        text,                    -- últimos 4 dígitos (nunca el número completo)
  closing_day  int,                     -- 1-31, sólo crédito
  due_day      int,                     -- 1-31, sólo crédito
  created_at   timestamptz not null default now()
);

create index if not exists cards_user_idx on public.cards(user_id);

alter table public.cards enable row level security;

drop policy if exists "cards_select_own" on public.cards;
create policy "cards_select_own" on public.cards
  for select using (auth.uid() = user_id);

drop policy if exists "cards_insert_own" on public.cards;
create policy "cards_insert_own" on public.cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on public.cards;
create policy "cards_update_own" on public.cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on public.cards;
create policy "cards_delete_own" on public.cards
  for delete using (auth.uid() = user_id);

-- Modo soporte: el admin ve/edita las tarjetas del cliente (igual que el resto).
drop policy if exists "cards_admin_all" on public.cards;
create policy "cards_admin_all" on public.cards
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());

grant select, insert, update, delete on public.cards to anon, authenticated;

-- =====================================================================
-- 20) Últimos 4 dígitos de la tarjeta (migración: si la tabla cards ya
--     existía sin esta columna, este ALTER la agrega sin tocar filas).
-- =====================================================================
alter table public.cards add column if not exists last4 text;

-- =====================================================================
-- 21) CAPACIDAD Y EQUIPO — turnos con empleados/recursos
--     Hasta acá la agenda asumía 1 turno por horario. Esto suma:
--       • empleados/recursos nombrados (Raúl, la dermatóloga, un sillón…)
--       • la relación empleado↔servicio (quién hace qué): la columna vertebral
--       • horarios y servicios propios por empleado, con ATAJOS para el dueño
--         que no necesita esa complejidad ("todos hacen todo", "mismo horario")
--       • configuración del modo de agenda (capacidad simple vs equipo)
--     TODO es aditivo: columnas nullables / con default. Los turnos ya
--     cargados quedan employee_id = NULL (sin asignar) y no se pierde nada.
--     Sección autocontenida (crea sus propias policies own + admin) para
--     poder correrse sola sin depender del bloque admin de la sección 16.
-- =====================================================================

-- (a) Modo de agenda a nivel negocio. Default = comportamiento de siempre:
--     capacidad simple = 1 turno por horario, sin empleados.
--       mode:       'simple' (capacidad sin nombres) | 'staff' (empleados)
--       capacity:   modo simple, cuántos turnos por horario
--       assignment: modo staff, quién elige → 'client' | 'auto' | 'unassigned'
alter table public.business_profiles
  add column if not exists agenda_config jsonb not null
  default '{"mode":"simple","capacity":1,"assignment":"unassigned"}'::jsonb;

-- (b) Empleados / recursos nombrados
create table if not exists public.employees (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  role                text,                          -- ej "Peluquero", "Dermatóloga" (opcional)
  color               text,                          -- color en la agenda (opcional)
  -- Horarios propios del empleado, mismo shape jsonb que business_hours.
  -- Con uses_business_hours = true se ignora y se usan los horarios del negocio.
  schedule            jsonb not null default '{}'::jsonb,
  uses_business_hours boolean not null default true, -- ATAJO: "mismo horario que el negocio"
  does_all_services   boolean not null default true, -- ATAJO: "hace todos los servicios"
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists employees_user_idx on public.employees(user_id);

alter table public.employees enable row level security;

drop policy if exists "employees_select_own" on public.employees;
create policy "employees_select_own" on public.employees
  for select using (auth.uid() = user_id);

drop policy if exists "employees_insert_own" on public.employees;
create policy "employees_insert_own" on public.employees
  for insert with check (auth.uid() = user_id);

drop policy if exists "employees_update_own" on public.employees;
create policy "employees_update_own" on public.employees
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "employees_delete_own" on public.employees;
create policy "employees_delete_own" on public.employees
  for delete using (auth.uid() = user_id);

-- Modo soporte: el admin ve/edita los empleados del cliente (igual que el resto).
drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all" on public.employees
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());

grant select, insert, update, delete on public.employees to anon, authenticated;

-- (c) Relación empleado↔servicio (N:M) — LA COLUMNA VERTEBRAL.
--     Define qué servicios hace cada empleado. Si does_all_services = true en
--     el empleado, esta tabla se ignora para ese empleado (hace todo).
create table if not exists public.employee_services (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  service_id  uuid not null references public.services(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  unique (employee_id, service_id)
);

create index if not exists employee_services_user_idx     on public.employee_services(user_id);
create index if not exists employee_services_employee_idx on public.employee_services(employee_id);
create index if not exists employee_services_service_idx  on public.employee_services(service_id);

alter table public.employee_services enable row level security;

drop policy if exists "employee_services_select_own" on public.employee_services;
create policy "employee_services_select_own" on public.employee_services
  for select using (auth.uid() = user_id);

drop policy if exists "employee_services_insert_own" on public.employee_services;
create policy "employee_services_insert_own" on public.employee_services
  for insert with check (auth.uid() = user_id);

drop policy if exists "employee_services_update_own" on public.employee_services;
create policy "employee_services_update_own" on public.employee_services
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "employee_services_delete_own" on public.employee_services;
create policy "employee_services_delete_own" on public.employee_services
  for delete using (auth.uid() = user_id);

-- Modo soporte: el admin ve/edita la relación del cliente.
drop policy if exists "employee_services_admin_all" on public.employee_services;
create policy "employee_services_admin_all" on public.employee_services
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());

grant select, insert, update, delete on public.employee_services to anon, authenticated;

-- (d) Turnos: quién atiende y qué servicio (ambos opcionales, no rompen nada).
--     employee_id NULL = "sin asignar" (turnos viejos y modo sin asignar).
--     on delete set null: borrar un empleado NO borra sus turnos, quedan sin asignar.
--     service_id refuerza el match empleado↔servicio; se mantiene service_name (texto) por compat.
alter table public.appointments
  add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.appointments
  add column if not exists service_id  uuid references public.services(id)  on delete set null;

create index if not exists appointments_employee_idx on public.appointments(user_id, employee_id);

-- =====================================================================
-- 22) DISPONIBILIDAD PARA EL AGENTE (la IA) — RPCs de Postgres
--     Replican en la base la misma lógica de src/lib/availability.ts para
--     que el cerebro pueda responder server-side "¿hay turno mañana 3pm con
--     Raúl para corte?" sin sobrevender ni ofrecer a alguien que no hace ese
--     servicio o no trabaja ese día. security invoker => respeta RLS; reciben
--     target_uid (= dueño del negocio) igual que global_search.
--     El backend del agente debe llamarlas con el service role (o el token del
--     cliente); anon sin sesión no pasa RLS y no obtiene datos útiles.
-- =====================================================================

-- Helpers chicos (inmutables): minutos ↔ 'HH:MM' y clave de día.
create or replace function public._mins(t text) returns int
  language sql immutable as $$
    select coalesce(split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int, 0)
  $$;

create or replace function public._hhmm(m int) returns text
  language sql immutable as $$
    select lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0')
  $$;

create or replace function public._day_key(d date) returns text
  language sql immutable as $$
    select case extract(dow from d)::int
      when 0 then 'domingo' when 1 then 'lunes'   when 2 then 'martes'
      when 3 then 'miercoles' when 4 then 'jueves' when 5 then 'viernes'
      when 6 then 'sabado' end
  $$;

-- ¿El turno (start, dur) entra completo en algún turno abierto del día?
-- Contempla el turno cortado (from2/to2 cuando split = true).
create or replace function public._fits_hours(h jsonb, start_min int, dur int) returns boolean
  language sql immutable as $$
    select case
      when h is null or coalesce((h->>'open')::boolean, false) = false then false
      else (
        (start_min >= public._mins(h->>'from') and start_min + dur <= public._mins(h->>'to'))
        or (
          coalesce((h->>'split')::boolean, false)
          and h->>'from2' is not null and h->>'to2' is not null
          and start_min >= public._mins(h->>'from2') and start_min + dur <= public._mins(h->>'to2')
        )
      )
    end
  $$;

grant execute on function public._mins(text)            to anon, authenticated;
grant execute on function public._hhmm(int)             to anon, authenticated;
grant execute on function public._day_key(date)         to anon, authenticated;
grant execute on function public._fits_hours(jsonb, int, int) to anon, authenticated;

-- ── ¿Hay lugar para un turno puntual? ──
-- Modo capacidad: dentro del horario y con cupo libre.
-- Modo empleado: al menos una persona que HACE el servicio, trabaja esa hora y está libre.
create or replace function public.check_availability(
  target_uid    uuid,
  p_date        date,
  p_time        text,           -- 'HH:MM'
  p_service_id  uuid default null,
  p_duration_min int default null,
  p_employee_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  bh jsonb; cfg jsonb;
  dur int; start_min int; daykey text;
  mode text; cap int; taken int; within_hours boolean;
  v_allow boolean;
  free_emps jsonb; cand_total int;
begin
  select business_hours, agenda_config into bh, cfg
  from public.business_profiles where user_id = target_uid;

  cfg := coalesce(cfg, '{"mode":"simple","capacity":1,"assignment":"unassigned"}'::jsonb);
  mode := coalesce(cfg->>'mode', 'simple');
  cap := coalesce((cfg->>'capacity')::int, 1);
  v_allow := coalesce((cfg->>'allow_overlap')::boolean, false);
  start_min := public._mins(p_time);
  daykey := public._day_key(p_date);
  dur := coalesce(p_duration_min,
                  (select duration_min from public.services where id = p_service_id and user_id = target_uid),
                  30);

  if mode <> 'staff' then
    within_hours := public._fits_hours(bh->daykey, start_min, dur);
    select count(*) into taken from public.appointments a
      where a.user_id = target_uid and a.appt_date = p_date
        and start_min < public._mins(a.appt_time) + coalesce(a.duration_min, 30)
        and public._mins(a.appt_time) < start_min + dur;
    return jsonb_build_object(
      'mode', 'simple',
      'available', within_hours and taken < cap,
      'within_hours', within_hours,
      'capacity', cap, 'taken', taken, 'remaining', greatest(cap - taken, 0)
    );
  end if;

  -- modo por empleado
  with cand as (
    select e.* from public.employees e
    where e.user_id = target_uid and e.active
      and (p_employee_id is null or e.id = p_employee_id)
      and (
        e.does_all_services
        or (p_service_id is not null and exists (
          select 1 from public.employee_services es
          where es.employee_id = e.id and es.service_id = p_service_id))
      )
  ),
  evaluated as (
    select c.id, c.name,
      public._fits_hours(case when c.uses_business_hours then bh->daykey else c.schedule->daykey end, start_min, dur) as works,
      not exists (
        select 1 from public.appointments a
        where a.user_id = target_uid and a.employee_id = c.id and a.appt_date = p_date
          and start_min < public._mins(a.appt_time) + coalesce(a.duration_min, 30)
          and public._mins(a.appt_time) < start_min + dur
      ) as not_busy
    from cand c
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)) filter (where works and (not_busy or v_allow)), '[]'::jsonb),
    count(*)
  into free_emps, cand_total
  from evaluated;

  return jsonb_build_object(
    'mode', 'staff',
    'assignment', coalesce(cfg->>'assignment', 'unassigned'),
    'available', jsonb_array_length(free_emps) > 0,
    'free_employees', free_emps,
    'candidates_total', cand_total
  );
end;
$fn$;

grant execute on function public.check_availability(uuid, date, text, uuid, int, uuid) to anon, authenticated;

-- ── Horarios libres de un día para un servicio (para proponer opciones) ──
-- Recorre los turnos abiertos del día en pasos de p_step_min y devuelve los
-- horarios donde check_availability da disponible.
create or replace function public.agenda_free_slots(
  target_uid    uuid,
  p_date        date,
  p_service_id  uuid default null,
  p_duration_min int default null,
  p_step_min    int default 30,
  p_employee_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  bh jsonb; h jsonb; dur int; daykey text;
  a int; b int; t int;
  chk jsonb; slots jsonb := '[]'::jsonb;
begin
  select business_hours into bh from public.business_profiles where user_id = target_uid;
  daykey := public._day_key(p_date);
  h := bh->daykey;
  dur := coalesce(p_duration_min,
                  (select duration_min from public.services where id = p_service_id and user_id = target_uid),
                  30);

  if h is null or coalesce((h->>'open')::boolean, false) = false then
    return jsonb_build_object('date', p_date, 'duration_min', dur, 'slots', '[]'::jsonb);
  end if;

  for a, b in
    select public._mins(h->>'from'), public._mins(h->>'to')
    union all
    select public._mins(h->>'from2'), public._mins(h->>'to2')
    where coalesce((h->>'split')::boolean, false) and h->>'from2' is not null and h->>'to2' is not null
  loop
    t := a;
    while t + dur <= b loop
      chk := public.check_availability(target_uid, p_date, public._hhmm(t), p_service_id, dur, p_employee_id);
      if (chk->>'available')::boolean then
        slots := slots || jsonb_build_object('time', public._hhmm(t), 'free_employees', coalesce(chk->'free_employees', '[]'::jsonb));
      end if;
      t := t + p_step_min;
    end loop;
  end loop;

  return jsonb_build_object('date', p_date, 'duration_min', dur, 'slots', slots);
end;
$fn$;

grant execute on function public.agenda_free_slots(uuid, date, uuid, int, int, uuid) to anon, authenticated;

-- =====================================================================
-- 23) RENTABILIDAD POR EMPLEADO — gasto atribuible a una persona
--     Un gasto puede ser general del negocio (employee_id NULL) o atribuido
--     a un empleado puntual (sueldo, comisión, herramienta suya, etc.).
--     La CATEGORÍA (Sueldos, etc.) sigue igual: el empleado es una dimensión
--     aparte, opcional, que NO reemplaza la categoría.
--     Aditivo y nullable: los gastos existentes quedan como generales.
-- =====================================================================
alter table public.expenses
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create index if not exists expenses_employee_idx on public.expenses(user_id, employee_id);

-- =====================================================================
-- 24) PAGOS PENDIENTES DE CONFIRMACIÓN
--     Cuando un cliente manda un comprobante de transferencia, el pago se
--     registra pero NO cuenta como ingreso hasta que el dueño verifica en su
--     banco que la plata realmente entró.
--       verified      = TRUE por defecto (todos los pagos existentes siguen
--                        contando como ingreso, igual que hoy). FALSE = pendiente.
--       verified_at   = cuándo se confirmó (null mientras esté pendiente).
--       proof_url     = comprobante subido (a futuro lo cargará el agente de IA).
--     Además vinculamos el pago con el turno que lo originó (appointment_id),
--     así el estado del turno en la Agenda refleja si el pago está confirmado:
--       turno con pago pendiente -> "Pago pendiente de confirmación" (ámbar)
--       turno con pago verificado -> "Pagado" (verde).
--     Todo es aditivo y nullable: no rompe pagos ni turnos existentes.
-- =====================================================================
alter table public.payments
  add column if not exists verified    boolean not null default true;
alter table public.payments
  add column if not exists verified_at timestamptz;
alter table public.payments
  add column if not exists proof_url   text;
alter table public.payments
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

-- Para listar rápido los pendientes de un negocio.
create index if not exists payments_pending_idx on public.payments(user_id, verified);
-- Para cruzar un turno con su pago.
create index if not exists payments_appointment_idx on public.payments(appointment_id);
