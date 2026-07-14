# BOLTY — Documento maestro del proyecto

**Business Online Live Technology For You**
*"Tecnología en vivo online, para tu negocio."*

> Documento maestro único. Reemplaza a los dos anteriores (`bolty-proyecto-maestro.md` viejo del 22/06 y `bolty-resumen-maestro.md` del 30/06-11/07), fusionados y verificados contra el código real y el historial de commits.
>
> **Cómo usar este archivo:** al abrir un chat nuevo, subilo o pegalo y escribí *"Seguimos con Bolty. Acá está todo el proyecto. Leé y seguimos donde quedamos."*
>
> Última actualización: **11/07/2026** (responsive mobile completo: dashboard, landing y panel admin)

---

## 0. Cómo trabajamos (instrucciones para Claude)

- El usuario es **no técnico**. Hay que guiarlo paso a paso, en **español argentino (voseo)**, explicando cualquier término técnico en simple, y celebrando los avances.
- **Honestidad ante todo:** el usuario valora la verdad y que las cosas se hagan **bien y completas, no a medias** (salvo que él mismo pida lo contrario). No ofrecerle conformarse con menos.
- **Seguridad:** nunca pegar contraseñas/claves en el chat. Frenar y avisar antes de cualquier acción destructiva (borrar, publicar, enviar) o antes de subir a GitHub — **no se sube solo, hay que pedirlo explícitamente**.
- Cuando se termina un bloque grande de trabajo y se sube a GitHub, conviene abrir una **sesión nueva** (rinde mejor, arranca liviana).
- Trabaja directo en la carpeta `C:\Users\W10-PC\Desktop\bolty` con Claude Code / la app de Claude. Server de desarrollo: `npm run dev` → `localhost:5173` (a veces cambia de puerto si el 5173 está ocupado).

---

## 1. Qué es Bolty

Bolty (**B**usiness **O**nline **L**ive **T**echnology For **Y**ou) es una plataforma web **SaaS multi-tenant**: cualquier comercio o empresa arma, en minutos, su propio **empleado virtual con IA** que atiende a sus clientes por WhatsApp, Instagram y chat web (y a futuro mail).

El agente, cuando esté conectado al cerebro de IA (ver sección 6):
- Responde con **IA real** (no respuestas fijas/guionadas), entrenado con los datos del negocio propio, como si le explicaran el trabajo a un empleado nuevo.
- Consulta el **stock en tiempo real**.
- **Agenda turnos** para negocios de servicios.
- Responde en **varios idiomas**.
- (A futuro) entiende audios y lee fotos de productos.

**Mercado:** Argentina (pymes, comercios y empresas con sucursales). Cobro en pesos.

**El problema que resuelve:** los negocios pierden ventas por no poder responder a toda hora; contratar personal de atención es caro; la consulta más repetida ("¿tenés tal cosa?") se responde tarde o mal. WhatsApp es el canal de ventas principal en Argentina y no hay una herramienta accesible y simple para automatizarlo.

**Cómo se identifica cada negocio (clave de arquitectura):** cada negocio conecta su **propio número de WhatsApp**. El número es la llave de entrada: el sistema sabe de qué negocio es cada mensaje y usa su inventario, su configuración y su agente. Nunca se mezcla, ni entre dos sucursales del mismo dueño.

---

## 2. Marca e identidad visual (definida)

