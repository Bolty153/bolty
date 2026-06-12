# BOLTY — Documento maestro del proyecto

**Business Online Live Technology For You**
*"Tecnología en vivo online, para tu negocio."*

> Documento maestro definitivo. Pegá esto en un chat nuevo de Claude para arrancar a construir desde cero, sin perder nada de lo definido.

---

## 1. Qué es (resumen en una frase)

Bolty es una plataforma web (SaaS) donde cualquier comercio o empresa, en pocos minutos, arma su propio "empleado virtual" con IA que responde a sus clientes por WhatsApp, Instagram y chat web — entrenado con los datos exactos del negocio, capaz de consultar el stock en tiempo real, leer fotos de productos y entender audios.

---

## 2. El problema que resuelve

- Los negocios pierden ventas porque no pueden responder consultas a toda hora, y contratar personal de atención es caro.
- La pregunta más repetida es "¿tienen tal cosa en stock?", y sin un sistema, el dueño tiene que revisar a mano y responde tarde o mal.
- WhatsApp es el canal principal de ventas en Argentina, pero no existe una herramienta de automatización accesible y simple para pymes chicas.

---

## 3. Cómo funciona (flujo del usuario final)

1. El negocio se registra en la plataforma.
2. Elige si vende productos, servicios con turno, o ambos (esto define qué módulos ve).
3. Carga su información: nombre, rubro, horarios, dirección, preguntas frecuentes.
4. Carga su inventario (sube un Excel/CSV o lo escribe manualmente).
5. Conecta su PROPIO número de WhatsApp / Instagram.
6. El agente IA queda funcionando 24/7, respondiendo solo.

---

## 4. Cómo se identifica cada negocio (pieza clave de la arquitectura)

**Cada negocio conecta su PROPIO número de WhatsApp.** No hay un número compartido, por eso nunca hay confusión, ni siquiera entre dos sucursales del mismo dueño.

Ejemplo: si alguien tiene dos veterinarias:
- Veterinaria Centro → número +54 9 341 111-1111
- Veterinaria Norte → número +54 9 341 222-2222

Cuando un cliente le escribe a la del Centro, el mensaje entra por el número 111. El sistema mira de qué número vino y ya sabe con certeza que es la Veterinaria Centro: busca SU inventario, usa SU configuración, responde con SU agente. El número es la llave de entrada, como el buzón de una casa. No hay forma de que se mezcle.

Cada empresa tiene su propio agente: el motor de IA es el mismo, pero cada negocio tiene su número, su inventario y su configuración, y eso lo hace funcionar como si fuera exclusivo.

---

## 5. Arquitectura: UNA sola plataforma para todos (multi-tenant)

Se construye una sola web, no una por cliente. Cada negocio que se registra tiene su propia cuenta y espacio privado adentro (como Instagram: una sola app, perfiles separados). Nadie ve los datos del otro. El motor de IA es uno solo y alimenta a todos los agentes.

---

## 6. Funciones del agente (clasificadas)

### 6.1 Núcleo — siempre activas, no se desactivan
- **(2) Avisa al dueño lo que no sabe responder.** Si no tiene la respuesta, en vez de inventar, le avisa al dueño; el dueño contesta una vez y el agente aprende para la próxima.
- **(3) Reportes inteligentes semanales.** Cada semana el dueño recibe: productos más preguntados que NO tiene en stock (qué comprar), horarios donde más le escriben (cuándo reforzar), productos más consultados que sí tiene (qué se vende), y cuántas consultas terminaron en venta o turno.
- **(12) Responder audios.** Escucha y entiende los audios de WhatsApp y responde. (Clave en Argentina.)
- **(22) Alertas en el momento.** Si pasa algo importante ahora (cliente grande preguntando, reclamo fuerte, pico raro de consultas), le llega un aviso al toque, sin esperar al reporte semanal.

