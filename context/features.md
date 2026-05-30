# Ruppert — Features

Este documento describe todos los módulos que componen Ruppert, organizados por capa. Cada módulo incluye su propósito, qué problema resuelve dentro del sistema e ideas de diseño relevantes. No incluye detalles de implementación ni código.

---

## Capa 1 — Core del motor

Son los módulos que constituyen la razón de existir de Ruppert. Sin ellos no hay producto.

---

### DSL — Estructura interna de reglas

**Qué es:** La gramática que define cómo se representa un ruleset internamente. Es el contrato central del sistema: el evaluador la usa para recorrer las reglas, la SPA la usa para construirlas visualmente y la DB la usa para almacenarlas. El usuario final nunca la ve directamente.

**Qué problema resuelve:** Sin una gramática clara y compartida, el evaluador y la SPA hablarían idiomas distintos. El DSL es el lenguaje común que hace que todo el sistema sea coherente.

**Responsabilidades:**
- Definir la estructura de un ruleset: metadatos, lista de reglas ordenadas por prioridad y acción por defecto
- Definir la estructura de una regla: identificador único, nombre legible, prioridad, condición y acción
- Definir los tipos de condición: condición hoja (`field` + `op` + `value`) y agrupadores lógicos (`all`, `any`, `none`)
- Definir los operadores de comparación soportados en el MVP: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `between`, `in`, `not_in`
- Definir la estructura de una acción: `decision` (string) y `reason` (string)
- Definir el campo `default` para cuando ninguna regla se cumple

**Ideas de diseño:**
- Las variables del contexto son planas en el MVP: `score`, no `customer.score`. El soporte de paths anidados es post-MVP.
- El `reason` en la acción es tan importante como la `decision` — es lo que permite un audit trail útil y mensajes de error claros para el usuario final del cliente
- Cada regla tiene `priority` numérica. La evaluación recorre las reglas en ese orden y se detiene en la primera que se cumple
- El campo `default` es obligatorio. Todo ruleset debe tener un comportamiento definido cuando ninguna regla aplica
- El DSL vive en la DB como JSON. El usuario lo construye en la SPA y nunca lo escribe a mano

---

### Validador del DSL

**Qué es:** El componente que recibe un ruleset en JSON y verifica que cumple la gramática del DSL antes de guardarlo en la DB o evaluarlo.

**Qué problema resuelve:** Es el portero del sistema. Sin validación, un ruleset malformado llegaría al evaluador y produciría comportamiento indefinido o errores difíciles de rastrear.

**Responsabilidades:**
- Verificar que todos los campos obligatorios están presentes en el ruleset, en cada regla y en cada condición
- Verificar que los operadores usados están en la lista de operadores soportados
- Verificar que los tipos de los valores son consistentes con el operador (ej: no comparar un string con `gt`)
- Rechazar rulesets con profundidad de anidamiento excesiva (límite estático de seguridad)
- Retornar errores descriptivos que indiquen exactamente qué está mal y dónde

**Ideas de diseño:**
- El mensaje de error debe ser accionable: campo exacto, valor recibido y valores válidos esperados
- La validación de profundidad máxima previene rulesets que consumirían recursos excesivos — es más barato detectarlo en validación que en evaluación
- Este componente lo usa tanto la API (al recibir un ruleset via endpoint) como la SPA (antes de enviar a la API)

---

### Rule Evaluator

**Qué es:** El motor central de Ruppert. Recibe un ruleset en su estructura interna y un contexto con datos concretos, los recorre y produce una decisión con trazabilidad completa.

**Qué problema resuelve:** Es el corazón del sistema. Todo lo demás es infraestructura alrededor de este módulo. Su corrección y velocidad determinan la calidad del producto.

**Responsabilidades:**
- Recorrer las reglas en orden de prioridad
- Evaluar el árbol de condiciones de cada regla contra los valores del contexto
- Aplicar la lógica de los agrupadores: `all` requiere que todos los hijos sean verdaderos, `any` solo uno, `none` ninguno
- Retornar la decisión y razón de la primera regla que se cumple
- Retornar la decisión `default` si ninguna regla se cumple
- Registrar la traza completa: resultado de cada nodo evaluado y cuál fue el determinante

