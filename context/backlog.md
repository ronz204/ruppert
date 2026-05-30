# Ruppert — Backlog

## Resumen del proyecto

| | |
|---|---|
| Proyecto | Ruppert — Motor de reglas de negocio como API + SPA |
| Modelo | Micro-SaaS · API REST + SPA integrada |
| Total de tickets | 25 (18 MVP · 7 post-MVP) |
| Fases MVP | 4 fases + lanzamiento el 7 sep 2026 |
| Estimación MVP | 14 semanas · ~95 story points |
| Criterio de estimación | Story points relativos (S=1–3pts · M=5pts · L=8pts) |
| Medio de transporte | JSON en todos los endpoints |

---

## Visión del producto

Ruppert tiene dos partes que trabajan juntas:

**La API** — recibe un contexto JSON, carga las reglas del tenant desde caché, las evalúa y devuelve una decisión con trazabilidad completa. Es lo que los sistemas externos del cliente consumen en producción.

**La SPA** — la interfaz donde el tenant gestiona sus rulesets usando el DSL builder visual. El usuario nunca escribe JSON a mano; la SPA lo genera internamente y lo envía a la API. Está diseñada para un analista de riesgo, no para un developer.

El JSON es el medio de transporte en toda la cadena: la SPA serializa el ruleset a JSON para la API, la API lo guarda en la DB y el evaluador lo lee para producir decisiones.

---

## Convención de tickets

```
[PREFIJO-NNN] Título
Descripción: qué se construye y por qué
Criterios de aceptación: cómo saber que está hecho
Notas de diseño: ideas relevantes sin prescribir implementación
Deadline: fecha objetivo de cierre
Estimación: tamaño relativo y puntos
Dependencias: tickets que deben estar completos antes
```

Prefijos: `RUL` (core del motor) · `INF` (infraestructura y seguridad) · `SPA` (interfaz SPA) · `OPS` (operaciones y escala) · `EXP` (expansión post-MVP) · `ENT` (enterprise post-MVP)

---

## Fase 0 — Motor core
**1 jun → 21 jun 2026 · 3 semanas**

**Objetivo:** Tener el núcleo del sistema funcionando de forma completamente aislada y testeable antes de construir ninguna infraestructura alrededor. Al final de esta fase el evaluador recibe un ruleset y un contexto y devuelve una decisión correcta con traza completa. Sin API expuesta, sin DB operacional, sin SPA.

**Definición de done:** El evaluador pasa una suite de tests que cubre todos los operadores, todos los agrupadores lógicos, short-circuit evaluation, variables ausentes en el contexto y el comportamiento del campo `default`. Auth y multi-tenancy están implementados y listos para conectarse a la API en la fase siguiente.

---

### RUL-001 · DSL — Estructura interna de reglas

**Descripción:** Definir la gramática completa del DSL de Ruppert — la estructura JSON que representa un ruleset internamente. Es el contrato central del sistema: el evaluador la usa para recorrer las reglas, la SPA para construirlas visualmente y la DB para almacenarlas. El usuario final nunca la ve ni la escribe.

**Criterios de aceptación:**
- Existe un documento `grammar.md` en el repo que describe la gramática completa con ejemplos
- La estructura define la forma del ruleset: metadatos, lista de reglas ordenadas por prioridad y campo `default`
- La estructura define la forma de una regla: `id` único, `name` legible, `priority` numérica, `condition` y `action`
- La estructura define condiciones hoja (`field` + `op` + `value`) y agrupadores lógicos (`all`, `any`, `none`)
- La estructura define todos los operadores soportados: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `between`, `in`, `not_in`
- La estructura define la acción como objeto con `decision` (string) y `reason` (string)
- El campo `default` es obligatorio — todo ruleset tiene un comportamiento definido cuando ninguna regla aplica
- El documento incluye al menos dos ejemplos completos de casos de uso reales (aprobación de crédito, elegibilidad de seguro)
- La gramática no tiene ambigüedades antes de continuar a RUL-002

**Notas de diseño:**
- El DSL vive en la DB como JSON; el usuario lo construye en la SPA y nunca lo escribe a mano
- Las variables del contexto son planas en el MVP: `score`, no `customer.score` — el soporte de paths anidados es post-MVP y no debe bloquear el diseño de la gramática actual
- El `reason` de la acción es tan importante como la `decision` — es lo que permite un audit trail útil y mensajes de error claros para el usuario final del cliente
- La `priority` es numérica. La evaluación recorre las reglas en orden ascendente de prioridad y se detiene en la primera que se cumple

**Deadline:** 5 jun 2026
**Estimación:** M · 5 puntos
**Dependencias:** —

---

### RUL-002 · Validador del DSL

**Descripción:** Construir el componente que recibe un ruleset en JSON y verifica que cumple la gramática del DSL antes de guardarlo en la DB o evaluarlo. Es el portero del sistema — sin validación, un ruleset malformado llegaría al evaluador y produciría comportamiento indefinido.