### 6.2 Activables / desactivables desde el dashboard de cada empresa
- **(1) Vende y agenda.** Cierra la venta o reserva el turno dentro de la conversación.
- **(4) Recupera clientes que se fueron.** Si alguien preguntó y no compró, a los días el agente le reescribe con una promo.
- **(5) Detecta idioma y responde igual.** Si escriben en inglés o portugués, responde en ese idioma.
- **(6) Deriva a humano.** Si el cliente está enojado, pide hablar con una persona, o es una consulta delicada (reclamo, tema médico serio), le pasa la conversación al dueño.
- **(7) Sugiere productos relacionados (venta cruzada).** "¿Querés sumar pipeta antipulgas? Está en oferta."
- **(8) Cupones y promos automáticas.** El negocio carga una promo y el agente la ofrece en el momento justo o a clientes que hace rato no compran.
- **(17) Entrenar al agente hablándole.** El dueño le habla al agente como a un empleado nuevo ("cuando pregunten por X, decí esto; los domingos no abrimos") y el agente aprende, sin formularios.
- **(18) Personalidad propia del agente.** El negocio elige el tono: formal, canchero, divertido, con modismos argentinos. Customizable por cada empresa.
- **(19) Resumen de voz diario.** Cada noche el dueño recibe un audio corto: "Hoy respondí 34 consultas, cerré 5 ventas, hay 2 reclamos esperándote." *(A confirmar si es técnicamente posible; queda como objetivo.)*
- **(23) "¿Qué pregunta la gente?"** Resumen de las dudas más repetidas de la semana, para mejorar el negocio (ej: "muchos preguntan si hacés envíos").
- **(24) Comparador de días.** "Tu mejor día fue el jueves con 18 consultas. Los martes son flojos." Para saber cuándo reforzar o hacer promos.

### 6.3 Función destacada (activable, pero en lugar visible e importante del dashboard)
- **(9) Lista de espera inteligente.** Si no hay stock, el agente anota al cliente y le avisa solo cuando llega: "¡Llegó lo que buscabas!" No se pierde la venta.

### 6.4 Módulo aparte — solo para negocios de servicios con turnos
- **(11) Agenda y turnos completa.** Dashboard separado que aparece SOLO si el negocio eligió que trabaja con turnos (veterinarias, peluquerías, consultorios). Muestra horarios libres, reserva, y manda recordatorio el día anterior para bajar el ausentismo. Si el negocio solo vende productos (ej: repuestos de auto), este módulo no aparece.

### 6.5 Funciones para empresas grandes — van sí o sí (a definir bien cómo se arman)
- **(14) Varias sucursales en una sola cuenta.** Mismo dashboard; el dueño agrega los locales que tenga, cada uno con su número y su stock, y ve todo junto.
- **(15) Conexión con sistemas que ya usan.** Sincronizar stock con Tienda Nube, sistemas de facturación o planillas en la nube. Cero carga manual.
- **(16) Roles de equipo.** El dueño da accesos a empleados con permisos distintos (uno ve reportes, otro responde derivaciones, etc.).

### 6.6 Descartadas por ahora
- **(10) Cobro por link en el chat.** No hace falta por el momento.
- **(13) Catálogo automático.** Puede armar quilombos; se deja para más adelante.
- **(21) Termómetro del negocio.** No incluida por ahora.

---

## 7. Modelo de negocio y planes

| Plan | Precio | Incluye |
|------|--------|---------|
| Básico | $15 USD/mes | 1 canal, 200 conversaciones/mes, inventario hasta 500 productos, soporte por email |
| Pro (más vendido) | $35 USD/mes | WhatsApp + Instagram + Web, 600 conversaciones/mes, inventario ilimitado, lectura de fotos, panel de métricas |
| Empresa | $90+ USD/mes | Conversaciones ilimitadas, múltiples agentes/sucursales, integración a medida, roles de equipo, soporte prioritario |
| Setup (opcional) | $50 USD único | Configuración hecha por nosotros para el cliente |

**Cobro:** Mercado Pago (suscripciones) para Argentina, en pesos.

**A quién se le vende:**
- Pymes y comercios (venta directa).
- Empresas medianas con varias sucursales (plan Empresa + setup).
- Revendedores: agencias/consultores que lo ofrecen con su marca (white label / comisión).

**Meta a 6 meses:** ~$3.400 USD/mes recurrentes con ~110 clientes.

