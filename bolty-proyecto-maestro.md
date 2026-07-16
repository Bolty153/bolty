# BOLTY — Documento maestro del proyecto

**Business Online Live Technology For You**
*"Tecnología en vivo online, para tu negocio."*

> **Fuente de verdad ÚNICA.** Fusiona y reemplaza a `bolty-proyecto-maestro.md` (que se venía manteniendo) y a `bolty-resumen-maestro.md` (que traía la TANDA 2). Verificado contra el **código real** y el historial de commits.
>
> **Cómo usar este archivo:** al abrir un chat nuevo, subilo o pegalo y escribí *"Seguimos con Bolty. Acá está todo el proyecto. Leé y seguimos donde quedamos."*
>
> Última actualización: **16/07/2026** — **EL CEREBRO YA ARRANCÓ**: Edge Function `chat` desplegada, conexión a Claude Haiku 4.5 funcionando (capa 1), personalidad del agente leyendo datos reales del negocio + `agent_configs` (capa 3), y la **Bandeja Unificada** (inbox omnicanal) construida como cara del cerebro con chat web + agente automático + freno manual y conteo de tokens guardado (capa 2). Incorpora además de la TANDA 2 (escalera de planes, medición de tokens, doble visibilidad del consumo, regla de oro del límite), el **plan por capas de la bandeja** y el **problema del catálogo grande**. Verificado contra el código real y los commits.

---

## 0. Cómo trabajamos (instrucciones para Claude)

- El usuario es **no técnico**. Hay que guiarlo paso a paso, en **español argentino (voseo)**, explicando cualquier término técnico en simple, y celebrando los avances (lo motiva).
- **Flujo de trabajo:** el usuario cuenta ideas → se construye en Claude Code (app de Claude → botón "Code" → modo Local + carpeta bolty) → el usuario prueba en el navegador y manda fotos.
- **Honestidad ante todo:** el usuario valora la verdad y que las cosas se hagan **bien y completas, no a medias** (textual: *"ACÁ SE HACEN LAS COSAS BIEN, NO A MEDIAS, A MENOS QUE YO LO DIGA"*). No ofrecerle conformarse con menos.
- Claude **lleva la hoja de ruta maestra** y le recuerda los pendientes (el usuario lo pidió explícito: *"vos tenés que acordarte y recordarme"*).
- **Seguridad:** nunca pegar contraseñas/claves en el chat. Frenar y avisar antes de cualquier acción destructiva (borrar, publicar, enviar) o antes de subir a GitHub — **no se sube solo, hay que pedirlo explícitamente**.
- Cuando se termina un bloque grande de trabajo y se sube a GitHub, conviene abrir una **sesión nueva** (rinde mejor, arranca liviana).
- Server de desarrollo: `npm run dev` → `localhost:5173` (a veces cambia de puerto si el 5173 está ocupado).
- **Cambios de base de datos:** cuando una función guarda algo nuevo, hay que **correr el SQL en Supabase** (SQL Editor → Run) una vez. El código en GitHub/Vercel no crea las tablas solo.

---

## 1. Qué es Bolty

Bolty (**B**usiness **O**nline **L**ive **T**echnology For **Y**ou) es una plataforma web **SaaS multi-tenant**. Empezó como "un empleado virtual con IA que atiende por WhatsApp", pero hoy **es más que eso: es un sistema de gestión con IA adentro** (inventario, agenda con empleados y disponibilidad real, finanzas con gastos y tarjetas, rentabilidad por empleado, búsqueda global, pagos pendientes) al que se le suma un agente que atiende clientes por WhatsApp, Instagram, chat web y mail. Ese cambio de posicionamiento importa para los precios (ver sección 4.1).

El agente (**el cerebro ya está arrancado** — ver secciones 3.10 y 6.1):
- **Ya responde con IA real** (Claude Haiku 4.5, no respuestas fijas/guionadas), con la personalidad de *ese* negocio: sus datos, sus productos/servicios con precios, sus horarios y el tono configurado en "Mi agente". Se prueba desde la **Bandeja Unificada** (chat web propio, sin WhatsApp, sin riesgo).
- (Próxima capa — "las manos") consultará el **stock en tiempo real** y la **disponibilidad de turnos** con *tools* en vez de tener todo el catálogo metido en el prompt (ver "problema del catálogo grande", 6.1).
- **Agenda turnos** para negocios de servicios (sabiendo qué empleado hace qué servicio y a qué hora está libre) — pendiente de conectar como tool.
- Responde en **varios idiomas**.
- (A futuro) entiende audios y lee fotos de productos y comprobantes.

**Mercado:** Argentina (pymes, comercios y empresas con sucursales). Cobro en pesos.

**El problema que resuelve:** los negocios pierden ventas por no poder responder a toda hora; contratar personal de atención es caro; la consulta más repetida ("¿tenés tal cosa?") se responde tarde o mal. WhatsApp es el canal de ventas principal en Argentina y no hay una herramienta accesible y simple para automatizarlo.

**Cómo se identifica cada negocio (clave de arquitectura):** cada negocio conecta su **propio número de WhatsApp**. El número es la llave de entrada: el sistema sabe de qué negocio es cada mensaje y usa su inventario, su configuración y su agente. Nunca se mezcla, ni entre dos sucursales del mismo dueño.

---

## 2. Marca e identidad visual (definida)

- **Nombre:** Bolty. Acrónimo Business Online Live Technology For You (iniciales B-O-L-T-Y resaltadas en negrita/oscuro, no violeta).
- **Logo:** letra **B** con un rayo verde menta integrado.
- **Tipografía:** Space Grotesk (títulos) + Inter (texto).
- **Colores:** violeta `#6029FF`, verde menta `#00C896`, tinta `#13111c`, fondo claro `#f7f6fb`.
- **Mascota Bolty:** robot con cerebro dividido violeta + verde menta, auriculares, rayo en el pecho, manitos abiertas. Imagen original generada con ChatGPT; animada como **video WebM con fondo transparente** (`public/bolty-animado.webm`), con imagen de respaldo/poster (`public/bolty-mascota.png`, esa sí con fondo — ver nota). Aparece con destello y bienvenida al entrar (una vez por sesión), después flota en la esquina inferior derecha con glow y reacciona al pasar el mouse. Visible en todo el dashboard y en la landing (solo esquina, sin bienvenida). **No aparece en mobile.**
  - **Nota técnica:** el PNG de respaldo tiene fondo real (no transparente) — en desktop no se nota porque casi siempre se ve el video; en mobile, donde el video con canal alfa no siempre se reproduce bien, se decidió directamente **ocultar la mascota** en vez de arreglar el PNG (más simple y sin riesgo).
  - **Pendiente:** que al tocar a Bolty se abra un **asistente virtual** dentro del panel (depende del cerebro/IA).