**Ideas de diseño:**
- El evaluador es una función pura: recibe datos, devuelve datos, sin efectos secundarios ni acceso a DB. Esto garantiza que sea completamente testeable de forma aislada y que su comportamiento sea determinista
- Short-circuit evaluation: `all` para en el primer `false`, `any` para en el primer `true` — no evalúa más de lo necesario
- Una variable no presente en el contexto se trata como condición `false` con advertencia en la traza, no como error fatal. El sistema sigue funcionando aunque el contexto esté incompleto
- La latencia objetivo es menor a 50ms para el percentil 95 en condiciones normales

---

### Audit Trail

**Qué es:** El registro inmutable de cada evaluación realizada, con todos los detalles necesarios para reproducirla o explicarla.

**Qué problema resuelve:** En industrias reguladas como fintech y seguros, las empresas necesitan poder responder "¿por qué se tomó esta decisión el 14 de marzo a las 10:32am?" con precisión y evidencia.

**Responsabilidades:**
- Registrar cada evaluación con: tenant, ruleset usado, versión, contexto recibido, decisión, razón, regla activada, latencia y timestamp
- Garantizar que los registros son append-only: nunca se modifican ni eliminan
- Permitir consultar el historial con filtros por fecha, decisión, razón y ruleset
- El registro es asíncrono respecto a la evaluación para no impactar la latencia de respuesta

**Ideas de diseño:**
- El contexto completo se almacena tal como llegó, para poder reproducir la evaluación exacta si fuera necesario
- Los registros están indexados por tenant para garantizar aislamiento total en las consultas
- La retención puede ser configurable por plan: 30 días en plan básico, mayor período en planes superiores

---

## Capa 2 — Infraestructura y seguridad

Módulos que hacen que el sistema sea seguro, justo y operable en un entorno multi-cliente real.

---

### Auth por API key

**Qué es:** El mecanismo de autenticación para sistemas externos que consumen la API de evaluación. Cada tenant tiene una o múltiples API keys que incluye en cada request.

**Qué problema resuelve:** La API necesita saber quién hace cada request para cargar las reglas correctas, aplicar los límites del plan y registrar las evaluaciones bajo el tenant correcto.

**Responsabilidades:**
- Generar API keys con formato identificable y prefijo (`ruppert_live_` o `ruppert_test_`)
- Validar la key en cada request antes de cualquier otra lógica
- Permitir múltiples keys activas por tenant y revocar cualquiera de ellas individualmente
- Distinguir entre keys de producción (generan cargo en billing) y keys de test (comportamiento idéntico pero sin cargo)

**Ideas de diseño:**
- Las API keys nunca se almacenan en texto plano, solo su hash. El tenant es responsable de guardar el valor original al momento de creación — Ruppert no puede mostrarlo después
- El tenant se deriva de la key en cada request; nunca viaja en el body ni en la URL por separado
- La SPA usa autenticación por sesión propia; las API keys son exclusivamente para sistemas externos

---

### Multi-tenancy

**Qué es:** La arquitectura que garantiza que múltiples clientes usen la misma infraestructura de Ruppert de forma completamente aislada entre sí.

**Qué problema resuelve:** Cada cliente de Ruppert es un tenant independiente. Sus rulesets, evaluaciones, audit logs y configuraciones no deben ser visibles ni accesibles desde otros tenants bajo ninguna circunstancia.

**Responsabilidades:**
- Asegurar que todas las queries a la DB estén filtradas por `tenant_id` en todo momento
- Garantizar que un cliente nunca pueda acceder a datos de otro, ni por error ni intencionalmente
- Aislar los contadores de uso y los límites del plan por tenant
- Propagar el `tenant_id` como contexto del request a todas las capas del sistema

**Ideas de diseño:**
- El `tenant_id` es parte de los índices de todas las tablas core desde el diseño inicial — agregarlo después rompe migraciones
- Los errores 404 son idénticos tanto si el recurso no existe como si existe pero pertenece a otro tenant — nunca se revela la existencia de recursos ajenos
- Row-level security en la DB como capa adicional de defensa más allá del código de aplicación

---

### Rate Limiting

**Qué es:** El sistema que controla cuántas solicitudes puede hacer cada tenant en una ventana de tiempo, según su plan.

**Qué problema resuelve:** Protege la infraestructura de Ruppert de uso abusivo o bugs en el código del cliente. También hace cumplir los límites del plan contratado.

**Responsabilidades:**
- Controlar el número de evaluaciones por tenant en ventanas deslizantes (por minuto y por período mensual)
- Retornar `429 Too Many Requests` con headers estándar (`Retry-After`, `X-RateLimit-Remaining`) cuando se supera el límite
- Diferenciar el límite según el plan del tenant