---

## 8. Costos de WhatsApp

Meta cobra por conversación (ventana de 24hs), no por mensaje. En Sudamérica:
- Conversación iniciada por el cliente: ~$0,0187 USD.
- Conversación iniciada por el negocio: ~$0,0533 USD.

**Modelo para arrancar (Opción A):** nosotros absorbemos el costo dentro del plan, con un límite de conversaciones por plan. A 200 conversaciones el costo es ~$4 USD; con $15 cobrado quedan ~$11 de margen.

**A futuro (Opción B):** clientes grandes crean su propia cuenta de Meta y pagan ellos; nosotros cobramos solo el SaaS. Más escalable y sin riesgo.

---

## 9. Stack técnico (todo gratis para empezar)

- **GitHub:** donde vive el código (gratis, seguro, es la base; permite mudar el deploy a cualquier lado sin rehacer nada).
- **Vercel:** hosting del frontend (web + panel del negocio). Gratis, se conecta a GitHub, se actualiza solo. (Corre sobre infraestructura de AWS; es seguro y usado en producción por empresas grandes.)
- **Supabase:** base de datos (negocios, inventarios, conversaciones). Gratis hasta cierto volumen.
- **Railway o Render:** backend que procesa los mensajes de WhatsApp. Plan gratis para arrancar.
- **API de Claude (Anthropic):** el motor de IA del agente. Pago por uso, centavos por conversación.
- **Twilio o Meta Cloud API:** conexión con WhatsApp e Instagram.
- **Mercado Pago:** cobros y suscripciones.

**Costo para empezar: $0.** El dominio propio (.com / .ar, ~$10-15 USD/año) se compra cuando haya primer cliente; mudarse de `bolty.vercel.app` al dominio propio es solo cambiar un DNS, sin tocar código.

---

## 10. Plan de construcción por fases

**Fase 1 — MVP (semana 1-2):** Panel del negocio (cargar info + inventario por Excel/CSV o manual) + chat web embebible + consulta de stock en tiempo real. Stack: React, API de Claude, Vercel, Supabase.

**Fase 2 — WhatsApp + Instagram (semana 3-4):** Conexión de WhatsApp Business (Twilio o Meta API), respuestas automáticas 24/7, DMs de Instagram, panel de conversaciones, responder audios. Stack: Node.js, webhooks.

**Fase 3 — IA visual (semana 5-6):** El cliente manda foto y el agente identifica el producto en el catálogo; OCR para leer remitos/facturas y actualizar stock. Stack: Claude Vision (multimodal).

**Fase 4 — Cobro, funciones e inteligencia (semana 7-8):** Registro/login, planes y cobro con Mercado Pago, landing pública, dashboard con todas las funciones activables, reportes y alertas. Módulo de turnos para negocios de servicios. Sucursales y roles para empresas grandes.

---

## 11. Pendientes por definir / hacer

- Logo y colores (se hacen con IA más adelante).
- Crear cuenta de GitHub (github.com → Sign up → email, contraseña y nombre de usuario → confirmar email). Gratis, 3 minutos.
- Crear cuenta de Anthropic para la API de Claude (cuando se llegue al backend).
- Negocio propio disponible como primer piloto de prueba.
- Confirmar viabilidad técnica del resumen de voz diario (función 19).
- Registrar la marca Bolty cuando el proyecto avance (atención a la similitud fonética con "Bolt", marca de IA y de transporte ya existente).

---

## 12. Orden de trabajo recomendado

1. Crear la cuenta de GitHub.
2. Armar el primer prototipo de la web en un chat de Claude (para ver cómo queda antes de instalar nada).
3. Cuando guste el prototipo, pasar a **Claude Code** (herramienta que construye el proyecto real en la computadora, con todos los archivos conectados y sincronizado con GitHub).
4. Conectar GitHub + Vercel para que quede online.
5. Comprar dominio propio cuando haya primer cliente.

---

## 13. Nivel técnico del fundador

No técnico. Todo el desarrollo se hace guiado paso a paso con Claude, explicando cada decisión en lenguaje simple.