- **Nombre:** Bolty. Acrónimo Business Online Live Technology For You (iniciales B-O-L-T-Y resaltadas en negrita/oscuro, no violeta).
- **Logo:** letra **B** con un rayo verde menta integrado.
- **Tipografía:** Space Grotesk (títulos) + Inter (texto).
- **Colores:** violeta `#6029FF`, verde menta `#00C896`, tinta `#13111c`, fondo claro `#f7f6fb`.
- **Mascota Bolty:** robot con cerebro dividido violeta + verde menta, auriculares, rayo en el pecho, manitos abiertas. Animada como **video WebM con fondo transparente** (`public/bolty-animado.webm`), con imagen de respaldo/poster (`public/bolty-mascota.png`, esa sí con fondo — ver nota abajo). Aparece con destello y bienvenida al entrar (una vez por sesión), después flota en la esquina inferior derecha con glow y reacciona al pasar el mouse. Visible en todo el dashboard y en la landing (solo esquina, sin bienvenida). **No aparece en mobile** (ver sección 3.6).
  - **Nota técnica (11/07):** el PNG de respaldo tiene fondo real (no transparente) — en desktop no se nota porque casi siempre se ve el video; en mobile, donde el video con canal alfa no siempre se reproduce bien, se decidió directamente **ocultar la mascota** en vez de arreglar el PNG (más simple y sin riesgo).

---

## 3. Lo que YA está construido (verificado contra el código, 11/07/2026)

### 3.1 Público / acceso
- **Landing de marketing** (`Landing.tsx`, pública): 11 secciones — hero, el problema, la solución, cómo funciona, funciones destacadas, para quién es, por qué Bolty, planes (precios en "—" todavía), FAQ, CTA, footer. Animaciones al scroll. Mascota en la esquina (oculta en mobile). **Responsive mobile completo** (ver 3.4).
- **Login + control de acceso manual:** registro/login con email y contraseña (Supabase Auth). El acceso lo activa manualmente el administrador. Pantalla de "acceso no activo" si no fue habilitado. Recuperación de contraseña por email. Ojito para mostrar/ocultar contraseña.
- **Contraseña provisoria al crear cliente:** el admin genera o escribe una clave temporal; el cliente queda obligado a cambiarla en su primer ingreso (columna `must_change_password` en `profiles`, pantalla `ForcePasswordChange.tsx`).

### 3.2 Panel de administrador (el dueño de Bolty)
- **Clientes:** alta, activar/desactivar, suspender, editar (plan, estado, vencimiento, notas), resetear contraseña, "ver como cliente" (modo soporte).
- **Dinero / Métricas / Control:** secciones de seguimiento del negocio Bolty (KPIs, gráficos, export CSV, log de actividad).
- **Pedidos de cambio de plan:** el admin ve los pedidos de los clientes y aprueba el cambio real de plan.
- **Soporte:** bandeja con pestañas (fallas / sugerencias / servicio a medida), estado pendiente/resuelto, teléfono del cliente, aviso (puntito) en el menú cuando hay pendientes.
- **Modo soporte con permiso:** el admin pide acceso al panel de un cliente, el cliente lo autoriza desde una notificación real (no falsa) en su TopNav, queda un permiso de única vez con expiración (30 min), banner en vivo mientras el admin está adentro con botón de cortar, e historial de accesos (`support_access_requests`, `SupportAccessHistoryModal.tsx`).
- **Responsive mobile completo** (ver 3.4) — antes el sidebar (`.adm-side`) desaparecía a los 900px sin reemplazo; ya tiene hamburguesa + panel deslizante igual que el dashboard del cliente.