**Ideas de diseño:**
- El rate limiting vive en Redis para ser efectivo en entornos con múltiples instancias de la API
- Los headers de respuesta informan siempre el límite, el consumido y el tiempo hasta reset — el cliente nunca debe quedar a ciegas sobre su situación
- Las keys de test comparten límite de rate con las de producción para que el comportamiento en testing sea representativo

---

### Gestión de versiones de rulesets

**Qué es:** El sistema que permite al tenant publicar nuevas versiones de sus rulesets, ver el historial completo de cambios y hacer rollback a cualquier versión anterior.

**Qué problema resuelve:** Las reglas de negocio cambian con frecuencia. Sin versionado, cada cambio es destructivo: no hay forma de saber qué estaba activo antes ni de revertir si algo sale mal en producción.

**Responsabilidades:**
- Cada vez que el tenant guarda cambios en un ruleset se crea una nueva versión en estado borrador
- El tenant puede publicar el borrador con un paso explícito de confirmación — publicar activa la versión en producción de forma inmediata
- El historial de versiones es consultable desde la SPA con fecha, autor y estado (borrador, publicado, archivado)
- El rollback a una versión anterior es posible con confirmación explícita

**Ideas de diseño:**
- La versión activa es siempre una referencia explícita en el ruleset — no se asume que la más reciente es la activa
- Publicar y hacer rollback tienen efecto inmediato en producción; esto debe comunicarse claramente en la interfaz
- El estado "borrador" permite iterar sobre cambios antes de que afecten a producción

---

## Capa 3 — Interfaz (SPA)

Módulos que conforman la experiencia visual del producto para el tenant.

---

### DSL Builder visual

**Qué es:** La interfaz principal de la SPA donde el tenant crea y edita reglas de forma visual, sin escribir código ni JSON.

**Qué problema resuelve:** Es el diferenciador clave del producto. Si el equipo de negocio necesita pedirle a un developer que escriba JSON para crear una regla, Ruppert no resuelve el problema que promete resolver.

**Responsabilidades:**
- Permitir crear reglas con nombre, prioridad, condiciones y acción (decisión + razón) desde la interfaz
- Soportar condiciones simples (campo + operador + valor) y condiciones anidadas con agrupadores lógicos (`all`, `any`, `none`)
- Mostrar el árbol de condiciones de cada regla de forma visual y navegable
- Serializar el ruleset a JSON internamente y enviarlo a la API — el usuario nunca ve este JSON
- Validar las condiciones en tiempo real antes de guardar (operadores permitidos, tipos de valores, campos no vacíos)
- Permitir reordenar reglas para cambiar su prioridad

**Ideas de diseño:**
- La UX debe ser diseñada para un analista de riesgo, no para un developer. Eso significa: labels en español, sin jerga técnica, sin estados confusos
- El nombre del campo del contexto (`score`, `debts`) se escribe a mano en el MVP. En post-MVP podría autocompletarse desde el historial de contextos recibidos
- Cada acción tiene dos campos obligatorios: `decision` y `reason`. No se puede guardar una regla sin ambos
- El árbol de condiciones colapsable es importante cuando las reglas tienen muchos niveles de anidamiento

---

### Gestión de rulesets

**Qué es:** La pantalla principal de la SPA que lista todos los rulesets del tenant y permite crearlos, organizarlos y gestionarlos.

**Qué problema resuelve:** Un tenant puede tener múltiples rulesets para distintos casos de uso (aprobación de crédito, elegibilidad de seguro, clasificación de fraude). Necesita poder organizarlos, identificar cuál está activo y navegar entre ellos.

**Responsabilidades:**
- Listar todos los rulesets del tenant con nombre, estado (activo/borrador/archivado) y fecha de última modificación
- Crear un nuevo ruleset vacío o a partir de un template
- Renombrar y archivar rulesets
- Acceder al historial de versiones y al estado de publicación desde el listado

**Ideas de diseño:**
- El estado de cada ruleset (activo, borrador pendiente, archivado) debe ser lo más visible del listado
- El estado vacío — cuando el tenant no tiene ningún ruleset — guía activamente hacia crear el primero, con un template de caso de uso real (no una pantalla en blanco)

---

### Rule Tester