**Criterios de aceptación:**
- Un ruleset válido pasa la validación sin errores
- Un ruleset con estructura incorrecta es rechazado con un mensaje que indica exactamente qué campo está mal y por qué
- El validador cubre: campos obligatorios faltantes, operadores no soportados, tipos de valor inconsistentes con el operador, y profundidad de anidamiento excesiva
- El mensaje de error incluye campo exacto, valor recibido y valores válidos esperados
- El límite de profundidad máxima del árbol está definido como constante estática
- Existe una suite de casos de prueba con rulesets válidos e inválidos representativos de cada tipo de error

**Notas de diseño:**
- El mensaje de error debe ser accionable: nunca "campo inválido", siempre "el campo `rules[0].condition.op` contiene el operador `regex`, que no está soportado. Operadores válidos: eq, neq, gt…"
- La validación de profundidad máxima previene rulesets que consumirían recursos excesivos — es más barato detectarlo aquí que en el evaluador
- Este componente lo usa tanto la API (al recibir un ruleset via endpoint) como la SPA (para validar en tiempo real antes de enviar)

**Deadline:** 10 jun 2026
**Estimación:** M · 5 puntos
**Dependencias:** RUL-001

---

### RUL-003 · Rule Evaluator

**Descripción:** Construir el motor central de Ruppert. Recibe un ruleset en su estructura interna y un contexto con datos concretos, recorre el árbol de reglas y produce una decisión con trazabilidad completa de cada nodo evaluado.

**Criterios de aceptación:**
- Dado un ruleset válido y un contexto, el evaluador retorna la decisión correcta en todos los casos de la suite de tests
- La evaluación es determinista: el mismo ruleset con el mismo contexto siempre produce el mismo resultado
- La respuesta incluye: decisión, razón, nombre de la regla que se activó, traza nodo a nodo y latencia de la evaluación
- Si ninguna regla se cumple, retorna la decisión y razón del campo `default`
- El short-circuit está implementado: `all` para en el primer `false`, `any` para en el primer `true`
- Una variable no presente en el contexto trata esa condición como `false` con advertencia explícita en la traza, sin detener la evaluación
- La suite de tests cubre todos los operadores, todos los agrupadores, comportamiento del `default`, short-circuit y variables ausentes
- La latencia de evaluación de rulesets con complejidad normal es menor a 50ms en el percentil 95

**Notas de diseño:**
- El evaluador es una función pura: recibe datos, devuelve datos, sin efectos secundarios ni acceso a DB. Esta pureza garantiza que sea completamente testeable de forma aislada y que su comportamiento sea determinista
- La traza debe mostrar para cada nodo: tipo de condición, campo evaluado, operador, valor esperado, valor recibido y resultado booleano
- El nodo determinante de la decisión (el que hizo que una regla se cumpliera o descartara) debe estar marcado en la traza de forma explícita

**Deadline:** 17 jun 2026
**Estimación:** L · 8 puntos
**Dependencias:** RUL-002

---

### INF-001 · Auth por API key

**Descripción:** Implementar autenticación por API key para sistemas externos: generación segura, almacenamiento como hash, validación en cada request y revocación individual. Es el mecanismo de autenticación exclusivo para la API de evaluación.

**Criterios de aceptación:**
- Se pueden generar API keys con prefijo identificable: `ruppert_live_` para producción y `ruppert_test_` para test
- Todos los endpoints de la API requieren `Authorization: Bearer <key>` para responder
- Un request sin key o con key inválida recibe HTTP 401 con mensaje descriptivo
- Un request con key revocada es rechazado de inmediato
- Las keys nunca se almacenan en texto plano — solo su hash en la DB
- Múltiples keys activas por tenant están soportadas; revocar una no afecta a las demás
- Las keys de test tienen comportamiento idéntico a las de producción pero no generan cargo en billing ni cuentan contra el rate limit

**Notas de diseño:**
- El tenant se deriva de la key en cada request; nunca viaja en el body ni en la URL por separado
- La SPA usa autenticación por sesión propia; las API keys son exclusivamente para sistemas externos — son dos mecanismos distintos
- El valor completo de la key solo es visible en el momento de creación; Ruppert no puede mostrarlo de nuevo después

**Deadline:** 17 jun 2026
**Estimación:** M · 5 puntos
**Dependencias:** —

---

### INF-002 · Multi-tenancy

**Descripción:** Garantizar que múltiples tenants usen la misma infraestructura de Ruppert de forma completamente aislada entre sí. Sus rulesets, evaluaciones, audit logs y configuraciones no deben ser visibles ni accesibles desde otros tenants bajo ninguna circunstancia.