---

## 3. Lo que YA está construido (verificado contra el código, 14/07/2026)

### 3.1 Público / acceso
- **Landing de marketing** (`Landing.tsx`, pública): 11 secciones — hero, el problema, la solución, cómo funciona, funciones destacadas, para quién es, por qué Bolty, planes (precios en "—" todavía), FAQ, CTA, footer. Animaciones al scroll. Mascota en la esquina (oculta en mobile). **Responsive mobile completo.**
- **Login + control de acceso manual:** registro/login con email y contraseña (Supabase Auth). El acceso lo activa manualmente el administrador. Pantalla de "acceso no activo" si no fue habilitado. Recuperación de contraseña por email. Ojito para mostrar/ocultar contraseña.
- **Contraseña provisoria al crear cliente:** el admin genera o escribe una clave temporal; el cliente queda obligado a cambiarla en su primer ingreso (columna `must_change_password` en `profiles`, pantalla `ForcePasswordChange.tsx`).

### 3.2 Panel de administrador (el dueño de Bolty)
- **Clientes:** alta, activar/desactivar, suspender, editar (plan, estado, vencimiento, notas), resetear contraseña, "ver como cliente" (modo soporte).
- **Dinero / Métricas / Control:** secciones de seguimiento del negocio Bolty (KPIs, gráficos, export CSV, log de actividad).
- **Pedidos de cambio de plan:** el admin ve los pedidos de los clientes y aprueba el cambio real de plan.
- **Soporte:** bandeja con pestañas (fallas / sugerencias / servicio a medida), estado pendiente/resuelto, teléfono del cliente, aviso (puntito) en el menú cuando hay pendientes.
- **Modo soporte con permiso:** el admin pide acceso al panel de un cliente, el cliente lo autoriza desde una notificación real (no falsa) en su TopNav, queda un permiso de única vez con expiración (30 min), banner en vivo mientras el admin está adentro con botón de cortar, e historial de accesos (`support_access_requests`, `SupportAccessHistoryModal.tsx`). Es la primera tabla del proyecto con **Supabase Realtime**.
- **Responsive mobile completo** — hamburguesa + panel deslizante + topbar mobile propia (el panel admin no tenía barra superior).