**Qué es:** Un panel integrado en el builder que permite simular una evaluación con datos de prueba y ver la traza visual del resultado antes de publicar.

**Qué problema resuelve:** El equipo de negocio necesita poder verificar que una regla se comporta correctamente antes de que afecte a producción. Sin tester, la única forma de probar es publicar y esperar a que lleguen evaluaciones reales.

**Responsabilidades:**
- Permitir ingresar un contexto de prueba como pares campo-valor desde la interfaz (sin escribir JSON)
- Evaluar el borrador actual con ese contexto usando exactamente el mismo evaluador que producción
- Mostrar la decisión y la razón resultante
- Colorear cada nodo del árbol: verde (condición cumplida) o rojo (condición no cumplida)
- Destacar visualmente el nodo determinante de la decisión
- Permitir guardar casos de prueba con nombre para re-ejecutarlos después

**Ideas de diseño:**
- La visualización de la traza sobre el árbol es el diferenciador clave del tester. Un resultado "rechazado" sin contexto visual de por qué no es suficiente para un analista
- El tester usa exactamente el mismo evaluador que producción — el comportamiento es garantizadamente idéntico
- El contexto de prueba puede pre-llenarse automáticamente con los campos referenciados en las condiciones del ruleset actual, para reducir trabajo manual

---

### Historial de evaluaciones

**Qué es:** La pantalla donde el tenant puede explorar todas las evaluaciones realizadas contra sus rulesets, con filtros y detalle completo de cada una.

**Qué problema resuelve:** El equipo de negocio necesita poder auditar decisiones pasadas, tanto para debugging propio como para responder a preguntas de compliance y clientes. "¿Por qué se rechazó esta solicitud?" debe tener una respuesta precisa.

**Responsabilidades:**
- Listar evaluaciones con fecha, ruleset, decisión, razón y latencia
- Filtrar por ruleset, decisión, razón y rango de fechas
- Mostrar el detalle completo de una evaluación al abrirla: contexto enviado y traza de la decisión
- Paginar correctamente para tenants con alto volumen de evaluaciones

**Ideas de diseño:**
- Este historial es el audit trail visible para el tenant. Debe transmitir precisión y confianza, no parecer un log técnico crudo
- La decisión y la razón son los datos más importantes en el listado — deben ser lo más visible de cada fila
- El detalle de una evaluación muestra el contexto enviado y la traza de forma legible, no como JSON crudo

---

### Métricas por tenant

**Qué es:** El dashboard de métricas dentro de la SPA que da visibilidad al tenant sobre el comportamiento de sus rulesets y su consumo del plan.

**Qué problema resuelve:** Sin métricas, el tenant no sabe qué reglas se disparan más, cuál es la distribución de decisiones, cómo evoluciona el volumen ni cuánto le falta para alcanzar el límite de su plan.

**Responsabilidades:**
- Mostrar evaluaciones totales en el período actual y su tendencia
- Mostrar distribución de decisiones por ruleset (cuántas "approved", cuántas "rejected", etc.)
- Mostrar las reglas más frecuentemente disparadas
- Mostrar latencia media y percentil 95
- Mostrar consumo actual respecto al límite del plan de forma clara

**Ideas de diseño:**
- Las métricas no necesitan ser en tiempo real estricto; actualizarse cada pocos minutos es suficiente para el caso de uso
- El consumo visible debe coincidir exactamente con el que usa el sistema de billing — nunca deben divergir
- Las métricas son navegables por ruleset individual y agregadas para todo el tenant

---

### Gestión de API keys

**Qué es:** La sección de la SPA donde el tenant puede crear, ver y revocar las API keys que usan sus sistemas para consumir la API.

**Qué problema resuelve:** Los sistemas externos del cliente necesitan autenticarse con la API de Ruppert. El tenant necesita poder gestionar esas credenciales de forma segura y autónoma.

**Responsabilidades:**
- Crear nuevas API keys de producción o de test con un nombre descriptivo
- Mostrar el listado de keys activas con nombre, tipo (live/test), fecha de creación y últimos caracteres visibles
- Revocar cualquier key individual sin afectar a las demás
- Mostrar el valor completo de la key solo en el momento de creación, con advertencia explícita de que no se puede recuperar después

**Ideas de diseño:**
- El valor completo de la key solo es visible una vez, inmediatamente después de crearla. La UI debe comunicar esto con suficiente énfasis
- Revocar una key es destructivo e irreversible. La confirmación debe comunicarlo claramente y nombrar los sistemas que podrían verse afectados

