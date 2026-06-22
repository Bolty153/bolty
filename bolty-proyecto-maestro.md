# BOLTY — Documento maestro del proyecto

**Business Online Live Technology For You**
*"Tecnología en vivo online, para tu negocio."*

> Documento maestro de referencia. Refleja el estado real del proyecto al día de hoy. Sirve para retomar todo desde cero sin perder nada.
>
> Última actualización: 22/06/2026

---

## 1. Qué es Bolty

Bolty es una plataforma web **SaaS** (un solo sistema multi-tenant para todos los clientes) donde cualquier comercio o empresa, en pocos minutos, arma su propio **empleado virtual con IA** que atiende a sus clientes por **WhatsApp, Instagram y chat web**.

El agente:
- Responde con **IA real** (no respuestas fijas/guionadas), entrenado con los datos del negocio.
- Consulta el **stock en tiempo real**.
- **Agenda turnos** para negocios de servicios.
- Responde en **varios idiomas**.
- (A futuro) entiende audios y lee fotos de productos.

**Mercado:** Argentina (pymes, comercios y empresas con sucursales). Cobro en pesos.

**El problema que resuelve:** los negocios pierden ventas por no poder responder a toda hora; contratar personal de atención es caro; la consulta más repetida ("¿tenés tal cosa?") se responde tarde o mal. WhatsApp es el canal de ventas principal en Argentina y no hay una herramienta accesible y simple para automatizarlo.

**Cómo se identifica cada negocio (clave de arquitectura):** cada negocio conecta su **propio número de WhatsApp**. El número es la llave de entrada: el sistema sabe de qué negocio es cada mensaje y usa su inventario, su configuración y su agente. Nunca se mezcla, ni entre dos sucursales del mismo dueño.

---

## 2. Lo que YA está construido y funciona

### 2.1 Público / acceso
- **Landing de marketing** (pública): presenta el producto, planes, beneficios, llamada a la acción "Ingresar" y "Contactanos". Bolty (mascota) aparece en la esquina con un saludo.
- **Login + control de acceso manual:** registro/login con email y contraseña (Supabase Auth). El acceso al panel lo **activa manualmente el administrador** (cada cliente nuevo entra recién cuando el admin lo habilita). Pantalla de "acceso no activo" si todavía no fue habilitado. Recuperación de contraseña por email.

### 2.2 Panel de administrador (el dueño de Bolty)
- **Clientes:** alta de clientes, activar/desactivar acceso, suspender, editar (plan, estado, vencimiento, notas), resetear contraseña, y **"ver como cliente"** (modo soporte de solo lectura).
- **Dinero / Métricas / Control:** secciones del panel para seguimiento del negocio Bolty.
- **Pedidos de cambio de plan:** en el Panel aparecen los pedidos de los clientes; el admin **aprueba y cambia el plan real** del cliente.
- **Soporte:** bandeja con pestañas (Fallas / Sugerencias / Servicio a medida), estado pendiente/resuelto, teléfono del cliente para contactarlo, y **puntito de aviso** en el menú cuando hay pendientes.

### 2.3 Dashboard del cliente (el negocio)
- **Onboarding** en pasos: datos del negocio, horarios y agente. Persiste en Supabase; al volver a entrar no se vuelve a pedir.
- **Inicio:** panel con KPIs (vacíos hasta tener actividad), "Primeros pasos", horarios, aviso de stock bajo.
- **Mi negocio:** nombre, rubro, descripción, dirección, teléfono, logo (Storage) y **horarios de atención con turno cortado** (dos turnos por día, copiar a todos los días).
- **Inventario (Productos):** alta/edición/borrado, foto, búsqueda, filtro por categoría, **stock rápido (+/−)**, **código de barras opcional + lector con cámara**, **importar desde Excel/CSV** (con plantilla), **carga desde remito** (pantalla lista para enchufar IA), **carga rápida**, **aviso de stock bajo**, **ajuste masivo**.
- **Servicios:** para negocios de servicios (sin stock): precio fijo o "a consultar", **duración** (horas + minutos), categoría, foto, importar Excel/CSV.
- **Tipo de negocio** (en "Mi agente"): Solo productos / Solo servicios / Productos y servicios → define qué secciones se ven (Inventario y/o Servicios y/o Agenda).
- **Agenda y turnos:** calendario de día real, navegable sin límite; turnos ubicados por hora y a **escala de su duración**; huecos "Libre" a escala; alta/edición/cancelación con modal propio; memoria de clientes (autocompleta teléfono); **registrar pago desde el turno** (queda marcado "Cobrado").
- **Finanzas (dashboard de ingresos):** registrar **pago de servicio** (con nombre del cliente) y **venta de productos** (desde inventario con descuento de stock, o manual); **forma de pago** efectivo/transferencia; **cuentas bancarias guardadas** (con banco/CBU/titular, se eligen de una lista); **descuento/recargo** en $ o %; KPIs día/semana/mes; gráficos de **forma de pago** e **ingresos por cuenta**; lista de movimientos.
- **Mascota Bolty animada:** video con fondo transparente; bienvenida en el centro al entrar (una vez por sesión), luego flota en la esquina con glow y reacciona al mouse. También en la landing (solo esquina).
- **Soporte y ayuda** (grupo aparte del menú): reportar falla (con captura), enviar sugerencia, servicio a medida (pago, "pedir presupuesto").
- **Ver planes / pedir cambio de plan:** modal con los 3 planes, marca el plan actual real y permite pedir el cambio (queda registrado y le llega al admin).