### 3.3 Dashboard del cliente (el negocio)
- **Onboarding** en 3 pasos (negocio → horarios → agente), persiste en Supabase (`onboarding_complete`); no se repite al volver a entrar.
- **Inicio:** KPIs (vacíos hasta tener actividad real), "Primeros pasos", horarios, aviso de stock bajo, saludo dinámico según la hora local (Buenos días/tardes/noches).
- **Mi negocio:** nombre, rubro, descripción, dirección, teléfono, logo (Storage), horarios con turno cortado (2 turnos/día + "aplicar a todos los días").
- **Mi agente:** nombre del agente, tono (formal/cercano/divertido/con modismos), tipo de negocio (solo productos / solo servicios / ambos) — define qué secciones ve el dashboard (Inventario, Servicios, Agenda). Todo persiste en `agent_configs`, pero **todavía no controla ningún comportamiento real de IA** (no hay cerebro conectado aún).
- **Funciones:** pantalla de toggles (núcleo siempre activas, destacada "lista de espera", y una lista activable) — es una **maqueta de configuración**, persiste en `localStorage` del navegador (no en Supabase) y **no está conectada a ningún agente real todavía**. Sirve para mostrar/decidir qué se va a poder prender o apagar el día que exista el cerebro.
- **Reportes:** pantalla armada con 3 tarjetas ("¿Qué pregunta la gente?", "Lo más consultado", "Tu parte") — hoy son **estados vacíos** ("todavía no hay datos"), esperando que el cerebro genere datos reales.
- **Canales:** pantalla con WhatsApp / Instagram / Chat en tu web listados como **"Sin conectar"** — es la UI ya armada, pero ninguna conexión real todavía (eso depende de la API de Meta / embedded signup, ver sección 6).
- **Inventario (Productos):** alta/edición/borrado, foto, búsqueda, filtro por categoría, stock rápido (+/−), código de barras + lector con cámara, importar Excel/CSV (con plantilla), carga desde remito (pantalla lista para IA, con tabla editable a mano hoy), carga rápida, aviso de stock bajo, ajuste masivo. **No tiene precio de costo/margen** todavía (el balance de Finanzas es ingresos − gastos, no margen real).
- **Servicios:** para negocios de servicios (sin stock): precio fijo o "a consultar", duración (horas + minutos), categoría, foto, importar Excel/CSV.
- **Agenda y turnos:** calendario navegable por semana con vista de un día (turnos ubicados por hora y a escala de su duración), alta/edición/cancelación con modal, memoria de clientes (autocompleta teléfono), registrar pago desde el turno (marca "Cobrado"). **Hoy asume 1 turno por horario** — no tiene capacidad múltiple ni empleados/recursos (ver pendiente clave en sección 6).
- **Finanzas:** registrar pago de servicio (con cliente), venta de productos (desde inventario con descuento de stock, o manual), registrar gastos (con origen de fondos: efectivo / cuenta bancaria / tarjeta de la empresa), forma de pago efectivo/transferencia/**tarjeta** (débito o crédito), descuento/recargo en $ o %, selector de período (día/mes/año/todo), KPIs de ingresos/gastos/balance, gráficos por forma de pago y por cuenta, gastos por categoría, lista de movimientos con búsqueda.
- **Medios de pago (zona propia en Finanzas):** subsecciones "Cuentas bancarias" (nombre/banco/CBU/alias/titular, se reutilizan al cobrar) y **"Tarjetas"** (nombre, banco, débito/crédito, día de cierre/vencimiento si es crédito), con gasto acumulado por tarjeta en el período y **aviso pasivo** si una tarjeta de crédito cierra o vence pronto.
- **Buscador global (Spotlight)** en la TopNav: dropdown en vivo sobre 5 entidades (productos, servicios, clientes, turnos, pagos), agrupado, navegable por teclado, insensible a acentos, con **ficha de cliente completa** al abrir un resultado de cliente (datos + turnos + pagos cruzados, `CustomerFicha.tsx`). *Precisión sobre el "foco fino":* al elegir un resultado de producto/servicio/pago hoy se navega a esa sección con el **término precargado en el buscador de la sección** (no se abre el modal exacto del ítem); al elegir un turno, salta directo a **la fecha** del turno en la Agenda; al elegir un cliente, sí se abre la ficha completa. O sea: parcialmente resuelto, no 100% "abre el ítem exacto" en todos los casos.
- **Soporte y ayuda** (grupo aparte del menú): reportar falla (con captura), enviar sugerencia, servicio a medida ("pedir presupuesto"), historial de accesos de soporte.
- **Ver planes / pedir cambio de plan:** modal con los 3 planes, marca el plan actual real, permite pedir el cambio (queda registrado y le llega al admin).
- **Sidebar:** header fijo, nav con scroll propio, footer (upsell "Subí a Pro+") siempre visible sin desbordar.

### 3.4 Responsive mobile — COMPLETO: dashboard, landing y panel admin (hecho 11/07)
Las tres superficies de Bolty (dashboard del cliente, landing pública y panel admin) ya son responsive. Todo el trabajo está dentro de `@media (max-width: 768px)` o en clases nuevas ocultas por defecto — **cero cambios en desktop**, verificado en las tres comparando valores computados a 375px vs 1440px (sidebar, grillas, tablas, overflow, todo vuelve exacto a como estaba).

**Patrones reutilizados en las tres partes:**
- **Sidebar/menú → hamburguesa** con panel deslizante + overlay oscuro; se cierra al elegir sección o tocar afuera. El panel admin no tenía barra superior, así que se le agregó una topbar mobile nueva (oculta en desktop) solo para alojar el botón.
- **Tablas y listas anchas → tarjetas apiladas**, con el nombre del campo como label arriba de cada valor (en el panel admin, las tablas reales usan `data-label` + `content: attr()` en CSS para mostrar el label sin tocar la tabla semántica de desktop).
- **KPIs → 1 columna.** **Gráficos → apilados verticalmente**, sin desborde.
- **Modales y formularios → ancho completo**, padding cómodo, botones grandes.
- **Buscador global (dashboard cliente)** → barra inline debajo de la TopNav (no pantalla completa) con dropdown igual que en desktop, adaptado al ancho del celular.
- **Agenda** → ya mostraba un solo día con selector de fecha; se ajustaron espaciados y áreas táctiles (no hizo falta rehacerla).

**Fixes técnicos transversales (aplican a las tres superficies porque son reglas globales del mismo `index.css`):**
- **Zoom automático de iOS resuelto de raíz:** Safari/iPhone agranda la pantalla solo al enfocar un `<input>` con `font-size` menor a 16px (pasaba, por ejemplo, al abrir "Agendar turno"). Se llevó **todo** input/select/textarea a `font-size: 16px` en mobile. **No se usó** `maximum-scale=1` ni `user-scalable=no` en el meta viewport (rompe la accesibilidad de zoom) — esa era la solución incorrecta y se descartó a propósito.
- **Freno anti-desborde horizontal:** `html, body, #root` con `overflow-x: hidden` solo en mobile, para que nada quede "bailando" de costado pase lo que pase.
- **Mascota Bolty oculta en mobile:** decisión de producto (no fix del PNG) — resolvió el bug del recuadro/fondo que se veía en el celular. Ver sección 2.
- **Avatar de la TopNav (dashboard cliente) en mobile** → usa el logo del negocio si existe, o la inicial del nombre del negocio (antes mostraba una inicial sacada de `session.user.user_metadata.name`, un dato grabado una sola vez al crear la cuenta desde el panel admin y totalmente desactualizado respecto del negocio real — ese dato "fantasma" sigue en el avatar de desktop, que no se tocó a propósito).
- **Panel de notificaciones** (dashboard cliente) → contenido dentro del viewport (antes se salía de pantalla).
- **Bug real encontrado y corregido en la landing:** el acordeón del FAQ tenía `max-height: 220px` fijo; en mobile el texto envuelve en más líneas por el ancho angosto y algunas respuestas largas se cortaban. Se subió a 480px en mobile.

### 3.5 Landing de marketing (`Landing.tsx`)
11 secciones: hero centrado (degradé violeta-verde, logo grande + acrónimo, sin botón "Ingresar" en el header), el problema (stats 78%/+3hs/1de3), la solución (mockup chat), cómo funciona (3 pasos), funciones destacadas (incluye reportes diarios/semanales, Instagram/chat web/idiomas), para quién es, por qué Bolty, planes con precio en "—", FAQ, CTA, footer. Botones de prueba/contacto NO crean cuenta todavía. Responsive completo (ver 3.4).

### 3.6 Mascota Bolty
Ver sección 2 (marca). Oculta en mobile desde el 11/07.

---

## 4. Decisiones tomadas

### 4.1 Producto y negocio
- **Planes y precios (ARS/mes):** Básico **$50.000** (~$44.000 ganancia), Estándar **$75.000** ("más elegido", ~$64.000), Pro **$125.000** (~$105.000). Margen ~85%. Todavía **no están puestos en la landing** (sigue en "—") hasta confirmarlos como definitivos.
- **Control de acceso manual:** el administrador activa a cada cliente a mano (no hay alta automática con pago todavía).
- **Prueba gratis de 7 días** que deriva a contacto (no auto-cobro).
- **El agente responde con IA real** (no respuestas fijas), en varios idiomas.
- **Multicanal:** WhatsApp, Instagram, chat web (y mail a futuro).
- **Cada negocio usa su propio número** de WhatsApp (llave de identificación).
- **Cobro:** Mercado Pago, en pesos (a implementar).
- **Cada plan con límite de conversaciones/uso** (a definir números exactos) para proteger el margen.

### 4.2 Costos investigados (para referencia al definir precios/planes)
- **API de Claude (cerebro):** modelo pensado, Haiku 4.5 (~US$1/M tokens entrada, US$5/M salida). Una conversación ≈ medio centavo USD. Cuenta de API separada del Claude Pro personal, con recarga automática + límite de gasto.
- **Costo total estimado por cliente:** ~US$5-15/mes (WhatsApp + IA + infra), cubierto de sobra por los planes actuales.
- **WhatsApp Business API:**
  - Desde el 15/01/2026 Meta **prohíbe chatbots de IA de propósito general**; solo permite flujos orientados a tareas (consultar stock, agendar, FAQ) — Bolty debe presentarse así ante Meta.
  - Aprobación no automática (1-6 semanas). Causa #1 de rechazo: nombre legal del negocio inconsistente entre Meta/web/domicilio.
  - Mensajes de servicio (respondiendo dentro de la ventana de 24hs) son **gratis** en todo el mundo.
  - BSP obligatorio: Twilio (buena opción para arrancar, sin cuota fija), 360dialog (buena para escalar).
  - Estrategia: verificar Bolty UNA VEZ como plataforma + "embedded signup" (botón "Conectar mi WhatsApp") para que cada cliente conecte su número rápido (horas, no semanas) una vez que la plataforma ya está aprobada.
  - Probar primero el cerebro en el **chat web propio de Bolty** (sin WhatsApp, sin riesgo ni trámites).
- **Tiempo estimado para lanzar:** beta usable 2-4 meses de trabajo constante (realista 3-6 meses). Cuello de botella: aprobación de Meta.

---

## 5. Stack técnico

- **Frontend:** React + Vite + TypeScript. Carpeta local: `C:\Users\W10-PC\Desktop\bolty`.
- **Base de datos + Auth + Storage:** Supabase, con RLS (cada cliente ve solo sus datos). Project URL: `https://gvjpohtrdiujvokliygn.supabase.co` (región São Paulo). Se usa la clave publicable (`sb_publishable_...`), no la secreta. Datos locales en `.env.local` (no se sube a GitHub).
- **Hosting:** Vercel (plan Hobby) → **bolty-two.vercel.app**, deploy automático desde GitHub. Env vars cargadas en Vercel (Settings → Environment Variables).
- **Repositorio:** GitHub → **Bolty153/bolty**, rama `master`. Cuenta Bolty153 / `bolty.arg.ia@gmail.com`.
- **API de Claude (Anthropic):** todavía **no integrada en el código** (no hay Edge Functions ni llamadas a la API en `src/`) — es el próximo gran paso ("el cerebro"). Se prevé cuenta de API separada del Claude Pro personal.

### 5.1 Tablas en Supabase (verificado contra `supabase/schema.sql` + código)
El archivo `supabase/schema.sql` es idempotente (se puede correr de nuevo sin romper nada) y **contiene**: `business_profiles`, `agent_configs`, `products`, `services`, `appointments`, `customers`, `payments`, `bank_accounts`, `plan_requests`, `support_tickets`, `support_access_requests`, `expenses`, `cards`.

> **Importante (verificado 11/07):** las tablas del lado admin — `profiles` (is_active, is_admin, must_change_password), `clients` y `plans` — **NO están en `schema.sql`**, se crearon a mano en el SQL Editor de Supabase en su momento y no quedaron guardadas en el repo. Si hay que recrear la base desde cero, falta ese SQL — conviene rescatarlo de los transcripts viejos o reconstruirlo y agregarlo al archivo.

Buckets de Storage: `logos`, `productos`, `remitos`, `servicios`, `soporte`.

> Operativo: cuando se agrega una función que guarda algo nuevo, hay que **correr el SQL correspondiente en Supabase** (SQL Editor → Run) una vez. El código en GitHub/Vercel no crea las tablas solo.

---

## 6. Lo que falta hacer (hoja de ruta)

### 6.1 Núcleo / inteligencia — EL GRAN PRÓXIMO PASO
- **El cerebro:** conectar la API de Claude (Anthropic) para que el agente responda de verdad con los datos del negocio. Requiere backend seguro (Edge Function de Supabase) para no exponer la API key. Probar primero en un chat web propio de Bolty, sin WhatsApp.
- **Entrenador conversacional:** que el dueño le hable al agente como a un empleado nuevo (texto y audio) y aprenda, sin formularios.
- **Asistente virtual de Bolty:** al tocar la mascota, que abra un asistente de ayuda dentro del panel.
- **Multimodal:** entender audios y leer fotos de productos, incluida la lectura automática de remitos (la pantalla ya está lista, solo falta la IA atrás).
- **Conectar la config real:** que los switches de "Funciones", el tono y las instrucciones de "Mi agente" controlen de verdad al agente (hoy son solo maquetas/preferencias guardadas).
- **Medir consumo y costo por cliente** (tokens de Claude + WhatsApp) en el panel admin.
- **Comprobante de pago recibido por el agente:** que si un cliente manda un comprobante por WhatsApp, el agente lo registre en Finanzas como "pendiente de verificación" hasta que el dueño lo confirme a mano. (El estado "pendiente de verificación" en Finanzas se puede construir sin IA; la lectura automática del comprobante depende del cerebro multimodal.)

### 6.2 Agenda — capacidad y empleados (importante, hacer ANTES del cerebro)
Hoy la agenda asume **1 turno por horario**, lo cual no sirve para peluquerías, barberías, consultorios, talleres, etc. Falta que el dueño pueda configurar, de forma simple y flexible:
- **Capacidad simple:** cuántos turnos entran en el mismo horario (ej. "5 peluqueros" sin nombres).
- **Empleados/recursos nombrados** (Raúl, Tomás, etc.).
- **Modo de asignación** (a elección del dueño): el cliente elige con quién, automático/aleatorio, o sin asignar.
- **Por empleado:** sus propios servicios y horarios, con un atajo para "todos iguales" si no hace falta complicarlo.
- **Distinción clave:** recursos **intercambiables** (varios peluqueros que hacen lo mismo → alcanza con la capacidad) vs. recursos **especializados** (dermatóloga/manicura/odontólogo → cada uno con sus propios servicios y horarios, no intercambiables). El agente necesita esto para no ofrecer, por ejemplo, la dermatóloga cuando piden "uñas".

### 6.3 Planes, permisos y uso
- Permisos por plan (qué funciones/secciones da cada plan), incluyendo líneas de teléfono extra al subir de plan.
- Límites de uso por plan (cantidad de conversaciones, etc.).
- Consumo de tokens y costo por cliente visible en el panel admin.

### 6.4 Canales y cobros
- Conexión real de WhatsApp / Instagram / chat web (Meta Cloud API / Twilio) — hoy la pantalla "Canales" ya existe pero todo figura "Sin conectar".
- Sistema de cobros con Mercado Pago (suscripciones).
- Conexión automática de inventario (Tienda Nube y otros) — hoy solo hay import Excel/CSV.
- Responder mails (canal nuevo).

### 6.5 Finanzas
- Precio de costo por producto y margen real (hoy el balance es ingresos − gastos, sin costo de mercadería).
- Mail automático de aviso de vencimiento de suscripción (depende de comprar el dominio propio, para que salga desde `@bolty.com` o `@bolty.com.ar` — confirmar extensión final).

### 6.6 Búsqueda global — ajuste fino pendiente
Hoy el buscador abre la ficha completa solo para clientes; para productos/servicios/pagos precarga el término de búsqueda en la sección (no abre el modal exacto); para turnos salta a la fecha en Agenda (no abre el turno). Falta: abrir directo el ítem/modal exacto en todos los casos.

> ✅ **Responsive mobile (dashboard, landing y panel admin): completo desde el 11/07.** Ver sección 3.4. Ya no es un pendiente.

### 6.7 Trámites / legal (fuera del código)
- Registro de la marca Bolty en INPI (atención a similitud con "Bolt").
- WhatsApp Business API con Meta (alta y aprobación).
- Dominio propio (`.com` o `.com.ar` — confirmar) y migrar de `bolty-two.vercel.app`.
- Formalizar el negocio (nombre legal consistente, clave para que Meta apruebe WhatsApp).
- Documentos legales del SaaS antes de tener muchos clientes: Términos y Condiciones, Política de Privacidad (Ley 25.326 de Protección de Datos Personales en Argentina, más el impacto de usar servicios de IA en el exterior), checkbox de aceptación al registrarse, links en el footer. Consultar con un abogado especializado antes de lanzar en serio.

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

**Herramienta recomendada:** para un video con voz en off narrando, la opción más simple es **InVideo AI** (invideo.io): de un prompt arma guión + escenas + voz en español + música + subtítulos (plan gratis con marca de agua/límite de minutos). Alternativa de máxima calidad: **Google Veo 3** (gratis vía Google AI Studio, clips de 8s con audio) + **CapCut** para unir/editar, y **ElevenLabs** para voz premium de marca.

**Guión vigente** (cinematográfico/sci-fi, 55 segundos, reemplaza a un guión viejo tipo "empleado que nunca duerme"):

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

- **Maestro único:** este archivo, `bolty-proyecto-maestro.md`, en la raíz del proyecto. Conviene subirlo a GitHub y arrastrarlo a chats nuevos.
- `bolty-dashboard.html` — prototipo viejo, no se toca.
- `supabase/schema.sql` — todo el SQL idempotente de las tablas del lado negocio (ver salvedad en sección 5.1 sobre `profiles`/`clients`/`plans`).
- Imagen y video de la mascota: `public/bolty-mascota.png` (poster/respaldo, con fondo) y `public/bolty-animado.webm` (el real, transparente).
- Documentos de chats anteriores (guiones, mockups) que puedan existir sueltos en outputs de conversaciones viejas no forman parte del repo — si hace falta algo de ahí, rescatarlo puntualmente.

---

## 10. Orden de trabajo sugerido (próximos pasos)

1. **Agenda — capacidad y empleados** (hueco real del modelo actual, mejor resolverlo antes que el cerebro dependa de turnos mal modelados).
2. **El cerebro:** backend + API de Claude para que el agente responda de verdad (probar primero en el chat web propio).
3. **Conectar WhatsApp** (primer canal real, embedded signup).
4. **Permisos y límites por plan** + consumo/costo por cliente en el panel admin.
5. **Cobros con Mercado Pago.**
6. Sumar Instagram, chat web real, audios y fotos.
7. **Trámites** (marca, WhatsApp API, dominio, legal) en paralelo.

---

## 11. Nivel técnico del fundador

No técnico. Todo el desarrollo se hace guiado paso a paso, explicando cada decisión en lenguaje simple. Cada cambio se sube a GitHub cuando se pide explícitamente, y se despliega solo en Vercel; los cambios de base de datos se aplican corriendo el SQL en el SQL Editor de Supabase.