---

## Capa 4 — Operaciones y escala

Módulos que hacen que Ruppert sea operable como servicio real y sostenible como negocio.

---

### REST API pública

**Qué es:** La interfaz HTTP que expone la evaluación de reglas a sistemas externos. Es lo que los clientes integran en sus sistemas para obtener decisiones en tiempo real.

**Qué problema resuelve:** Es el producto para los sistemas externos del cliente — la razón técnica por la que Ruppert tiene valor más allá de la SPA.

**Responsabilidades:**
- `POST /v1/evaluate` — evalúa un contexto JSON contra el ruleset activo del tenant y retorna decisión, razón, regla activada, traza y latencia
- `POST /v1/rulesets` — crea un nuevo ruleset
- `GET /v1/rulesets` — lista los rulesets del tenant
- `GET /v1/rulesets/:id` — retorna el ruleset completo con su versión activa
- `PUT /v1/rulesets/:id` — actualiza un ruleset (crea borrador)
- `POST /v1/rulesets/:id/publish` — publica el borrador activo como nueva versión en producción
- `POST /v1/rulesets/:id/rollback` — revierte a una versión anterior
- Manejar errores de forma consistente con mensajes útiles para el developer

**Ideas de diseño:**
- El contrato de error es idéntico en todos los endpoints: `{ error, message, details? }`. La inconsistencia en errores es la mayor fuente de fricción para quien integra
- Versionar la API desde el día uno con `/v1/` aunque sea la única versión
- La paginación en endpoints de listado es cursor-based para listas que cambian frecuentemente

---

### Caché de rulesets y hot-reload

**Qué es:** Sistema de caché que mantiene los rulesets activos en memoria para servir evaluaciones sin consultar la DB en cada request.

**Qué problema resuelve:** Sin caché, cada evaluación requeriría leer el ruleset desde la DB. Los rulesets cambian raramente pero se leen en cada evaluación — el caché elimina esa carga innecesaria.

**Responsabilidades:**
- Mantener los rulesets activos de cada tenant en caché
- Invalidar el caché del tenant cuando publica una nueva versión, sin afectar a los demás tenants
- Garantizar que evaluaciones en vuelo durante un reload completan con la versión que iniciaron

**Ideas de diseño:**
- Si la API corre en múltiples instancias, el caché vive en Redis (compartido), no en memoria local del proceso
- La invalidación es push (al publicar) no pull (TTL) para garantizar consistencia inmediata
- El ruleset cacheado incluye la estructura ya procesada y lista para evaluar, no solo el JSON crudo

---

### Billing por evaluaciones

**Qué es:** El sistema que cuenta las evaluaciones por tenant y genera facturación automática según el plan contratado.

**Qué problema resuelve:** El modelo de negocio de Ruppert es pricing por uso. Sin billing confiable y transparente no hay negocio sostenible.

**Responsabilidades:**
- Contar cada evaluación de producción por tenant de forma atómica, sin pérdidas
- Alertar al tenant (email + banner en la SPA) cuando se acerca al 80% del límite de su plan
- Bloquear las evaluaciones cuando se supera el límite del plan gratuito y dirigir al upgrade
- Generar factura automática via Stripe al final del período para planes de pago
- Mostrar el consumo actual en tiempo real desde la SPA

**Ideas de diseño:**
- El contador de evaluaciones es atómico e independiente del audit log — son dos sistemas con propósitos distintos
- Las evaluaciones con keys de test no generan cargo ni cuentan contra el límite del plan
- El modelo más simple para el MVP: plan gratuito con límite bajo + plan de pago con precio por evaluación adicional

---

### Registro y onboarding self-service

**Qué es:** El flujo que convierte a un visitante nuevo en un tenant activo con su primera API key y la SPA lista para usar.

**Qué problema resuelve:** La primera experiencia con Ruppert determina si el usuario lo va a adoptar. Un onboarding largo o confuso es suficiente para perderlo antes de que vea el valor del producto.

**Responsabilidades:**
- Registro con email/contraseña u OAuth (GitHub o Google)
- Creación automática del tenant, workspace y primera API key al confirmar el email
- Email de bienvenida con la API key y un ejemplo de llamada a `/evaluate` listo para copiar y ejecutar
- Ruleset de ejemplo pre-cargado en la SPA para que el usuario pueda hacer su primera evaluación sin configurar nada