---

## 3. Decisiones tomadas

- **Planes y precios (ARS/mes):** Básico **$50.000**, Estándar **$75.000** (el más elegido), Pro **$125.000**.
- **Control de acceso manual:** el administrador activa a cada cliente a mano (no hay alta automática con pago todavía).
- **Prueba gratis de 7 días** que deriva a contacto (no auto-cobro).
- **El agente responde con IA real** (no respuestas fijas).
- **Responde en varios idiomas.**
- **Multicanal:** WhatsApp, Instagram y chat web.
- **Cada negocio usa su propio número** de WhatsApp (llave de identificación).
- **Cobro:** Mercado Pago, en pesos (a implementar).

---

## 4. Stack técnico

- **Frontend:** React + Vite + TypeScript.
- **Base de datos + Auth + Storage:** Supabase (con RLS: cada cliente ve sólo sus datos).
- **Hosting:** Vercel → **bolty-two.vercel.app** (deploy automático desde GitHub).
- **Repositorio:** GitHub → **Bolty153/bolty** (rama `master`).
- **Esquema de base:** todo el SQL idempotente está en `supabase/schema.sql`.

### 4.1 Tablas en Supabase (resumen)
- `profiles` — acceso (is_active, is_admin).
- `business_profiles` — datos del negocio + horarios + onboarding + plan.
- `agent_configs` — configuración del agente (nombre, tono, tipo de negocio, instrucciones).
- `products` — inventario (incluye código de barras).
- `services` — servicios (sin stock; precio "a consultar"; duración).
- `appointments` — turnos (con precio y estado "cobrado").
- `customers` — memoria de clientes del negocio.
- `payments` — finanzas (pagos de servicios, ventas, manual; forma de pago, descuentos, items).
- `bank_accounts` — cuentas bancarias guardadas para transferencias.
- `plan_requests` — pedidos de cambio de plan.
- `support_tickets` — fallas / sugerencias / servicio a medida.
- `clients` + `plans` — tablas del panel admin (plan real del cliente).
- Buckets Storage: `logos`, `productos`, `remitos`, `servicios`, `soporte`.

> Importante operativo: cuando se agrega una función que guarda algo nuevo, hay que **correr el SQL correspondiente en Supabase** (SQL Editor → Run) una vez. El código en GitHub/Vercel no crea las tablas solo.

---

## 5. Lo que falta hacer (hoja de ruta)

### 5.1 Núcleo / inteligencia
- **EL CEREBRO:** conectar la **API de Claude (Anthropic)** para que el agente responda de verdad, con los datos del negocio. (Requiere backend seguro, ej. Edge Function de Supabase, para no exponer la API key.)
- **Entrenador conversacional:** que el dueño le hable al agente como a un empleado y aprenda, sin formularios.
- **Asistente virtual de Bolty:** que al tocar la mascota se abra un asistente/ayuda dentro del panel.
- **Entender audios** y **leer fotos** de productos (IA multimodal) — incluye lectura automática de **remitos** (la pantalla ya está lista).

### 5.2 Planes, permisos y uso
- **Permisos por plan:** habilitar/limitar funciones según el plan, incluyendo **líneas de teléfono extra** al subir de plan.
- **Límites de uso por plan** (cantidad de conversaciones, etc.).
- **Consumo de tokens y costo por cliente** visible en el panel admin.

### 5.3 Canales y cobros
- **Conexión real de WhatsApp / Instagram / chat web** (Meta Cloud API / Twilio).
- **Sistema de cobros con Mercado Pago** (suscripciones).
- **Conexión automática de inventario** (Tienda Nube y otros).

### 5.4 Soporte y operación
- **Acceso al dashboard del cliente con permiso del cliente** (modo soporte seguro, con consentimiento).

### 5.5 Trámites / fuera del código
- **Registro de la marca Bolty** en INPI (atención a la similitud con "Bolt").
- **WhatsApp Business API** con Meta (alta y aprobación).
- **Dominio propio** (.com / .ar) y migrar de `bolty-two.vercel.app`.

---

## 6. Funciones del agente (visión completa, para referencia)

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

### Módulo de turnos
- Agenda completa para negocios de servicios (ya construida en el dashboard; falta la reserva automática desde los canales).

### Empresas grandes
- Varias sucursales en una cuenta, integración con sistemas que ya usan, roles de equipo.

---

## 7. Orden de trabajo sugerido (próximos pasos)

1. **El cerebro:** backend + API de Claude para que el agente responda de verdad.
2. **Conectar WhatsApp** (primer canal real).
3. **Permisos y límites por plan** + consumo/costo por cliente en admin.
4. **Cobros con Mercado Pago.**
5. Sumar **Instagram, web, audios y fotos**.
6. **Trámites** (marca, WhatsApp API, dominio) en paralelo.

---

## 8. Nivel técnico del fundador

No técnico. Todo el desarrollo se hace guiado paso a paso, explicando cada decisión en lenguaje simple. Cada cambio se sube a GitHub y se despliega solo en Vercel; los cambios de base de datos se aplican corriendo el SQL en Supabase.