**Criterios de aceptación:**
- Todas las queries a la DB incluyen `tenant_id` como filtro obligatorio
- Un tenant no puede ver, modificar ni evaluar rulesets de otro — ni por error ni intencionalmente
- El middleware de auth inyecta el `tenant_id` en el contexto de cada request y lo propaga a todas las capas
- Los contadores de uso y límites del plan están aislados por tenant
- Los errores 404 son idénticos tanto si el recurso no existe como si existe pero pertenece a otro tenant — nunca se revela la existencia de recursos ajenos
- Existe una prueba de aislamiento que intenta acceder a datos de otro tenant con una key válida y verifica que recibe 404

**Notas de diseño:**
- El `tenant_id` debe ser parte de los índices de todas las tablas core desde el diseño inicial — agregarlo después rompe migraciones
- Row-level security en la DB es una capa adicional de defensa más allá del código de aplicación
- El `tenant_id` se propaga como contexto del request, no como parámetro explícito en cada función del sistema

**Deadline:** 21 jun 2026
**Estimación:** L · 8 puntos
**Dependencias:** INF-001

---

## Fase 1 — API funcional
**22 jun → 12 jul 2026 · 3 semanas**

**Objetivo:** Tener una API que un developer pueda integrar y operar desde el primer día. Esta fase envuelve el motor de la Fase 0 en infraestructura real: endpoints HTTP, audit log, rate limiting, caché y versionado de rulesets. Al final, un cliente puede crear un ruleset, publicarlo y evaluarlo vía API key.

**Definición de done:** Un developer externo puede autenticarse con una API key, crear un ruleset via `POST /v1/rulesets`, publicarlo con `POST /v1/rulesets/:id/publish` y obtener una decisión evaluada con `POST /v1/evaluate`. El audit log registra cada evaluación. Los errores siguen el contrato `{ error, message, details? }` en todos los endpoints sin excepción.

---

### OPS-001 · REST API pública

**Descripción:** Exponer la funcionalidad del motor y la gestión de rulesets a través de endpoints HTTP. Es el producto para los sistemas externos del cliente — la razón técnica por la que Ruppert tiene valor más allá de la SPA.