**Ideas de diseño:**
- El objetivo es que el usuario haga su primera evaluación exitosa en menos de 5 minutos desde el registro
- El ruleset de ejemplo debe ser de un caso de uso real (aprobación de crédito o elegibilidad), no un ejemplo abstracto o genérico
- El estado vacío de la SPA guía activamente hacia el primer paso — nunca muestra una pantalla en blanco sin dirección

---

## Capa 5 — Expansión del producto

Estos módulos amplían las capacidades de Ruppert más allá del núcleo inicial. Son parte del dominio del producto y las decisiones de arquitectura del MVP deben tenerlos en cuenta para no bloquearlos.

---

### Webhooks por decisión

**Qué es:** Sistema de notificaciones que avisa al sistema del cliente cuando una evaluación produce una decisión específica.

**Qué problema resuelve:** No todos los flujos de negocio son síncronos. A veces otros sistemas necesitan reaccionar automáticamente a ciertas decisiones sin consultar la API de forma activa.

**Ideas de diseño:**
- Los webhooks son completamente asíncronos; nunca bloquean ni retrasan la respuesta de `/evaluate`
- El payload incluye firma HMAC para que el cliente pueda verificar que el webhook es legítimo
- Implementar como cola interna: evaluación encola el webhook, un worker lo procesa y entrega con backoff exponencial en caso de fallo

---

### Decision Tables

**Qué es:** Una interfaz alternativa al builder de árbol, con formato de tabla tipo spreadsheet donde cada fila es una regla con sus condiciones y su resultado.

**Qué problema resuelve:** Para reglas simples con muchas combinaciones de condiciones (tablas de tarifas, tablas de elegibilidad), el formato de tabla es mucho más legible y editable que el árbol de nodos.

**Ideas de diseño:**
- Las decision tables son representaciones alternativas del mismo DSL interno — el evaluador no cambia
- Son especialmente útiles para casos de uso de pricing y elegibilidad con muchas variantes

---

### Variables del contexto anidadas

**Qué es:** Soporte para referencias a campos anidados en el contexto: `customer.score`, `loan.amount`, `applicant.address.country`.

**Qué problema resuelve:** En el MVP el contexto es plano. Muchos sistemas del cliente envían contextos con objetos anidados y necesitarían aplanarlos antes de llamar a la API, lo cual es un trabajo adicional innecesario.

---

### Múltiples rulesets en una evaluación

**Qué es:** La capacidad de evaluar más de un ruleset en una sola llamada a la API y recibir todas las decisiones en una respuesta.

**Qué problema resuelve:** Algunos flujos de decisión requieren consultar múltiples conjuntos de reglas independientes (elegibilidad + scoring + fraude) en el mismo momento. Hacerlo en una sola llamada reduce latencia y simplifica el código del cliente.

---

### AI-assisted rule authoring

**Qué es:** Asistencia de IA dentro del builder para generar reglas a partir de descripciones en lenguaje natural.

**Qué ejemplo:** El usuario escribe "rechazar si el cliente tiene más de 3 deudas y un score menor a 600" y Ruppert genera automáticamente la estructura de condiciones correspondiente para que el usuario revise y confirme.

**Ideas de diseño:**
- La IA propone, el usuario confirma. El equipo de negocio mantiene control total sobre la regla final
- La regla generada pasa siempre por el validador del DSL antes de mostrarse

---

### Self-hosting

**Qué es:** La posibilidad de desplegar Ruppert en la infraestructura propia del cliente (VPC, on-premise, Kubernetes).

**Qué problema resuelve:** Empresas con regulaciones estrictas sobre dónde pueden residir sus datos (datos financieros, PII) no pueden usar la versión cloud de Ruppert. El self-hosting les permite mantener los datos dentro de su propia infraestructura.

**Ideas de diseño:**
- El self-hosting aplica principalmente a empresas enterprise
- El modelo de licencia para self-hosting es distinto al modelo SaaS por evaluaciones

---

### SSO / SAML

**Qué es:** Integración con proveedores de identidad corporativos (Azure AD, Okta) para que los usuarios de grandes empresas puedan acceder a la SPA con sus credenciales corporativas.

**Qué problema resuelve:** Empresas enterprise requieren SSO como condición para adoptar cualquier herramienta nueva. Sin SSO, Ruppert queda fuera de su proceso de evaluación.