### 3.3 Dashboard del cliente (el negocio)
- **Onboarding** en 3 pasos (negocio → horarios → agente), persiste en Supabase (`onboarding_complete`); no se repite al volver a entrar.
- **Inicio:** KPIs (vacíos hasta tener actividad real), "Primeros pasos", horarios, aviso de stock bajo, **saludo dinámico según la hora local** (Buenos días/tardes/noches), logo grande en la TopNav.
- **Mi negocio:** nombre, rubro, descripción, dirección, teléfono, logo (Storage), horarios con turno cortado (2 turnos/día + "aplicar a todos los días").
- **Mi agente:** nombre del agente, tono (formal/cercano/divertido/con modismos), tipo de negocio (solo productos / solo servicios / ambos) — define qué secciones ve el dashboard (Inventario, Servicios, Agenda, Equipo). Todo persiste en `agent_configs` y **el nombre, el tono y las instrucciones YA alimentan al agente real** (van en el system prompt del cerebro, ver 3.10).
- **Funciones:** pantalla de toggles — es una **maqueta de configuración**, persiste en `localStorage` (no en Supabase) y **no está conectada a ningún agente real todavía**.
- **Reportes:** 3 tarjetas ("¿Qué pregunta la gente?", "Lo más consultado", "Tu parte") — hoy son **estados vacíos**, esperando que el cerebro genere datos reales.
- **Canales:** WhatsApp, Instagram, **Mail** y Chat en tu web listados como **"Sin conectar"** — UI armada, ninguna conexión real todavía. (El Mail ya figura como canal al mismo nivel que los otros; ver 6.4.)
- **Inventario (Productos):** alta/edición/borrado, foto, búsqueda, filtro por categoría, stock rápido (+/−), código de barras + lector con cámara, importar Excel/CSV (con plantilla), carga desde remito (pantalla lista para IA, editable a mano hoy), carga rápida, aviso de stock bajo, ajuste masivo. **No tiene precio de costo/margen** todavía.
- **Servicios:** para negocios de servicios (sin stock): precio fijo o "a consultar", duración (horas + minutos), categoría, foto, importar Excel/CSV.
- **Agenda y turnos:** calendario navegable por semana con vista de un día (turnos ubicados por hora y a escala de su duración), alta/edición/cancelación con modal, memoria de clientes (autocompleta teléfono), registrar pago desde el turno. **Ya soporta capacidad múltiple y empleados con disponibilidad real** (ver 3.7). El estado de pago del turno se sincroniza con Finanzas (ver 3.9).
- **Equipo (empleados):** cargar personas del equipo (nombre, color, activo/inactivo), qué servicios hace cada una (`employee_services`), y **rentabilidad por empleado** (ver 3.8).
- **Finanzas:** registrar pago de servicio (con cliente), venta de productos (desde inventario con descuento de stock, o manual), registrar gastos (con origen de fondos: efectivo / cuenta bancaria / tarjeta de la empresa), forma de pago efectivo/transferencia/**tarjeta** (débito o crédito), descuento/recargo en $ o %, selector de período (día/mes/año/todo), KPIs de ingresos/gastos/balance, gráficos por forma de pago y por cuenta, gastos por categoría, lista de movimientos con búsqueda. **Pagos pendientes de confirmación** (ver 3.9).
- **Medios de pago (zona propia en Finanzas):** subsecciones "Cuentas bancarias" (nombre/banco/CBU/alias/titular, se reutilizan al cobrar) y **"Tarjetas"** (`cards`: nombre, banco, débito/crédito, día de cierre/vencimiento si es crédito), con gasto acumulado por tarjeta en el período y **aviso pasivo** dentro de la app si una tarjeta de crédito cierra o vence pronto.
- **Buscador global (Spotlight)** en la TopNav: dropdown en vivo sobre **6 entidades** (productos, servicios, clientes, turnos, pagos y **empleados**), agrupado, navegable por teclado, insensible a acentos (RPC `global_search` con `unaccent`), con **ficha de cliente completa** al abrir un resultado de cliente (datos + turnos + pagos cruzados, `CustomerFicha.tsx`). *Foco fino parcial:* al elegir producto/servicio/pago navega a la sección con el **término precargado** (no abre el modal exacto); al elegir un turno salta a **la fecha** en la Agenda; al elegir un cliente sí abre la ficha completa. (Ajuste fino pendiente en 6.6.)
- **Soporte y ayuda** (grupo aparte del menú): reportar falla (con captura), enviar sugerencia, servicio a medida, historial de accesos de soporte.
- **Ver planes / pedir cambio de plan:** modal con los planes, marca el plan actual real, permite pedir el cambio (queda registrado y le llega al admin).
- **Sidebar:** header fijo, nav con scroll propio, footer (upsell) siempre visible sin desbordar.

### 3.4 Responsive mobile — COMPLETO en las tres superficies
Dashboard del cliente, landing pública y panel admin ya son responsive. Todo dentro de `@media (max-width: 768px)` o en clases nuevas ocultas por defecto — **cero cambios en desktop**, verificado comparando valores computados a 375px vs 1440px.

**Patrones reutilizados:**
- **Sidebar/menú → hamburguesa** con panel deslizante + overlay; se cierra al elegir sección o tocar afuera. El panel admin tiene una topbar mobile propia (oculta en desktop) solo para el botón.
- **Tablas y listas anchas → tarjetas apiladas** (en el admin, `data-label` + `content: attr()` en CSS, sin tocar la tabla semántica de desktop).
- **KPIs → 1 columna. Gráficos → apilados verticalmente**, sin desborde.
- **Modales y formularios → ancho completo**, padding cómodo, botones grandes.
- **Buscador global** → barra inline debajo de la TopNav con dropdown adaptado al ancho del celular.
- **Agenda** → vista de un día con selector de fecha; se ajustaron espaciados y áreas táctiles.

**Fixes transversales:**
- **Zoom automático de iOS resuelto de raíz:** todo input/select/textarea a `font-size: 16px` en mobile (Safari agranda al enfocar inputs <16px). **No se usó** `maximum-scale=1`/`user-scalable=no` (rompe accesibilidad) — se descartó a propósito.
- **Freno anti-desborde horizontal:** `html, body, #root` con `overflow-x: hidden` solo en mobile.
- **Mascota Bolty oculta en mobile** (decisión de producto, no fix del PNG).
- **Avatar de la TopNav en mobile** → usa el logo del negocio si existe, o la inicial del nombre del negocio (antes usaba un dato "fantasma" de `user_metadata` desactualizado; en desktop no se tocó a propósito).
- **Panel de notificaciones** → contenido dentro del viewport.
- **FAQ de la landing** → `max-height` subido a 480px en mobile (algunas respuestas largas se cortaban).

### 3.5 Landing de marketing (`Landing.tsx`)
11 secciones: hero centrado (degradé violeta-verde, logo grande + acrónimo, sin botón "Ingresar" en el header), el problema (stats 78%/+3hs/1de3), la solución (mockup chat), cómo funciona (3 pasos), funciones destacadas (reportes, Instagram/chat web/idiomas), para quién es, por qué Bolty, planes con precio en "—", FAQ, CTA, footer. Botones de prueba/contacto NO crean cuenta todavía. Responsive completo.

### 3.6 Mascota Bolty
Ver sección 2. Oculta en mobile.

### 3.7 Agenda con capacidad y empleados (HECHO — commit `c2d1d47`)
La agenda ya **NO** asume 1 turno por horario. El dueño configura, de forma simple y flexible (`agenda_config` en `business_profiles`):
- **Modo `simple`:** capacidad sin nombres — cuántos turnos entran en el mismo horario (`capacity`, ej. "5 peluqueros" → hasta 5 turnos a la misma hora).
- **Modo `staff`:** empleados nombrados (tabla `employees`, con color y activo/inactivo). Cada uno con sus servicios (`employee_services`).
- **Modo de asignación** (`assignment`): el cliente elige con quién, automático (al que esté libre), o sin asignar.
- **Permitir superponer** (`allow_overlap`) por si una persona puede tener dos turnos a la misma hora.
- **Disponibilidad real** (`src/lib/availability.ts`): calcula estado de cada empleado (libre / ocupado / no trabaja ese día u horario / no hace ese servicio), reparte los turnos del día en columnas por empleado con packing de solapamientos, y avisa (blando o bloqueante) al agendar. Distingue recursos **intercambiables** (alcanza con capacidad) de **especializados** (cada uno con sus servicios y horarios). Esta relación empleado↔servicio es la que el cerebro va a necesitar para no ofrecer, por ejemplo, la dermatóloga cuando piden "uñas".

### 3.8 Rentabilidad por empleado (HECHO — commit `f29f475`)
- Los gastos (`expenses`) pueden atribuirse a un empleado puntual (`expenses.employee_id`, nullable): sueldo, comisión, herramienta suya, etc. La categoría del gasto sigue igual; el empleado es una dimensión aparte, opcional.
- Panel de rentabilidad (`src/components/equipo/RentabilidadPanel.tsx` en la vista Equipo): cruza los ingresos de los turnos que atendió cada empleado contra los gastos que se le atribuyen → cuánto deja cada persona.
- **Sinergia futura:** cuando cada empleado tenga su propio login (multi-usuario, ver 6.3), la atribución del turno se vuelve automática y la rentabilidad, más confiable.

### 3.9 Pagos pendientes de confirmación (HECHO — commit `a58de98`)
Cuando un cliente manda un comprobante de transferencia, el pago se registra pero **no cuenta como ingreso** hasta que el dueño verifica en su banco que la plata entró. Construido **sin IA** (la parte de la app):
- `payments` tiene `verified` (boolean, default TRUE — los pagos viejos siguen contando igual), `verified_at`, `proof_url` (comprobante a futuro) y `appointment_id` (vincula el pago con el turno que lo originó). SQL en `schema.sql` sección 24 (ya corrido en Supabase).
- **Toggle "Pendiente de confirmación"** en Registrar pago/venta, **solo visible con transferencia** (con efectivo/tarjeta se oculta y se resetea: la plata ya está). Marca `verified = FALSE`.
- **Solo los pagos verificados cuentan como ingreso** (KPIs, facturación, gráficos por forma de pago y por cuenta, balance, movimientos). Los pendientes van **siempre aparte**.
- **Chip compacto ámbar** arriba de Finanzas (colapsado por defecto, con contador + total) que abre un **acordeón** con la lista completa: cada pendiente muestra todo para chequear en el banco de un vistazo (monto, cuenta + banco + número/alias/CBU cruzando `bank_accounts`, fecha, quién pagó, forma de pago). **KPI "Pendiente de confirmación"**. Botones **Confirmar** (→ verified=TRUE + verified_at, marca el turno pagado) y **Rechazar** (borra el pago; el turno vuelve a no pagado).
- **Sincronizado con la Agenda:** el estado del turno se deriva del pago asociado — pago pendiente → badge ámbar "⏳ Pago pendiente"; pago confirmado (o turno marcado pagado) → verde "✓ Cobrado"; sin pago → botón `$`.
- **Lo que falta (con IA):** que el agente detecte el comprobante por WhatsApp y cree el pago pendiente solo (depende del cerebro multimodal).

### 3.10 🧠 EL CEREBRO — arrancado (capas 1, 2 y 3) — commits `51a038a`, `824217b` + trabajo en curso
El cerebro **ya funciona**. Se construyó directo sobre la pantalla definitiva (la Bandeja), no sobre un "chat de prueba" descartable.

- **Capa 1 — conexión segura (HECHO, `51a038a`):** Edge Function **`chat`** en Supabase (`supabase/functions/chat/index.ts`, corre en Deno del lado servidor). Recibe el mensaje, le pregunta a Claude y devuelve la respuesta. Modelo **`claude-haiku-4-5`**, `max_tokens` 1024. **La API key de Anthropic vive como secreto `ANTHROPIC_API_KEY` en Supabase, NUNCA en el front** (regla nº1). La función saca el `user_id` del **JWT** del usuario logueado y trae los datos del negocio ella misma (con RLS), no confía nada al navegador.
- **Capa 3 — personalidad (HECHO, `824217b`):** la función arma un **system prompt** con los datos reales del negocio (nombre, rubro, descripción, zona, teléfono), los **horarios con turno cortado**, los **productos y servicios con precios/duración**, y la **personalidad configurada en `agent_configs`** (nombre del agente, tono, instrucciones del dueño). El agente deja de ser "Claude genérico" y se vuelve *el empleado de ese negocio*. Reglas duras en el prompt: usa solo la info del contexto (no inventa), no confirma turnos/pagos/ventas todavía, y **escribe estilo WhatsApp: sin markdown, respuestas cortas, y NO vuelca todo el catálogo de una** (ver "problema del catálogo grande", 6.1).
- **Capa 2 — la Bandeja Unificada (CONSTRUIDA, en el working tree, aún sin commit):** el inbox omnicanal, **una sección más del menú** ("Conversaciones", `src/views/Bandeja.tsx`, ruta `bandeja` en `App.tsx`, ítem en `Sidebar.tsx` — visible siempre). Layout de dos columnas: lista de conversaciones a la izquierda, hilo abierto a la derecha (globos + composer). Cada conversación lleva su **ícono de canal** (hoy todas `web`, pero WhatsApp/Instagram/Mail ya están cableados en el tipo). Lo que ya hace:
  - **Chat web con agente automático:** escribís como cliente y el agente responde solo (llama a la Edge Function con TODO el historial → tiene **memoria** de la charla, no solo del último mensaje; se mandan hasta 40 turnos).
  - **Modelo híbrido (freno manual):** botón **"Tomar conversación"** pasa el hilo a modo `manual` (el agente se frena y respondés vos como negocio) y **"Devolver al agente"** vuelve a `auto`. En el composer elegís con qué "sombrero" escribís (👤 Cliente para probar / 🏢 Negocio).
  - **Tiempo real (Supabase Realtime):** los mensajes y las conversaciones aparecen/reordenan sin recargar.
  - **Conteo de tokens desde el minuto 1:** cada respuesta de Claude devuelve `usage` (input/output) y se guarda por mensaje (`messages.tokens_in` / `tokens_out`) — la base para medir costo/margen por cliente (ver 6.1). El panel de consumo que *lee* estos tokens todavía no está.
  - **Tablas nuevas** (en `schema.sql` sección 25, **falta correr el SQL en Supabase**): `conversations` (channel, customer_name, status, **mode** auto/manual, last_message_at) y `messages` (role customer/agent/human, content, tokens_in/out), ambas con RLS por dueño + policy admin (modo soporte) y agregadas a la publicación de Realtime. Hooks: `useConversations.ts`, `useMessages.ts`.
- **Lo que falta del cerebro:** **capa 4 (las manos / tools)** para catálogo grande y agendar de verdad, **capa 5 (panel de tokens/costo)** que lea lo que ya se guarda, y conectar los canales reales encima de la misma bandeja. Ver 6.1.

---

## 4. Decisiones tomadas

### 4.1 🪜 Escalera de planes — TANDA 2 (definida 14/07/2026)

**Cambio de posicionamiento:** Bolty ya no compite como "un bot de WhatsApp" sino como **sistema de gestión pyme con IA adentro**. Eso cambia con quién te comparan y cuánto podés cobrar:
- **Comparables (Argentina):** software de gestión pyme (Fudo, Bejerman, Colppy, Xubio) ≈ **$30.000–$80.000 ARS/mes**… y ninguno tiene un agente de IA contestando WhatsApp.
- **El pitch más fuerte sigue siendo el empleado:** un administrativo con cargas ≈ **$700.000–900.000 ARS/mes**. Bolty a ~$50.000 es el **6%** de eso.

**Las 3 palancas (y qué rol cumple cada una):**
- **VOLUMEN = el piso / protección de margen.** La IA se paga por uso: si un cliente de $30 consume $50 de API, se regala plata. No es un gancho de venta, es un **límite**. Va en todos los planes.
- **CAPACIDADES = el techo / lo que vende.** Nadie sube de plan por "más mensajes"; sube porque **necesita algo** (Instagram, finanzas, roles).
- **EQUIPO = usuarios y líneas.** Suben con el plan; en el tope se compran **extras sueltos**.

**LA ESCALERA:**

| | **Entrada** | **Medio** | **Pro** | **Pro+** |
|---|---|---|---|---|
| **Canales** | WhatsApp | + Instagram, mail, chat web | igual | + multi-idioma |
| **Líneas WhatsApp** | 1 | 1 | 2 | 3+ (extras pagos) |
| **Módulos** | Agente + inventario + agenda simple (capacidad) | + Finanzas completas + Agenda con empleados | + Rentabilidad por empleado | + Reportes avanzados |
| **Usuarios** | 1 (dueño) | 2 | 3 | **5** (+ extras pagos) |
| **Volumen** | 300 conv/mes | 1.000 | 3.000 | 8.000 |
| **Precio aprox. (USD ref.)** | ~$25-30 | ~$50-60 | ~$90-110 | ~$150-180 |

- **Usuario extra:** ~$10-15 USD/mes (solo una vez alcanzado el tope del plan).
- Cada plan ≈ **duplica** al anterior: el salto se siente significativo pero alcanzable.

**Decisiones clave y su porqué:**
- **WhatsApp va en TODOS los planes, incluso el más barato.** En Argentina, sin WhatsApp no hay producto: un plan de entrada sin WhatsApp no lo compra nadie = plan fantasma. Además es la mejor carta de venta; esconderlo detrás de un plan caro es esconderla.
- **Mail y chat web van en el medio:** solos no venden nada (nadie paga por mail), pero suman valor percibido al paquete.
- **El salto Entrada → Medio es EL MÁS IMPORTANTE:** ahí el cliente pasa de "tengo un bot" a "tengo un sistema". Es donde van a ocurrir la mayoría de los upgrades → tiene que ser tentador.
- **Módulos, criterio de corte:** *inventario y agenda* van en TODOS porque **el agente los necesita para funcionar** (si no, el agente es tonto). *Finanzas y empleados* son **gestión pura** → se pagan. El plan de entrada da **un agente que funciona**; los de arriba dan **un negocio que se entiende a sí mismo**.
- **Los usuarios crecen despacio a propósito:** si el plan de entrada ya diera 3 usuarios, nadie subiría por eso. El multi-usuario **tiene que doler** para que se pague.
- **Al pasarse del volumen: NUNCA cortar el servicio.** Que el agente deje de responder = el negocio pierde clientes y te odia. Lo correcto: **avisar y cobrar el excedente** (ej. $X cada 100 conversaciones extra) o sugerir el upgrade. El cliente decide.
- Una "conversación" = un intercambio con un cliente (no un mensaje suelto). Corte típico: la conversación vive 24hs (como hace Meta).

**⚠️ Pendientes de esta definición:**
- **Los precios son ORIENTATIVOS.** Faltan dos datos que solo se saben con el cerebro andando: (1) el **costo real de API por cliente**, (2) cómo reacciona el mercado.
- **El precio se valida VENDIENDO, no calculando.** Los primeros 5 clientes dicen más que cualquier planilla: si aceptan sin dudar → está barato; si todos regatean → está caro.

**Precios viejos (pre-TANDA 2, referencia histórica):** Básico $50.000 (~$44.000 ganancia), Estándar $75.000 ("más elegido", ~$64.000), Pro $125.000 (~$105.000), margen ~85%. Quedaron **superados por la escalera de arriba**. En cualquier caso, **los precios NO van en la landing todavía** (siguen en "—") hasta confirmarlos como definitivos.

### 4.2 Costos investigados (para referencia al definir precios/planes)
- **API de Claude (cerebro):** modelo pensado, Haiku 4.5 (~US$1/M tokens entrada, US$5/M salida). Una conversación ≈ medio centavo USD (con US$1 ≈ 200 conversaciones). Cuenta de API **separada** del Claude Pro personal, con recarga automática + límite de gasto (para no cortar la charla al cliente).
- **Costo total estimado por cliente:** ~US$5-15/mes (WhatsApp + IA + infra), cubierto de sobra por los planes. Infra: arranca gratis; a escala ~US$25-50/mes total (no por cliente).
- **WhatsApp Business API:**
  - Desde el 15/01/2026 Meta **prohíbe chatbots de IA de propósito general**; solo permite flujos orientados a tareas (consultar stock, agendar, FAQ) — Bolty debe presentarse así ante Meta.
  - Aprobación no automática (1-6 semanas). Causa #1 de rechazo: nombre legal del negocio inconsistente entre Meta/web/domicilio. Si rechazan, se reaplica a los 30 días.
  - Mensajes de servicio (respondiendo dentro de la ventana de 24hs) son **gratis** en todo el mundo. Primeras 1.000 conversaciones de servicio/mes gratis.
  - BSP obligatorio: Twilio (bueno para arrancar, sin cuota fija), 360dialog (bueno para escalar).
  - Conexión **no oficial** (WhatsApp Web JS): gratis y sin trámites, pero Meta la prohíbe y banea el número — solo para probar/demos, nunca producción. **Oficial** (Meta/BSP) para el producto real.
  - Estrategia: verificar Bolty UNA VEZ como plataforma + "embedded signup" (botón "Conectar mi WhatsApp") para que cada cliente conecte su número rápido (horas, no semanas). No prometer "instantáneo garantizado"; sí "conectás tu WhatsApp en el día". Armar el embedded signup es de lo último que se construye.
  - Probar primero el cerebro en el **chat web propio de Bolty** (sin WhatsApp, sin riesgo ni trámites).
- **Tiempo estimado para lanzar:** beta usable 2-4 meses de trabajo constante (realista 3-6 meses). Cuello de botella: aprobación de Meta.

---

## 5. Stack técnico

- **Frontend:** React + Vite + TypeScript. Carpeta local: `C:\Users\W10-PC\Desktop\bolty`.
- **Base de datos + Auth + Storage:** Supabase, con RLS (cada cliente ve solo sus datos). Project URL: `https://gvjpohtrdiujvokliygn.supabase.co` (región São Paulo). Se usa la clave publicable (`sb_publishable_...`), no la secreta. Datos locales en `.env.local` (no se sube a GitHub).
- **Hosting:** Vercel (plan Hobby) → **bolty-two.vercel.app**, deploy automático desde GitHub. Env vars cargadas en Vercel (Settings → Environment Variables).
- **Repositorio:** GitHub → **Bolty153/bolty**, rama `master`. Cuenta Bolty153 / `bolty.arg.ia@gmail.com` (personal: `nicolasmateos153@gmail.com`).
- **API de Claude (Anthropic):** **ya integrada** vía **Edge Function de Supabase** (`supabase/functions/chat`, Deno) que llama a Claude **Haiku 4.5**. La API key vive como secreto `ANTHROPIC_API_KEY` en Supabase (nunca en el front). El front la invoca con `supabase.functions.invoke('chat', ...)`. Cuenta de API separada del Claude Pro personal. Ver 3.10.

### 5.1 Tablas en Supabase (verificado contra `supabase/schema.sql` + código)
`supabase/schema.sql` es idempotente y **contiene**: `business_profiles`, `agent_configs`, `products`, `services`, `appointments`, `customers`, `payments`, `bank_accounts`, `plan_requests`, `support_tickets`, `support_access_requests`, `expenses`, `cards`, **`employees`**, **`employee_services`**, y las nuevas de la bandeja: **`conversations`** y **`messages`** (sección 25 del SQL — **falta correr ese bloque en Supabase**). Extensión `unaccent` para el buscador (RPC `global_search`).

> **Importante:** las tablas del lado admin — `profiles` (is_active, is_admin, must_change_password), `clients` y `plans` — **NO están en `schema.sql`**, se crearon a mano en el SQL Editor y no quedaron guardadas en el repo. Si hay que recrear la base desde cero, falta ese SQL — conviene rescatarlo de transcripts viejos o reconstruirlo y agregarlo al archivo.

Buckets de Storage: `logos`, `productos`, `remitos`, `servicios`, `soporte`.

---

## 6. Lo que falta hacer (hoja de ruta)

### 6.1 Núcleo / inteligencia — EL CEREBRO (ya arrancado, ver 3.10)
**Ya HECHO:** capa 1 (Edge Function segura → Claude Haiku), capa 3 (personalidad con datos reales del negocio) y capa 2 (la Bandeja Unificada con chat web, agente automático, freno manual y conteo de tokens guardado). Falta la capa 4 (las manos/tools), la capa 5 (panel de consumo), y sumar los canales reales encima de la misma bandeja.

> **📥 LA BANDEJA UNIFICADA = LA CARA DEL CEREBRO (plan por capas).** En vez de un "chat de prueba" descartable, el cerebro se construye directo sobre la pantalla DEFINITIVA: la **bandeja unificada (inbox omnicanal)**, una **sección más del menú** ("Conversaciones"). Todas las charlas de todos los canales (WhatsApp, Instagram, mail, chat web) en una pantalla, con el iconito del canal en cada una, para que el dueño no salte entre 4 apps. Se avanza de lo más seguro a lo más expuesto; cada capa se prueba antes de la siguiente:
> 1. **Conexión básica a la API** ("hola mundo") en un **backend seguro** (Edge Function de Supabase), nunca desde el navegador (si la key queda en el front, te la roban). **Regla nº1.** ✅ HECHO.
> 2. **Bandeja mínima + chat web:** la bandeja mostrando el canal `web` (que no necesita trámite). Escribís como cliente y el agente responde ahí. Es el laboratorio Y la pantalla final a la vez. ✅ HECHO (con freno manual híbrido y Realtime).
> 3. **Personalidad (system prompt):** el agente se vuelve *el empleado de ESE negocio* (quién es, qué vende, horarios, tono). ✅ HECHO.
> 4. **Las manos (tools):** el agente CONSULTA la base — stock real, disponibilidad de turnos (la RPC ya verificada), agendar. No inventa: consulta y responde con datos reales. Acá se conecta todo lo construido. ⏳ PENDIENTE.
>    - **⚠️ PROBLEMA DEL CATÁLOGO GRANDE (detectado 15/07, muy importante) — dos partes:**
>      - **(a) Comportamiento:** el agente NO debe volcar toda la lista de una cuando le dicen "quiero saber de servicios". Un vendedor pregunta primero qué busca la persona y recomienda; solo manda todo si el cliente PIDE la lista completa. → **Ya mitigado en el prompt** (regla "respuestas cortas, no pegues el catálogo entero", ver 3.10); se afina con la práctica.
>      - **(b) Técnico (más grave, PENDIENTE):** hoy el catálogo entero va metido en el system prompt (con un tope de 200 productos y 200 servicios). Con 4 productos anda; **con 1000 productos y 20 servicios es inviable** — no entra y cuesta carísimo (esa lista viaja a la IA en CADA mensaje = muchos tokens = mucha plata por conversación). **Solución = las manos:** que el agente BUSQUE en el catálogo solo lo que necesita (tool "buscar producto/servicio") en vez de tener todo encima. Es una de las manos MÁS importantes para que Bolty sirva en negocios con catálogo grande.
> 5. **Contador de tokens** desde el minuto 1 (no es opcional). ✅ Los tokens ya se **guardan** por mensaje (`tokens_in`/`tokens_out`); falta el **panel que los lea** y los cruce con el plan (ver "Medición de consumo" abajo).
>
> **Después, cada canal que se conecta CAE en la misma bandeja** (no cambia la pantalla, se llena de más fuentes): chat web → WhatsApp → Instagram → mail.
> **Modelo HÍBRIDO:** el agente responde solo, pero el dueño puede "tomar" la conversación cuando quiera (ya implementado el freno) y —con el multi-usuario— ver quién la está atendiendo (engancha con los roles). La IA hace el 90%, el humano interviene en el caso difícil. Faltan **notas internas** y la **derivación inteligente automática** a humano (enojo/reclamo).
> **La bandeja "completa" (como la referencia visual que trajo el usuario) es la META, no el día 1:** se arrancó con la versión mínima (chat web + agente) y se suma encima.

Otros pendientes del núcleo:
- **Entrenador conversacional:** que el dueño le hable al agente como a un empleado nuevo (texto y audio) y aprenda charlando, sin formularios. El usuario lo quiere **innovador, "el mejor de todos"**.
- **Asistente virtual de Bolty:** al tocar la mascota, que abra un asistente de ayuda dentro del panel.
- **Multimodal:** entender audios y leer fotos de productos, incluida la lectura automática de remitos y de **comprobantes de pago** (la parte de Finanzas ya está hecha, ver 3.9; falta la lectura automática con IA).
- **Conectar la config real:** el **tono y las instrucciones de "Mi agente" YA controlan al agente** (van en el system prompt, ver 3.10). Falta que los **switches de "Funciones"** (hoy maqueta en `localStorage`) enciendan/apaguen capacidades de verdad.
- **Que el agente responda LINDO:** formato (negrita/emojis/listas), fotos de productos (catálogo), botones/listas interactivas de WhatsApp, entender y responder audios.

**📊 Medición de consumo y costo (CRÍTICO — construir JUNTO con el cerebro):**
- **No alcanza con contar conversaciones: hay que medir TOKENS REALES.** Una conversación larga puede costar 10× una corta. Debe verse **por cliente** y **por período**, cruzado con el plan que paga cada uno → **margen real por cliente**. Sin esto se vuela a ciegas.
- **⭐ REGLA DE ORO DEL LÍMITE:** el límite de conversaciones de cada plan debe estar puesto en un número tal que, **incluso si el cliente lo consume al 100%, Bolty sigue ganando plata.** El peor caso posible tiene que seguir siendo rentable. Ojo: el cliente consume **conversaciones**, pero el costo son **TOKENS** — si el promedio de tokens por conversación resulta más alto de lo calculado, el límite está mal puesto aunque el conteo de conversaciones diga que todo bien. Solo se calibra con el cerebro andando y midiendo.
- **👁️ DOBLE VISIBILIDAD DEL CONSUMO (dos vistas distintas):**
  - **El CLIENTE ve (en su dashboard):** cuántas conversaciones usó de su plan (ej. "180 de 300 este mes"). **Sin costos** — no le incumben. Solo su consumo, para saber si se queda corto y evaluar subir de plan.
  - **NICO ve (en el panel admin):** conversaciones + **tokens reales** + **costo en USD** + lo que ese cliente paga + **MARGEN resultante**, todo por cliente. Es el tablero de control del negocio.
- Alertar si un cliente se acerca o supera el volumen de su plan (para avisar / cobrar excedente / sugerir upgrade — **nunca cortar el servicio**).

### 6.2 ✅ Agenda — capacidad y empleados — HECHO
Ya no es un pendiente. Ver **sección 3.7**. (Era el hueco del modelo viejo que asumía 1 turno por horario.)

### 6.3 Planes, permisos y uso
- **Permisos por plan** (qué funciones/secciones da cada plan), incluyendo líneas de teléfono extra al subir de plan.
- **Límites de uso por plan** (cantidad de conversaciones; ver regla de oro en 6.1).
- **👥 Multi-usuario con roles y permisos (feature de plan superior — idea fuerte):** que el **dueño del negocio** pueda crear, desde su propio dashboard y con un mail, **varios accesos** a SU negocio, cada uno con permisos distintos. Modelo estándar de SaaS B2B (Shopify, Fudo) y **genera retención** (si 5 personas del negocio lo usan a diario, no lo cambian).
  - **Roles propuestos:** *Dueño* (todo) · *Encargado/Gerente* (finanzas, agenda, equipo, gastos — todo menos config crítica) · *Empleado* (solo agenda y sus turnos) · *Stock* (solo inventario) · *Recepción/Caja* (agenda + registrar pagos, sin ver finanzas globales).
  - **Monetización:** usuarios **incluidos hasta el tope de cada plan**; pasado el tope, se compran **usuarios extra sueltos**. El plan tira del upgrade; el extra captura al que ya está en el techo. (Alineado con la escalera de 4.1.)
  - **⚠️ A resolver al construir:** (a) qué pasa al dar de baja a un empleado con login (¿se borra el acceso? ¿sus turnos quedan?); (b) que un rol con acceso a agenda **no** vea precios/finanzas si no le corresponde; (c) los permisos se aplican **en la base (RLS)**, no solo escondiendo botones en la UI.
  - **🔗 Sinergia con Equipo/Empleados:** si cada empleado tiene login propio, el turno se asigna solo al que lo carga → la **rentabilidad por empleado se vuelve automática y confiable** (ver 3.8).

### 6.4 Canales y cobros
**Dificultad de habilitación (de más fácil a más difícil):**
1. **📧 Mail — el más FÁCIL, sin trámite ni aprobación.** Solo técnico (conectar casilla, envío/recepción). No depende de Meta. **Estratégico: se podría lanzar con mail + chat web mientras se tramita WhatsApp.** Ya figura como canal en la UI (dashboard y a mostrar en landing).
2. **📸 Instagram — trámite medio.** Va por Meta, pero más liviano que WhatsApp.
3. **💬 WhatsApp — el más PESADO.** Verificación del negocio, número dedicado, plantillas + la restricción de Meta con IA general. El más valioso en Argentina, el más difícil.

Pendientes:
- Conexión real de **WhatsApp** (cada negocio su número, vía BSP / embedded signup).
- **Instagram**.
- **Chat web** embebible.
- **Responder mails** (la IA lee y redacta; opcional, el dueño lo activa).
- **Multi-idioma** (portugués, francés, etc.).
- **Cobros con Mercado Pago** (suscripciones; se conecta con "pedir cambio de plan" y la activación).
- **Prueba gratis 7 días** con activación controlada; botón "Contactanos" a WhatsApp real.
- **Definir precios definitivos** y ponerlos en la landing cuando se confirmen.
- **Conexión automática de inventario** (Tienda Nube / Mercado Libre / WooCommerce / Shopify vía API/OAuth con un botón) — trabajo grande, hacerlo cuando haya clientes que lo pidan. Hoy cubierto con import Excel/CSV.

> ⚠️ Las políticas de Meta cambian seguido: verificar requisitos actuales antes de encarar cada trámite.

### 6.5 Finanzas
- **Precio de costo por producto y margen real** (hoy el balance es ingresos − gastos, sin costo de mercadería). Requiere agregar precio de costo a cada producto.
- **Mail automático de aviso de vencimiento de suscripción:** debe salir desde una casilla del **dominio propio** (`@bolty.com` o `@bolty.com.ar` — confirmar extensión). Depende de comprar el dominio.
- **Al crear cliente (admin): opción de enviar WhatsApp** con la contraseña temporal + la dirección de Bolty (check al crear). Se puede arrancar sin IA con un link `wa.me` y mensaje pre-armado; el envío 100% automático depende de la API de WhatsApp.

### 6.6 Búsqueda global — ajuste fino pendiente
Hoy abre la ficha completa solo para clientes; para productos/servicios/pagos precarga el término en la sección (no abre el modal exacto); para turnos salta a la fecha en Agenda. Falta: abrir directo el ítem/modal exacto en todos los casos y resaltar el pago puntual. (El buscador ya cubre 6 entidades, incluidos empleados.)

### 6.7 Trámites / legal (fuera del código)
- Registro de la marca **Bolty en INPI** (atención a similitud con "Bolt").
- **WhatsApp Business API** con Meta (alta y aprobación).
- **Dominio propio** (`.com` o `.com.ar` — confirmar) y migrar de `bolty-two.vercel.app`.
- **Formalizar el negocio** (nombre legal consistente — clave para que Meta apruebe).
- **⚖️ Documentos legales del SaaS** antes de tener muchos clientes: Términos y Condiciones, Política de Privacidad (Ley 25.326 de Protección de Datos Personales en Argentina, más el impacto de usar IA en el exterior; el negocio-cliente es responsable de los datos de SUS clientes y Bolty los procesa para prestar el servicio), checkbox de aceptación al registrarse, links en el footer. **Consultar con un abogado** especializado antes de lanzar en serio — esto es un mapa, no asesoramiento legal.

---

## 7. Funciones del agente (visión completa, para referencia)

### Núcleo (siempre activas)
- Avisa al dueño lo que no sabe responder y aprende de la respuesta.
- Reportes inteligentes semanales (qué comprar, qué se vende, horarios fuertes, consultas que terminan en venta).
- Responder audios.
- Alertas en el momento (cliente importante, reclamo, pico de consultas).

### Activables desde el dashboard
- Vende y agenda dentro de la conversación.
- Recupera clientes que preguntaron y no compraron.
- Detecta idioma y responde igual.
- Deriva a humano (enojo, reclamo, tema delicado).
- Venta cruzada / productos relacionados.
- Cupones y promos automáticas.
- Personalidad propia (tono).
- Resumen de voz diario (a confirmar viabilidad).
- "¿Qué pregunta la gente?" y comparador de días.

### Destacada
- **Lista de espera inteligente:** si no hay stock, anota al cliente y le avisa cuando llega.

### Empresas grandes (a futuro)
- Varias sucursales en una cuenta, integración con sistemas que ya usan, roles de equipo.

---

## 8. Marketing — video de presentación (pendiente de producir)

**Herramienta recomendada:** para un video con voz en off narrando, la opción más simple es **InVideo AI** (invideo.io): de un prompt arma guión + escenas + voz en español + música + subtítulos (plan gratis con marca de agua/límite). Alternativa de máxima calidad: **Google Veo 3** (gratis vía Google AI Studio, clips de 8s con audio) + **CapCut** para unir/editar, y **ElevenLabs** para voz premium de marca.

**Guión vigente** (cinematográfico/sci-fi, 55 segundos):

```
Creá un video promocional CINEMATOGRÁFICO y FUTURISTA de 55 segundos para presentar "Bolty", una inteligencia artificial para negocios. Estilo tráiler de ciencia ficción tecnológica, elegante y premium.

ESPECIFICACIONES:
- Idioma: Español. Voz en off (narración) con acento latinoamericano neutro o argentino: grave, profunda, confiada, con emoción de tráiler épico.
- Tono: tecnológico, misterioso al principio, inspirador y poderoso al final. Sensación de "estamos ante algo del futuro".
- Música: cinematográfica y electrónica, empieza sutil y tensa, va creciendo a épica y luminosa.
- Formato: horizontal 16:9. (Para redes/historias: vertical 9:16.)
- Subtítulos en español en pantalla.
- Estética: alta tecnología, oscura y premium, con líneas de datos, partículas de luz y hologramas. Colores de marca violeta (#6029FF) y verde menta (#00C896).
- Protagonista: una mascota robot llamada Bolty (cerebro dividido mitad violeta mitad verde menta, un rayo de energía en el pecho, mirada amigable).

USÁ EXACTAMENTE ESTE GUIÓN DE NARRACIÓN (voz en off), una escena por línea, con los visuales indicados:

ESCENA 1 (visual: pantalla en negro, una chispa de energía enciende líneas de datos violeta y verde que se expanden formando una red luminosa en el aire):
"Durante años, los negocios soñaron con algo imposible. Un empleado que entienda todo. Que nunca se distraiga. Que nunca se vaya."

ESCENA 2 (visual: las partículas de luz se unen y forman a la mascota robot Bolty; su cerebro violeta y verde se ilumina, abre los ojos, el rayo de su pecho se enciende):
"Hoy, ese empleado existe. Y no es un bot de respuestas armadas. Es inteligencia artificial real. Se llama Bolty. Y aprende tu negocio conversando con vos, como un empleado en su primer día."

ESCENA 3 (visual: interfaces futuristas flotando; Bolty se conecta con líneas de luz a íconos de WhatsApp, Instagram, una página web y un mail, todos a la vez):
"Una vez que te conoce, atiende a tus clientes en todos lados al mismo tiempo. WhatsApp, Instagram, tu web y tu correo. Sin esperas. Sin horarios."

ESCENA 4 (visual: primeros planos tecnológicos: una onda de audio que se vuelve texto, una foto de un producto siendo reconocida con un escaneo de luz, números de stock actualizándose en tiempo real, un calendario que agenda un turno solo, símbolos de varios idiomas):
"Escucha audios. Lee fotos. Consulta tu stock en tiempo real. Agenda turnos. Y responde en cualquier idioma. Todo solo. Todo al instante."

ESCENA 5 (visual: vista cenital de un negocio funcionando como un organismo vivo y conectado, con flujos de luz y notificaciones de ventas entrando en armonía; el dueño observa tranquilo):
"Mientras vos hacés crecer tu negocio, Bolty se encarga del resto. Por una fracción de lo que cuesta un empleado."

ESCENA 6 (visual: fondo oscuro premium; aparece el logo de Bolty —la letra B con un rayo verde menta— con un glow violeta y verde, y el rayo destella con fuerza):
"Bolty. La inteligencia que tu negocio estaba esperando."
```

---

## 9. Archivos del proyecto

- **Maestro único:** este archivo, `bolty-proyecto-maestro.md`, en la raíz del proyecto. Conviene subirlo a GitHub y arrastrarlo a chats nuevos. (Reemplazó a `bolty-resumen-maestro.md`, ya borrado.)
- `bolty-dashboard.html` — prototipo viejo, no se toca.
- `supabase/schema.sql` — todo el SQL idempotente de las tablas del lado negocio (ver salvedad en 5.1 sobre `profiles`/`clients`/`plans`); la sección 25 (bandeja) **está en el archivo pero falta correrla en Supabase**.
- **Cerebro / Bandeja:** `supabase/functions/chat/index.ts` (Edge Function), `src/views/Bandeja.tsx`, `src/hooks/useConversations.ts`, `src/hooks/useMessages.ts` (ver 3.10).
- Mascota: `public/bolty-mascota.png` (poster/respaldo, con fondo) y `public/bolty-animado.webm` (el real, transparente).
- Transcripts de chats anteriores (con SQL y capturas viejas) no forman parte del repo — rescatar algo puntual si hace falta.

---

## 10. Orden de trabajo sugerido (próximos pasos)

1. **El cerebro — seguir:** capas 1-3 ya andan (Edge Function + personalidad + Bandeja con chat web y freno manual). Próximo: **correr el SQL de la sección 25** en Supabase (tablas `conversations`/`messages`), **commitear la Bandeja**, y encarar la **capa 4 (las manos/tools)** — arrancando por la tool de **buscar en el catálogo** (resuelve el problema del catálogo grande, 6.1) y la de **disponibilidad/agendar turnos**.
2. **Panel de consumo (capa 5):** leer los `tokens_in`/`tokens_out` que ya se guardan y armar la **medición de tokens/costo/margen por cliente** (regla de oro + doble visibilidad, 6.1).
3. **Conectar WhatsApp** (primer canal real, embedded signup) sobre la misma bandeja. En paralelo, mail y chat web embebible (más fáciles).
4. **Permisos y límites por plan** + **multi-usuario con roles** (6.3).
5. **Cobros con Mercado Pago.**
6. Sumar Instagram, audios y fotos, multi-idioma.
7. **Ajuste fino del buscador** (6.6) y **costo/margen por producto** (6.5) cuando convenga.
8. **Trámites** (marca, WhatsApp API, dominio, legal) en paralelo.

---

## 11. Nivel técnico del fundador

No técnico. Todo el desarrollo se hace guiado paso a paso, explicando cada decisión en lenguaje simple. Cada cambio se sube a GitHub cuando se pide explícitamente, y se despliega solo en Vercel; los cambios de base de datos se aplican corriendo el SQL en el SQL Editor de Supabase.