**Criterios de aceptación:**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/v1/evaluate` | Evalúa un contexto contra el ruleset activo del tenant |
| `POST` | `/v1/rulesets` | Crea un nuevo ruleset |
| `GET` | `/v1/rulesets` | Lista los rulesets del tenant |
| `GET` | `/v1/rulesets/:id` | Retorna el detalle de un ruleset |
| `PUT` | `/v1/rulesets/:id` | Actualiza el borrador de un ruleset |
| `POST` | `/v1/rulesets/:id/publish` | Publica el borrador como nueva versión activa |
| `GET` | `/v1/rulesets/:id/versions` | Lista el historial de versiones de un ruleset |
| `POST` | `/v1/rulesets/:id/rollback` | Revierte a una versión anterior |
| `GET` | `/v1/evaluations` | Lista el historial de evaluaciones |
| `GET` | `/v1/evaluations/:id` | Retorna el detalle completo de una evaluación |
| `GET` | `/v1/metrics` | Retorna métricas del tenant para el período actual |
| `GET` | `/v1/api-keys` | Lista las API keys activas |
| `POST` | `/v1/api-keys` | Crea una nueva API key |
| `DELETE` | `/v1/api-keys/:id` | Revoca una API key |

- Todos los errores retornan exactamente `{ error: string, message: string, details?: array }`
- Todos los endpoints están versionados bajo `/v1/`

**Notas de diseño:**
- El contrato de error es idéntico en todos los endpoints sin excepción — la inconsistencia en errores es la mayor fuente de fricción para quien integra
- La paginación es cursor-based para listas que cambian frecuentemente — evita resultados duplicados o saltados que ocurren con offset pagination
- `POST /v1/evaluate` debe ser el endpoint más rápido del sistema: sin lógica extra, solo validar la key, cargar desde caché y evaluar

**Deadline:** 27 jun 2026
**Estimación:** M · 5 puntos
**Dependencias:** INF-002, RUL-003

---

### RUL-004 · Audit Trail

**Descripción:** Registro inmutable de cada evaluación realizada, con todos los detalles necesarios para reproducirla o explicarla. En industrias reguladas como fintech y seguros, la pregunta "¿por qué se tomó esta decisión el 14 de marzo a las 10:32am?" debe tener una respuesta precisa y verificable.

**Criterios de aceptación:**
- Cada evaluación se registra con: `tenant_id`, `ruleset_id`, versión del ruleset, contexto completo recibido, decisión, razón, regla activada, latencia y timestamp
- Los registros son append-only — ningún proceso puede modificarlos ni eliminarlos
- El historial es consultable con filtros por fecha, decisión, razón y ruleset
- El registro es asíncrono respecto a la evaluación — no impacta la latencia de la respuesta al cliente
- Los registros están indexados por `tenant_id` para garantizar aislamiento total en las consultas

**Notas de diseño:**
- El contexto completo se almacena tal como llegó, sin procesar — esto permite reproducir la evaluación exacta si fuera necesario en un proceso de auditoría
- El audit trail y el contador de billing son dos sistemas independientes con propósitos distintos; nunca deben estar acoplados
- La retención configurable por plan (30 días en plan básico, períodos mayores en planes superiores) se implementa como job de limpieza, no como lógica en el registro

**Deadline:** 1 jul 2026
**Estimación:** M · 5 puntos
**Dependencias:** OPS-001

---

### INF-003 · Rate Limiting

**Descripción:** Sistema que controla cuántas solicitudes puede hacer cada tenant en una ventana de tiempo según su plan. Protege la infraestructura de Ruppert de uso abusivo o bugs en el código del cliente, y hace cumplir los límites del plan contratado.

**Criterios de aceptación:**
- Cada tenant tiene límites de evaluaciones por minuto y por período mensual según su plan
- Al superar el límite, la API responde HTTP 429 con `Retry-After` y tiempo hasta reset
- Todos los responses incluyen `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`
- Los límites mensuales se resetean al inicio de cada período de facturación del tenant
- El rate limiting se ejecuta antes de cualquier lógica de negocio en cada request
- Las keys de test comparten el límite de rate con las de producción para que el comportamiento en testing sea representativo

**Notas de diseño:**
- El rate limiting vive en Redis para ser efectivo en entornos con múltiples instancias de la API — un contador en memoria del proceso no funcionaría en escala horizontal
- Los headers de respuesta informan siempre el estado del límite: el cliente nunca debe quedar a ciegas sobre su situación

**Deadline:** 1 jul 2026
**Estimación:** M · 5 puntos
**Dependencias:** INF-001

---

### OPS-002 · Caché de rulesets y hot-reload

**Descripción:** Sistema de caché que mantiene los rulesets activos en memoria para servir evaluaciones sin consultar la DB en cada request. Los rulesets cambian raramente pero se leen en cada evaluación — sin caché, la DB sería el cuello de botella del sistema.

**Criterios de aceptación:**
- Los rulesets activos se sirven desde caché en condiciones normales, sin consultar la DB
- Publicar una nueva versión invalida el caché del tenant en menos de 1 segundo
- La invalidación de un tenant no afecta el caché de los demás tenants
- Las evaluaciones en vuelo durante un reload completan con la versión del ruleset que tenían al iniciar
- Si el caché está frío (miss), la API carga el ruleset desde la DB y lo popula

**Notas de diseño:**
- Si la API corre en múltiples instancias, el caché vive en Redis (compartido) — no en memoria local del proceso, que produciría inconsistencias entre instancias
- La invalidación es push (al publicar) y no pull (TTL) para garantizar consistencia inmediata tras un publish o rollback
- El ruleset cacheado incluye la estructura ya parseada y lista para evaluar, no solo el JSON crudo — esto elimina el overhead de parseo en cada evaluación

**Deadline:** 6 jul 2026
**Estimación:** S · 3 puntos
**Dependencias:** OPS-001

---

### INF-004 · Gestión de versiones de rulesets

**Descripción:** Sistema que permite al tenant publicar nuevas versiones de sus rulesets, consultar el historial completo de cambios y hacer rollback a cualquier versión anterior. Las reglas de negocio cambian frecuentemente — sin versionado, cada cambio es destructivo.

**Criterios de aceptación:**
- Guardar cambios en un ruleset crea una nueva versión en estado borrador sin afectar la versión activa en producción
- Publicar el borrador requiere un paso explícito de confirmación — activa la nueva versión en producción de inmediato
- El historial de versiones de un ruleset es consultable con fecha, estado (borrador, publicado, archivado) y número de versión
- El rollback a una versión anterior es posible con confirmación explícita; la versión revertida queda marcada como activa
- La versión activa es siempre una referencia explícita — nunca se asume que la más reciente es la activa
- Las versiones publicadas son inmutables — no se pueden modificar, solo archivar

**Notas de diseño:**
- Publicar y hacer rollback tienen efecto inmediato en producción — esto debe comunicarse claramente en la interfaz y en la documentación de la API
- El historial de activaciones es también auditable: qué versión estuvo activa en cada momento del tiempo

**Deadline:** 12 jul 2026
**Estimación:** M · 5 puntos
**Dependencias:** OPS-001

---

## Fase 2 — SPA core
**13 jul → 9 ago 2026 · 4 semanas**

**Objetivo:** Que un usuario no técnico pueda registrarse, crear reglas desde la interfaz y empezar a usar la API sin tocar ningún JSON. Esta fase convierte Ruppert de una API para developers en un producto para equipos de negocio. El DSL builder visual es el corazón de la fase y el diferenciador más importante del producto.

**Definición de done:** Un usuario nuevo puede registrarse, ver el ruleset de ejemplo pre-cargado, crear una regla con condiciones anidadas desde la interfaz, publicarla y obtener su primera API key — todo en menos de 5 minutos y sin leer documentación.

---

### OPS-003 · Registro y onboarding self-service

**Descripción:** Flujo completo que convierte a un visitante nuevo en un tenant activo con su primera API key y la SPA lista para usar. La primera experiencia con Ruppert determina si el usuario lo va a adoptar — un onboarding largo o confuso es suficiente para perderlo antes de que vea el valor del producto.

**Criterios de aceptación:**
- Registro con email/contraseña u OAuth (GitHub o Google)
- Al confirmar el email se crea automáticamente el tenant, workspace y primera API key de producción
- Email de bienvenida con la API key y un ejemplo de llamada a `POST /v1/evaluate` listo para copiar y ejecutar en terminal
- La SPA muestra un ruleset de ejemplo pre-cargado (aprobación de crédito o elegibilidad) que el usuario puede evaluar de inmediato sin configurar nada
- El estado vacío de la SPA — cuando el tenant no tiene rulesets propios — guía activamente hacia crear el primero con un template de caso de uso real
- El tiempo desde registro hasta primera evaluación exitosa es menor a 5 minutos

**Notas de diseño:**
- El ruleset de ejemplo debe ser de un caso de uso real, no un ejemplo abstracto — "Aprobación de crédito: rechazar si score < 600 o deudas > 3" es mucho más útil que "Regla de ejemplo 1"
- La pantalla de confirmación de email nunca muestra una pantalla en blanco — guía activamente hacia el primer paso

**Deadline:** 20 jul 2026
**Estimación:** M · 5 puntos
**Dependencias:** INF-002

---

### SPA-001 · Gestión de rulesets

**Descripción:** La pantalla principal de la SPA donde el tenant puede ver todos sus rulesets, crear nuevos, gestionar versiones y navegar al builder de cada uno. Un tenant puede tener múltiples rulesets para distintos casos de uso — necesita poder organizarlos y saber cuál está activo en producción.

**Criterios de aceptación:**
- El listado muestra todos los rulesets del tenant con nombre, estado (activo / borrador / archivado) y fecha de última modificación
- El estado de cada ruleset es el elemento más visible de cada fila
- El usuario puede crear un nuevo ruleset vacío o a partir de un template
- El usuario puede renombrar y archivar rulesets
- El usuario puede acceder al historial de versiones con fecha, estado y número de cada versión
- El usuario puede publicar el borrador activo y hacer rollback desde el historial con confirmación explícita
- El estado vacío guía activamente a crear el primer ruleset, con un template de caso de uso real

**Notas de diseño:**
- Publicar y hacer rollback tienen efecto inmediato en producción — la confirmación debe comunicarlo con claridad, no ser un simple "¿estás seguro?"
- El estado "borrador pendiente" debe ser visualmente distinguible del estado "publicado" — son situaciones muy distintas para el equipo de negocio

**Deadline:** 24 jul 2026
**Estimación:** M · 5 puntos
**Dependencias:** OPS-001, INF-004

---

### SPA-002 · DSL Builder visual

**Descripción:** El editor visual de reglas — el módulo más importante de la SPA y el diferenciador clave del producto. Permite construir un ruleset completo mediante una interfaz de clicks y formularios, sin escribir código ni JSON. Si el equipo de negocio necesita pedirle a un developer que escriba JSON para crear una regla, Ruppert no resuelve el problema que promete resolver.

**Criterios de aceptación:**
- El usuario puede crear una condición seleccionando campo, operador y valor desde controles visuales
- El usuario puede agrupar condiciones con `all`, `any` y `none` de forma anidada
- El árbol de condiciones de cada regla es visible, navegable y colapsable
- El usuario puede agregar múltiples reglas a un ruleset con nombre, prioridad y acción (decisión + razón)
- El usuario puede reordenar reglas para cambiar su prioridad de evaluación
- El usuario puede eliminar condiciones y reglas individualmente
- La interfaz valida en tiempo real que el ruleset está completo antes de permitir guardarlo: campos no vacíos, operadores válidos, tipos consistentes
- El ruleset construido se serializa a JSON válido que cumple el DSL de Ruppert — el usuario nunca ve este JSON
- No se puede guardar una regla sin los dos campos de acción completos: `decision` y `reason`

**Notas de diseño:**
- La UX está diseñada para un analista de riesgo, no para un developer: labels en español, sin jerga técnica, sin estados confusos
- El nombre del campo del contexto (`score`, `debts`) se escribe a mano en el MVP — en post-MVP podría autocompletarse desde el historial de contextos recibidos
- El árbol de condiciones colapsable es crítico cuando las reglas tienen muchos niveles de anidamiento

**Deadline:** 2 ago 2026
**Estimación:** L · 8 puntos
**Dependencias:** SPA-001, RUL-001

---

### SPA-003 · Gestión de API keys

**Descripción:** La sección de la SPA donde el tenant crea, visualiza y revoca las API keys que usan sus sistemas para consumir la API. Los sistemas externos del cliente necesitan autenticarse con Ruppert — el tenant debe poder gestionar esas credenciales de forma segura y autónoma.

**Criterios de aceptación:**
- El usuario puede crear API keys de producción (`ruppert_live_`) o de test (`ruppert_test_`) con un nombre descriptivo
- El listado de keys activas muestra: nombre, tipo, fecha de creación y últimos caracteres del valor
- El valor completo de la key se muestra una única vez, inmediatamente después de crearla, con advertencia explícita de que no se puede recuperar después
- El usuario puede revocar cualquier key individual sin afectar a las demás
- La confirmación de revocación comunica que la acción es inmediata e irreversible

**Notas de diseño:**
- La advertencia de "solo visible una vez" debe tener suficiente peso visual — no puede perderse en el ruido de la interfaz
- Revocar una key es destructivo: todos los sistemas que la usen dejarán de funcionar de inmediato. La confirmación debe nombrarlo explícitamente

**Deadline:** 9 ago 2026
**Estimación:** S · 3 puntos
**Dependencias:** INF-001

---

## Fase 3 — Producto completo
**10 ago → 6 sep 2026 · 4 semanas**

**Objetivo:** Cerrar el MVP con las capacidades que hacen de Ruppert un producto confiable para uso real en producción: poder probar reglas antes de publicarlas, auditar decisiones pasadas, ver métricas de uso y gestionar la facturación de forma automática.

**Definición de done:** Un analista puede abrir el tester, ingresar un contexto de prueba y ver la traza visual coloreada sobre el árbol de condiciones. El historial muestra evaluaciones reales con detalle completo. El billing genera cargos correctamente via Stripe para evaluaciones de producción y no cobra las de test.

---

### SPA-004 · Rule Tester integrado

**Descripción:** Un panel integrado en el builder que permite simular una evaluación con datos de prueba y ver la traza visual del resultado antes de publicar. Sin tester, la única forma de verificar que una regla funciona correctamente es publicarla y esperar evaluaciones reales.

**Criterios de aceptación:**
- El usuario puede ingresar un contexto de prueba como pares campo-valor desde la interfaz, sin escribir JSON
- Al ejecutar el test, la API evalúa el borrador actual con ese contexto usando exactamente el mismo evaluador que producción
- La traza se muestra visualmente sobre el árbol del builder: cada nodo se colorea verde (condición cumplida) o rojo (condición no cumplida)
- El nodo determinante de la decisión se destaca visualmente de forma clara
- El usuario puede guardar casos de prueba con nombre para re-ejecutarlos después
- El contexto de prueba puede pre-llenarse automáticamente con los campos referenciados en las condiciones del ruleset actual

**Notas de diseño:**
- La visualización de la traza sobre el árbol es el diferenciador clave del tester — un resultado "rechazado" sin contexto visual de por qué no es suficiente para tomar una decisión
- El tester usa exactamente el mismo evaluador que producción — el comportamiento es garantizadamente idéntico; no hay sorpresas al publicar
- El tester evalúa el borrador, no la versión publicada — el valor es poder probar antes de que algo llegue a producción

**Deadline:** 17 ago 2026
**Estimación:** M · 5 puntos
**Dependencias:** SPA-002, RUL-003

---

### SPA-005 · Historial de evaluaciones

**Descripción:** La pantalla donde el tenant puede explorar todas las evaluaciones realizadas contra sus rulesets, con filtros y detalle completo de cada una. "¿Por qué se rechazó la solicitud #4821?" debe tener una respuesta precisa, verificable y accesible sin ayuda del equipo de tecnología.

**Criterios de aceptación:**
- El listado muestra evaluaciones con: fecha, ruleset, decisión, razón y latencia
- La decisión y la razón son los elementos más visibles de cada fila
- El usuario puede filtrar por ruleset, decisión, razón y rango de fechas
- Al abrir una evaluación se muestra el contexto completo enviado y la traza de la decisión de forma legible, no como JSON crudo
- La paginación funciona correctamente para tenants con alto volumen de evaluaciones

**Notas de diseño:**
- Este historial es el audit trail visible para el tenant — debe transmitir precisión y confianza, no parecer un log técnico interno
- El detalle de la evaluación es esencialmente el mismo output del evaluador pero formateado para una persona, no para un developer

**Deadline:** 24 ago 2026
**Estimación:** M · 5 puntos
**Dependencias:** RUL-004, SPA-001

---

### OPS-004 · Métricas por tenant

**Descripción:** Dashboard de métricas dentro de la SPA que da visibilidad al tenant sobre el comportamiento de sus rulesets y su consumo del plan. Sin métricas, el tenant no sabe qué reglas se disparan más, cómo evoluciona el volumen ni cuánto le falta para alcanzar el límite de su plan.

**Criterios de aceptación:**
- La SPA muestra evaluaciones totales en el período actual y su tendencia respecto al período anterior
- Distribución de decisiones por ruleset: cuántas de cada valor de `decision` (approved, rejected, etc.)
- Las reglas más frecuentemente disparadas en el período
- Latencia media y percentil 95 por ruleset
- Consumo actual del plan respecto al límite, con indicador visual claro cuando se acerca al 80%
- Las métricas son navegables por ruleset individual y agregadas para todo el tenant
- El consumo visible en la SPA coincide exactamente con el que usa el sistema de billing

**Notas de diseño:**
- Las métricas no necesitan ser en tiempo real estricto — actualizarse cada pocos minutos es suficiente para el caso de uso
- El consumo del plan y el dato de billing nunca pueden divergir — si divergen, el tenant pierde la confianza en ambos

**Deadline:** 31 ago 2026
**Estimación:** M · 5 puntos
**Dependencias:** RUL-004, OPS-005

---

### OPS-005 · Billing por evaluaciones

**Descripción:** Sistema que cuenta las evaluaciones por tenant y genera facturación automática según el plan contratado. El modelo de negocio de Ruppert es pricing por uso — sin billing confiable y transparente no hay negocio sostenible.

**Criterios de aceptación:**
- Cada evaluación de producción incrementa el contador del tenant de forma atómica, sin pérdidas
- Las evaluaciones con keys de test no generan cargo ni cuentan contra el límite del plan
- El tenant recibe alerta (email + banner en la SPA) cuando alcanza el 80% del límite de su plan
- Las evaluaciones quedan bloqueadas cuando se supera el límite del plan gratuito, con redirect a upgrade
- La factura se genera automáticamente via Stripe al final del período para planes de pago
- El consumo es visible en tiempo real desde la SPA

**Notas de diseño:**
- El contador de evaluaciones es atómico e independiente del audit trail — son dos sistemas con propósitos distintos que no deben acoplarse
- El modelo del MVP: plan gratuito con límite bajo + plan de pago con precio por evaluación adicional — es el modelo más simple para lanzar

**Deadline:** 6 sep 2026
**Estimación:** M · 5 puntos
**Dependencias:** INF-003

---

## Fase 4 — Expansión del producto
**Q4 2026**

Módulos que amplían el alcance de Ruppert una vez el MVP está en producción con usuarios reales. El orden dentro de la fase no está fijado — depende del feedback recogido en los primeros 30-60 días de uso. Las decisiones de arquitectura del MVP deben tener estos módulos en cuenta para no bloquearlos.

---

### EXP-001 · Webhooks por decisión

**Descripción:** Sistema de notificaciones que avisa al sistema del cliente cuando una evaluación produce una decisión específica. No todos los flujos de negocio son síncronos — a veces otros sistemas necesitan reaccionar a ciertas decisiones sin consultar la API de forma activa.

**Criterios de aceptación:**
- El tenant configura URL de webhook y qué valores de `decision` lo disparan desde la SPA
- Ruppert envía `POST` con el detalle de la evaluación y firma HMAC al endpoint del cliente
- Reintenta con backoff exponencial si el endpoint no responde; el tenant ve el historial de entregas
- El tenant puede re-enviar webhooks fallidos manualmente desde la SPA

**Notas de diseño:**
- Los webhooks son completamente asíncronos — nunca bloquean ni retrasan la respuesta de `POST /v1/evaluate`
- La firma HMAC permite al cliente verificar que el webhook viene de Ruppert y no fue alterado en tránsito
- Implementar como cola interna: evaluación encola → worker procesa y entrega

**Estimación:** M · 5 puntos
**Dependencias:** OPS-001

---

### EXP-002 · Variables del contexto anidadas

**Descripción:** Soporte para referencias a campos anidados en el contexto: `customer.score`, `loan.amount`, `applicant.address.country`. En el MVP el contexto es plano — muchos sistemas del cliente envían objetos anidados y necesitan aplanarlos antes de llamar a la API, lo cual es trabajo adicional innecesario.

**Criterios de aceptación:**
- Las condiciones del DSL pueden referenciar campos anidados con dot notation: `customer.score`
- La SPA soporta ingresar paths anidados en el campo de nombre de variable del builder
- El evaluador resuelve correctamente paths anidados en el contexto
- Rulesets existentes con variables planas siguen funcionando sin cambios

**Notas de diseño:**
- El DSL de la Fase 0 debe estar diseñado para que este cambio sea aditivo, no destructivo
- Un campo anidado no presente en el contexto se trata igual que una variable plana ausente: condición `false` con advertencia en la traza

**Estimación:** M · 5 puntos
**Dependencias:** RUL-001, RUL-003

---

### EXP-003 · Múltiples rulesets en una evaluación

**Descripción:** La capacidad de evaluar más de un ruleset en una sola llamada a la API y recibir todas las decisiones en una respuesta. Algunos flujos de decisión requieren consultar múltiples conjuntos de reglas independientes (elegibilidad + scoring + fraude) al mismo tiempo.

**Criterios de aceptación:**
- `POST /v1/evaluate/batch` acepta un array de `{ ruleset_id, context }` y retorna un array de resultados
- Cada resultado incluye la misma información que una evaluación individual
- Los rulesets se evalúan en paralelo internamente para minimizar la latencia total
- El audit trail registra cada evaluación del batch de forma individual

**Notas de diseño:**
- Un batch parcialmente fallido (un ruleset no existe, un contexto inválido) debe retornar los resultados válidos y errores explícitos para los fallidos, no fallar todo el batch

**Estimación:** M · 5 puntos
**Dependencias:** OPS-001

---

### EXP-004 · Decision Tables

**Descripción:** Una interfaz alternativa al builder de árbol, con formato de tabla tipo spreadsheet donde cada fila es una regla con sus condiciones y su resultado. Para reglas con muchas combinaciones de condiciones (tablas de tarifas, tablas de elegibilidad), la tabla es mucho más legible y editable que el árbol de nodos.

**Criterios de aceptación:**
- El tenant puede alternar entre vista de árbol y vista de tabla para el mismo ruleset
- En vista de tabla, cada fila representa una regla y cada columna una condición o el resultado
- Las decision tables se serializan al mismo DSL interno — el evaluador no cambia
- Un ruleset creado en tabla puede editarse en árbol y viceversa sin pérdida de información

**Notas de diseño:**
- Las decision tables son representaciones alternativas del mismo DSL — no son un formato nuevo ni un evaluador distinto
- Son especialmente útiles para casos de uso de pricing y elegibilidad con muchas variantes de condición

**Estimación:** L · 8 puntos
**Dependencias:** SPA-002

---

## Fase 5 — Enterprise
**2027**

Módulos orientados a clientes con requisitos de seguridad, compliance o escala que no cubre la versión cloud estándar. Tienen alto impacto en la adopción enterprise pero también alta complejidad de implementación. Se planifican cuando hay conversaciones activas con clientes de ese perfil.

---

### ENT-001 · AI-assisted rule authoring

**Descripción:** Asistencia de IA dentro del builder para generar reglas a partir de descripciones en lenguaje natural. El usuario escribe "rechazar si el cliente tiene más de 3 deudas y un score menor a 600" y Ruppert genera la estructura de condiciones correspondiente para que el usuario revise y confirme.

**Criterios de aceptación:**
- El usuario puede describir una regla en lenguaje natural desde el builder
- La IA propone la estructura de condiciones equivalente en el árbol visual
- El usuario puede revisar, modificar y confirmar la propuesta antes de guardarla
- La regla generada pasa siempre por el validador del DSL antes de mostrarse

**Notas de diseño:**
- La IA propone, el usuario confirma — el equipo de negocio mantiene control total sobre la regla final; esto no es optional
- El valor no está en automatizar, sino en reducir el tiempo de construcción de reglas complejas

**Desbloqueado cuando:** El DSL builder visual esté maduro y el DSL estable tras varios meses en producción
**Estimación:** L · 8 puntos
**Dependencias:** SPA-002

---

### ENT-002 · Self-hosting

**Descripción:** La posibilidad de desplegar Ruppert en la infraestructura propia del cliente (VPC, on-premise, Kubernetes). Empresas con regulaciones estrictas sobre dónde pueden residir sus datos (fintech, salud, gobierno) no pueden usar la versión cloud.

**Criterios de aceptación:**
- Ruppert puede desplegarse completo (API + SPA + DB + Redis) en la infraestructura del cliente con un proceso documentado
- La configuración de la instancia self-hosted es compatible con las mismas API keys y el mismo DSL que la versión cloud
- El modelo de licencia para self-hosting está definido y es distinto al modelo SaaS por evaluaciones

**Notas de diseño:**
- El self-hosting aplica principalmente a empresas enterprise con compliance estricto de datos
- Las decisiones de arquitectura del MVP deben evitar coupling con servicios cloud específicos que bloqueen el self-hosting futuro

**Desbloqueado cuando:** Haya demanda real de clientes con restricciones regulatorias de datos
**Estimación:** L · 8 puntos
**Dependencias:** OPS-001, INF-002

---

### ENT-003 · SSO / SAML

**Descripción:** Integración con proveedores de identidad corporativos (Azure AD, Okta) para que los usuarios de grandes empresas puedan acceder a la SPA con sus credenciales corporativas. Sin SSO, Ruppert queda fuera del proceso de evaluación de herramientas de cualquier empresa enterprise.

**Criterios de aceptación:**
- La SPA soporta login via SAML 2.0 con proveedores configurables por tenant (Azure AD, Okta, Google Workspace)
- El tenant enterprise puede configurar su proveedor de identidad desde la sección de settings
- Los usuarios que acceden via SSO tienen los mismos permisos y capacidades que los usuarios con login directo

**Notas de diseño:**
- SSO es frecuentemente una condición bloqueante para la adopción en enterprise — no un nice-to-have

**Desbloqueado cuando:** Haya conversaciones activas con empresas enterprise que lo requieran como condición
**Estimación:** M · 5 puntos
**Dependencias:** OPS-003


