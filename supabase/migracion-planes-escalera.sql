-- ============================================================================
-- MIGRACIÓN: escalera de planes 3 → 4 (Entrada · Medio · Pro · Pro+)
-- Fecha: 14/07/2026
--
-- ⚠️ NO EJECUTADO POR CLAUDE. Revisalo y corrélo vos en el SQL Editor de Supabase.
--
-- Qué hace:
--   1) Renombra los planes existentes según el mapeo confirmado.
--   2) Agrega el plan nuevo Pro+ (si no existe todavía).
--
-- Mapeo confirmado (ningún cliente pierde funciones):
--   Básico   → Entrada
--   Estándar → Medio
--   Pro      → Pro     (se mantiene, no se toca)
--   (nuevo)  → Pro+
--
-- IMPORTANTE sobre los datos de clientes:
--   Este script NO reasigna a ningún cliente. Cada cliente conserva su `plan_id`;
--   lo único que cambia es el NOMBRE de la fila del plan al que ya apunta. O sea:
--   un cliente que estaba en "Básico" queda automáticamente en "Entrada" sin que
--   toquemos la tabla `clients`. Eso es exactamente el mapeo confirmado.
--
-- Es idempotente: se puede correr más de una vez sin duplicar ni romper nada.
-- ============================================================================

begin;

-- 1) Renombrar los planes existentes ────────────────────────────────────────
-- Se matchea de forma tolerante (con y sin acento) por si el nombre guardado
-- tiene o no tilde. Si ya están renombrados, estos UPDATE no hacen nada.

update public.plans
   set name = 'Entrada'
 where lower(name) in ('básico', 'basico');

update public.plans
   set name = 'Medio'
 where lower(name) in ('estándar', 'estandar', 'standard');

-- "Pro" se mantiene igual: no se toca a propósito.

-- 2) Agregar el plan nuevo Pro+ ──────────────────────────────────────────────
-- price_ars va en 0 porque el precio TODAVÍA NO está definido (no inventamos
-- precios). En el panel se muestra como "Consultar" mientras siga en 0/sin
-- definir; cuando tengas el precio real, editalo desde el Admin → Control de
-- planes, o con un simple:  update public.plans set price_ars = <valor> where name = 'Pro+';

insert into public.plans (name, price_ars, description)
select 'Pro+', 0, 'Multi-idioma, reportes avanzados y líneas de WhatsApp extra'
where not exists (
  select 1 from public.plans
   where lower(name) in ('pro+', 'pro plus', 'proplus', 'pro +')
);

commit;

-- ── Verificación (opcional): mirá cómo quedaron los planes y quién tiene qué ──
-- select id, name, price_ars from public.plans order by price_ars;
-- select c.business_name, p.name as plan
--   from public.clients c
--   left join public.plans p on p.id = c.plan_id
--  order by p.price_ars nulls last;
