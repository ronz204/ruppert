# Ruppert — Features

Este documento es el catálogo completo de todas las features del sistema, organizadas por capa funcional. Cada feature incluye su propósito, sus responsabilidades concretas e ideas de diseño relevantes. No contiene código ni instrucciones de implementación — contiene la definición clara de qué hace cada parte del sistema y por qué existe.

El marcador **[MVP]** indica que la feature es parte del producto inicial. El marcador **[POST-MVP]** indica que está planificada pero fuera del alcance de la primera versión. Las features sin etapa explícita son transversales al sistema.

---

## Orden de desarrollo recomendado

El sistema tiene dependencias técnicas estrictas. Construir en el orden correcto evita refactorizaciones costosas.

```
Etapa 1 — Núcleo matemático
  └── DSL (schema + validador + evaluador)

Etapa 2 — Experiencia visual
  └── Builder visual → Rule Tester → Gestión de rulesets (SPA)

Etapa 3 — Infraestructura de producción
  └── Multi-tenancy → Auth por API key → Caché → API pública
  └── Audit trail → Versionado → Rate limiting

Etapa 4 — Empaque comercial
  └── Onboarding self-service → Billing → Métricas → Gestión de API keys (SPA)

Post-MVP
  └── Contexto anidado → Decision tables → Chaining → Webhooks → AI authoring → Self-hosting → SSO
```

---

## Capa 1 — Core del motor

Son los módulos que constituyen la razón de existir de Ruppert. Sin ellos no hay producto.

---

### DSL — Estructura interna de reglas `[MVP]`

**Qué es:** La gramática que define cómo se representa un ruleset internamente. Es el contrato central del sistema: el evaluador la recorre, la SPA la construye visualmente y la DB la almacena. El usuario final nunca la ve ni la escribe.

**Por qué existe:** Sin una gramática clara y compartida, el evaluador y la SPA hablarían idiomas distintos. El DSL es el lenguaje común que hace que todo el sistema sea coherente y predecible.

**Responsabilidades:**
- Definir la estructura de un ruleset: metadatos (`id`, `name`, `tenant_id`), lista ordenada de reglas por prioridad y campo `default` obligatorio
- Definir la estructura de una regla: identificador único, nombre legible, prioridad numérica, árbol de condiciones y acción
- Definir los dos tipos de condición: condición hoja (`field` + `op` + `value`) y agrupador lógico (`all`, `any`, `none`) con hijos anidables
- Definir los operadores soportados en el MVP: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `between`, `in`, `not_in`
- Definir la estructura de una acción: `decision` (string) y `reason` (string) — ambos obligatorios
- Definir el campo `default` como acción de fallback obligatoria cuando ninguna regla aplica

**Ideas de diseño:**
- Las variables del contexto son estrictamente planas en el MVP: `score`, no `customer.score`. El soporte de paths anidados es post-MVP explícitamente planificado
- El `reason` en la acción es tan importante como la `decision` — es lo que hace que el audit trail sea explicable y que los mensajes de error sean útiles para el usuario final
- La prioridad numérica es explícita por campo, no inferida por el orden de inserción. El mismo ruleset debe producir el mismo orden de evaluación sin importar cómo llegó a la DB
- El campo `default` es obligatorio. Un ruleset sin fallback puede generar silencio en producción ante contextos inesperados
- El DSL vive en la DB como JSON. Es generado por la SPA y nunca escrito a mano por el usuario

---

### Validador del DSL `[MVP]`

**Qué es:** El componente que recibe un ruleset en JSON y verifica que cumple la gramática del DSL antes de guardarlo en la DB o evaluarlo.

**Por qué existe:** Es el portero del sistema. Sin validación, un ruleset malformado llegaría al evaluador y produciría comportamiento indefinido, errores silenciosos o decisiones incorrectas en producción.

**Responsabilidades:**
- Verificar que todos los campos obligatorios están presentes en el ruleset, en cada regla y en cada condición
- Verificar que los operadores usados pertenecen a la lista de operadores soportados en la versión actual
- Verificar que los tipos de los valores son consistentes con el operador (`gt` requiere número, `contains` requiere string)
- Rechazar rulesets con profundidad de anidamiento que supere el límite estático definido
- Verificar que el campo `default` está presente y es estructuralmente válido
- Retornar errores descriptivos que indiquen exactamente qué campo falla, el valor recibido y el valor esperado

**Ideas de diseño:**
- El mensaje de error debe ser accionable: campo exacto, valor recibido y valores válidos esperados. Un error genérico no ayuda al builder a mostrar retroalimentación útil
- El límite de profundidad máxima previene rulesets que consumirían recursos desproporcionados en evaluación — es más barato detectarlo aquí que degradar el rendimiento en el evaluador
- El validador es usado por dos partes del sistema con el mismo contrato: la API antes de persistir un ruleset, y la SPA antes de enviarlo a la API. Compartir la misma lógica garantiza que nunca llegue a la DB un ruleset que la UI no habría aceptado

---

### Rule Evaluator `[MVP]`

**Qué es:** El motor central de Ruppert. Recibe un ruleset en su estructura interna y un contexto con datos concretos, los recorre y produce una decisión con trazabilidad completa.

**Por qué existe:** Es el corazón matemático del sistema. Todo lo demás — la SPA, la API, el audit trail — es infraestructura alrededor de este módulo. Su corrección y velocidad determinan la calidad del producto.

**Responsabilidades:**
- Recorrer las reglas en orden de prioridad ascendente
- Evaluar el árbol de condiciones de cada regla contra los valores del contexto de forma recursiva
- Aplicar la lógica de los agrupadores: `all` requiere que todos los hijos sean verdaderos, `any` solo uno, `none` ninguno
- Aplicar short-circuit evaluation: `all` detiene en el primer `false`, `any` detiene en el primer `true`
- Retornar la decisión y razón de la primera regla que se cumple, sin evaluar las reglas restantes
- Retornar la acción del campo `default` si ninguna regla se cumple
- Registrar la traza completa: resultado de cada nodo evaluado en el árbol y cuál fue el nodo determinante

**Ideas de diseño:**
- El evaluador es una función pura: recibe datos, devuelve datos, sin efectos secundarios ni acceso a ningún sistema externo. Esto garantiza que sea completamente testeable en aislamiento y que su comportamiento sea determinista
- Una variable no presente en el contexto se trata como condición `false` con advertencia en la traza, no como error fatal. El sistema sigue funcionando aunque el contexto esté incompleto
- La traza es parte del contrato de salida del evaluador, no un efecto secundario. Es lo que permite al Rule Tester colorear los nodos y lo que hace que el audit trail sea explicable a nivel granular
- La latencia objetivo del evaluador aislado es de microsegundos para rulesets de tamaño razonable. La latencia del sistema completo (incluyendo caché, API key y audit asíncrono) es menor a 50 ms en el percentil 95

---

### Audit Trail `[MVP]`

**Qué es:** El registro inmutable de cada evaluación realizada, con todos los detalles necesarios para reproducirla o explicarla ante un regulador, un cliente o el propio equipo de negocio.

**Por qué existe:** En industrias reguladas como fintech y seguros, las empresas necesitan poder responder "¿por qué se tomó esta decisión el día X a las 10:32am?" con precisión y evidencia. Es un requisito operativo indispensable, no una feature de conveniencia.

**Responsabilidades:**
- Registrar cada evaluación con: tenant, ruleset evaluado, versión exacta activa, timestamp preciso, contexto completo recibido, decisión, razón, regla activada, traza de evaluación y latencia
- Garantizar que los registros son append-only: nunca se modifican ni eliminan
- Ejecutar el registro de forma asíncrona respecto a la evaluación, para no impactar la latencia de respuesta HTTP
- Proporcionar resilencia ante fallos transitorios de escritura: un fallo temporal no debe resultar en un registro perdido
- Indexar los registros por tenant para garantizar aislamiento total en las consultas

**Ideas de diseño:**
- El contexto se almacena tal como llegó, sin transformar. Esto permite reproducir la evaluación exacta si es necesario verificar el comportamiento del sistema en un momento específico
- Un log almacenado en la misma base de datos relacional del sistema no es legalmente inmutable — un administrador puede modificar registros. Para que el audit trail sea defendible en un contexto regulatorio, se necesita al menos uno de dos mecanismos: firmado criptográfico por registro (cada entrada incluye una firma verificable encadenada) o almacenamiento con object lock en infraestructura que garantiza WORM (Write Once Read Many)
- La retención de registros varía según el plan: 30 días en Free, 6 meses en Starter, 2 años en Growth, configurable en Enterprise
- El audit trail en DB es el dato crudo. Lo que el equipo de negocio ve en la SPA es una interfaz que formatea ese dato de forma legible y navegable

---

## Capa 2 — Infraestructura y seguridad

Módulos que hacen que el sistema sea seguro, justo y operable en un entorno real con múltiples clientes compartiendo la misma infraestructura.

---

### Multi-tenancy `[MVP]`

**Qué es:** La arquitectura que garantiza que múltiples clientes usen la misma infraestructura de Ruppert de forma completamente aislada entre sí.

**Por qué existe:** Cada cliente de Ruppert es un tenant independiente. Sus rulesets, evaluaciones, audit logs y configuraciones no deben ser visibles ni accesibles desde otros tenants, bajo ninguna circunstancia ni escenario de error.

**Responsabilidades:**
- Asegurar que todas las queries a la DB están filtradas por `tenant_id` en todo momento, sin excepción
- Garantizar que un cliente nunca pueda acceder a datos de otro, ni por error de programación ni intencionalmente
- Aislar los contadores de uso y los límites del plan por tenant
- Propagar el `tenant_id` como contexto del request a todas las capas del sistema

**Ideas de diseño:**
- El `tenant_id` es parte de los índices de todas las tablas core desde el diseño inicial — agregarlo después rompe migraciones y es una fuente común de errores de seguridad
- Los errores 404 son idénticos tanto si el recurso no existe como si existe pero pertenece a otro tenant. Nunca se revela la existencia de recursos ajenos mediante mensajes de error distintos
- Row-Level Security (RLS) en la DB como segunda capa de defensa: las queries que omitan el filtro de tenant por error de programación son rechazadas directamente por el motor de base de datos, no solo por el código de aplicación

---

### Auth por API key `[MVP]`

**Qué es:** El mecanismo de autenticación para sistemas externos que consumen la API de evaluación.

**Por qué existe:** La API necesita identificar quién hace cada request para cargar las reglas correctas, aplicar los límites del plan y registrar las evaluaciones bajo el tenant correcto.

**Responsabilidades:**
- Generar API keys con formato identificable y prefijo legible: `ruppert_live_` para producción, `ruppert_test_` para entornos de prueba
- Validar la key en cada request antes de cualquier otra lógica
- Derivar el tenant de la key en el momento de validación — el tenant nunca viaja por separado en el body ni en la URL
- Permitir múltiples keys activas simultáneamente por tenant
- Revocar cualquier key individual sin afectar a las demás activas
- Diferenciar el comportamiento entre keys de producción (generan cargo en billing) y keys de test (comportamiento idéntico pero sin cargo ni conteo mensual)

**Ideas de diseño:**
- Las API keys nunca se almacenan en texto plano, solo su hash. El tenant es responsable de guardar el valor original al momento de creación — Ruppert no puede mostrarlo después
- La SPA usa autenticación por sesión propia (email/contraseña u OAuth). Las API keys son exclusivamente para sistemas externos. Comprometer la sesión de un usuario de la SPA no expone las API keys, y viceversa

---

### Caché de rulesets e invalidación `[MVP]`

**Qué es:** Sistema que mantiene los rulesets activos en memoria para servir evaluaciones sin consultar la DB en cada request.

**Por qué existe:** Los rulesets cambian raramente pero se leen en cada evaluación, que puede ocurrir cientos o miles de veces por minuto. Sin caché, cada evaluación requeriría un round-trip a la DB, introduciendo latencia innecesaria y carga sostenida.

**Responsabilidades:**
- Mantener los rulesets activos de cada tenant en caché, en su estructura ya procesada y lista para evaluar (no el JSON crudo)
- Invalidar el caché del tenant de forma inmediata cuando se publica una nueva versión
- Garantizar que evaluaciones en vuelo durante un reload completan con la versión que iniciaron
- Aislar la invalidación por tenant: publicar un ruleset de un tenant no afecta el caché de los demás

**Ideas de diseño:**
- La invalidación debe ser push (al publicar), no pull (TTL). Un TTL de cinco minutos implicaría que evaluaciones pueden usar una versión desactualizada — inaceptable cuando la SPA le dice al usuario que el cambio "entra en efecto de inmediato"
- Si la API corre en instancia única (MVP), el caché en memoria local del proceso es válido. Si corre en múltiples instancias, el caché en memoria local de cada proceso es independiente — una instancia puede servir versiones diferentes del mismo ruleset. La solución es un caché compartido externo (Redis) con un mecanismo de publicación de eventos que notifique a todas las instancias simultáneamente. Este punto debe documentarse como deuda técnica conocida del MVP

---

### Rate Limiting `[MVP]`

**Qué es:** El sistema que controla cuántas evaluaciones puede hacer cada tenant en una ventana de tiempo, según su plan.

**Por qué existe:** Protege la infraestructura de Ruppert de uso abusivo o bugs en el código del cliente que generen loops de requests. También hace cumplir los límites del plan contratado.

**Responsabilidades:**
- Controlar el número de evaluaciones por tenant en dos ventanas simultáneas: por minuto (contra abuso puntual) y por período mensual (contra el límite del plan)
- Retornar `429 Too Many Requests` con headers estándar (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) cuando se supera el límite
- Diferenciar el límite según el plan del tenant
- No bloquear evaluaciones con keys de test en el límite mensual (sí en el límite por minuto)

**Ideas de diseño:**
- El rate limiting debe vivir en Redis para ser efectivo en entornos con múltiples instancias. Un contador en memoria local de un proceso no tiene visibilidad de los requests que procesan las otras instancias
- Los headers de respuesta informan siempre el estado: límite total, consumido y tiempo hasta reset. Un cliente limitado nunca debe quedar a ciegas sobre su situación
- Las keys de test comparten el límite por minuto con las de producción — para que el comportamiento en testing sea representativo del de producción

---

### Gestión de versiones de rulesets `[MVP]`

**Qué es:** El sistema que permite al tenant publicar nuevas versiones de sus rulesets, ver el historial completo de cambios y hacer rollback a cualquier versión anterior.

**Por qué existe:** Las reglas de negocio cambian frecuentemente. Sin versionado, cada cambio es destructivo: no hay forma de saber qué estaba activo antes ni de revertir si algo sale mal en producción.

**Responsabilidades:**
- Mantener el historial completo e inmutable de versiones por ruleset
- Gestionar tres estados posibles por versión: Borrador (en edición, no afecta producción), Publicado (activo, recibe evaluaciones reales) y Archivado (versión anterior, consultable)
- Garantizar que solo existe una versión Publicada a la vez por ruleset
- Publicar un borrador: archivar la versión anterior y activar la nueva de forma inmediata
- Permitir rollback a cualquier versión archivada con confirmación explícita y efecto inmediato
- El historial es consultable con fecha de publicación y autor de cada versión

**Ideas de diseño:**
- La versión activa es siempre una referencia explícita — no se asume que la más reciente es la activa
- Publicar y hacer rollback tienen efecto inmediato en producción via invalidación del caché. La UI debe comunicarlo con claridad para que el tenant no publique por accidente
- El rollback no requiere intervención del developer — el equipo de negocio puede revertir un error de lógica en producción de forma autónoma

---

## Capa 3 — Interfaz (SPA)

Módulos que conforman la experiencia visual del producto. Son la interfaz entre el sistema técnico y el usuario de negocio.

---

### Gestión de rulesets `[MVP]`

**Qué es:** La pantalla principal de la SPA que lista todos los rulesets del tenant y permite crearlos, organizarlos y navegar a cada uno.

**Por qué existe:** Un tenant puede tener múltiples rulesets para distintos casos de uso. Necesita poder identificar cuál está activo, cuál tiene cambios pendientes y navegar entre ellos sin confusión.

**Responsabilidades:**
- Listar todos los rulesets del tenant con nombre, estado (publicado / con borrador pendiente / archivado) y fecha de última modificación
- Crear un nuevo ruleset vacío o a partir de un template de caso de uso real
- Renombrar y archivar rulesets
- Acceder al historial de versiones y al estado de publicación desde el listado

**Ideas de diseño:**
- El estado de cada ruleset debe ser lo más visible del listado. El tenant necesita saber de un vistazo cuál está activo y cuál tiene cambios sin publicar
- El estado vacío (sin rulesets) guía activamente hacia crear el primero con templates de casos de uso reales. Un analista nuevo no debería enfrentarse a una pantalla en blanco como primera experiencia
- Los templates deben reflejar la jerga y los casos de uso de la industria local: aprobación de crédito, elegibilidad de seguro, clasificación de fraude — con nombres y campos en español

---

### DSL Builder visual `[MVP]`

**Qué es:** El editor de reglas. El tenant construye y modifica su lógica de decisiones desde aquí, sin escribir código ni JSON. Es el diferenciador más importante del producto.

**Por qué existe:** Si el equipo de negocio necesita pedirle a un developer que configure algo o entienda el JSON para poder usar el sistema, Ruppert no resuelve el problema que promete resolver. El builder es donde la propuesta de valor se hace real o se derrumba.

**Responsabilidades:**
- Crear reglas con nombre, prioridad, condiciones y acción (decisión + razón)
- Soportar condiciones simples: seleccionar campo del contexto, operador y valor a comparar
- Soportar condiciones compuestas con agrupadores lógicos `all`, `any` y `none`, anidables entre sí
- Mostrar el árbol de condiciones de cada regla de forma visual, jerárquica y navegable
- Validar las condiciones en tiempo real antes de guardar, usando la misma lógica del validador del DSL
- Serializar el estado de la UI al JSON del DSL internamente — el usuario nunca ve este JSON
- Permitir reordenar reglas por arrastrar para cambiar su prioridad de evaluación
- Colapsar y expandir nodos del árbol para navegar rulesets complejos sin perderse

**Ideas de diseño:**
- La UX debe estar diseñada para un analista de riesgo, no para un developer: labels en español, operadores con nombres comprensibles ("es mayor que", "está en la lista") en lugar de sus nombres internos (`gt`, `in`), sin jerga técnica ni estados confusos
- El campo `reason` de cada acción es obligatorio y prominente — no un campo opcional escondido al final del formulario
- Los nombres de los campos del contexto (`score`, `debts`) se escriben a mano en el MVP. En post-MVP podrían autocompletarse desde el historial de contextos recibidos, eliminando errores tipográficos
- La serialización bidireccional (UI → JSON → UI) es el núcleo técnico del builder: debe poder reconstruir la interfaz a partir de un JSON existente para permitir edición de versiones guardadas

---

### Rule Tester `[MVP]`

**Qué es:** El panel integrado en el builder que permite simular una evaluación con datos de prueba y ver la traza visual del resultado, antes de publicar cualquier cambio.

**Por qué existe:** Sin tester, la única forma de validar que una regla funciona correctamente es publicarla y esperar evaluaciones reales de producción. Eso convierte cada cambio en un experimento con consecuencias reales. El Rule Tester elimina ese riesgo.

**Responsabilidades:**
- Permitir ingresar un contexto de prueba como pares campo-valor desde la interfaz, sin escribir JSON
- Evaluar el borrador actual con ese contexto usando exactamente el mismo evaluador que producción
- Mostrar la decisión y la razón resultante de forma prominente
- Colorear cada nodo del árbol de condiciones: verde (condición cumplida) o rojo (condición no cumplida)
- Destacar visualmente el nodo determinante de la decisión
- Permitir guardar casos de prueba con nombre para re-ejecutarlos en futuras iteraciones del ruleset

**Ideas de diseño:**
- La visualización de la traza sobre el árbol es el diferenciador clave del tester. Un resultado "rechazado" sin contexto visual de por qué no es suficiente para que un analista entienda si el comportamiento es correcto
- El tester usa exactamente el mismo evaluador que producción — no una simulación aproximada. El comportamiento es garantizadamente idéntico
- El contexto de prueba puede pre-llenarse automáticamente con los campos referenciados en las condiciones del ruleset actual, para reducir el trabajo manual de ingreso y el riesgo de errores tipográficos
- Los casos de prueba guardados son equivalentes a tests de regresión pero sin código: el equipo puede reutilizarlos cada vez que modifica el ruleset

---

### Historial de evaluaciones `[MVP]`

**Qué es:** La pantalla donde el tenant puede explorar todas las evaluaciones realizadas contra sus rulesets, con filtros y detalle completo de cada una.

**Por qué existe:** El equipo de negocio necesita poder auditar decisiones pasadas, tanto para debugging propio como para responder preguntas de compliance y clientes sin depender del equipo de tecnología.

**Responsabilidades:**
- Listar evaluaciones con fecha, ruleset evaluado, decisión, razón y latencia
- Filtrar por ruleset, decisión, razón y rango de fechas
- Mostrar el detalle completo al abrir una evaluación: contexto enviado y traza de la decisión en formato legible (no JSON crudo)
- Paginar correctamente para tenants con alto volumen de evaluaciones, con performance aceptable incluso con millones de registros

**Ideas de diseño:**
- La decisión y la razón son los datos más prominentes en el listado — son lo que el equipo busca cuando audita
- El detalle de una evaluación debe ser comprensible para cualquier persona del equipo de negocio sin asistencia técnica
- Esta pantalla es la interfaz de compliance: cuando un regulador pregunta "¿por qué se rechazó esta solicitud?", la respuesta debe estar aquí, completa, sin necesitar a tecnología

---

### Métricas por tenant `[MVP]`

**Qué es:** El dashboard de visibilidad operativa del tenant sobre el comportamiento de sus rulesets y su consumo del plan.

**Por qué existe:** Sin métricas, el tenant no sabe qué reglas se disparan más, cuál es la distribución de decisiones, cómo evoluciona el volumen ni cuánto le falta para alcanzar el límite de su plan.

**Responsabilidades:**
- Mostrar evaluaciones totales en el período actual y su tendencia
- Mostrar distribución de decisiones por ruleset (cuántas aprobadas, rechazadas, etc.)
- Mostrar las reglas más frecuentemente activadas
- Mostrar latencia media y percentil 95
- Mostrar consumo actual respecto al límite del plan de forma clara y prominente

**Ideas de diseño:**
- Las métricas no necesitan ser en tiempo real estricto — actualizarse cada pocos minutos es suficiente para el caso de uso
- El consumo visible debe coincidir exactamente con el que usa el sistema de billing para generar la factura. Si divergen, el tenant pierde confianza en los números
- Las métricas son navegables por ruleset individual y agregadas para todo el tenant

---

### Gestión de API keys (SPA) `[MVP]`

**Qué es:** La sección de la SPA donde el tenant crea, visualiza y revoca las credenciales que usan sus sistemas externos para consumir la API.

**Por qué existe:** Los sistemas externos del cliente necesitan autenticarse con la API. El tenant debe poder gestionar esas credenciales de forma segura y autónoma, sin depender de soporte.

**Responsabilidades:**
- Crear nuevas API keys de producción o test con un nombre descriptivo
- Mostrar el valor completo de la key solo en el momento de creación, con advertencia explícita de que no puede recuperarse después
- Listar keys activas con nombre, tipo (live/test), fecha de creación y últimos caracteres visibles para identificación
- Revocar cualquier key individual sin afectar a las demás activas

**Ideas de diseño:**
- El valor completo de la key solo es visible una vez, inmediatamente después de crearla. La UI debe comunicarlo con suficiente énfasis para que no sea una sorpresa
- Revocar una key es destructivo e irreversible — cualquier sistema que la usara deja de poder autenticarse de inmediato. La confirmación debe comunicar el impacto con claridad
- El tenant puede tener múltiples keys activas simultáneamente para permitir rotación de credenciales sin downtime: crear la nueva, actualizar el sistema que la usa, revocar la anterior

---

## Capa 4 — API pública y operaciones

Módulos que hacen que Ruppert sea consumible como servicio real por sistemas externos.

---

### REST API pública `[MVP]`

**Qué es:** La interfaz HTTP que expone la evaluación de reglas a sistemas externos. Es el producto para los developers que integran Ruppert en sus sistemas.

**Por qué existe:** Es la razón técnica por la que Ruppert tiene valor más allá de la SPA. Un developer que integra la API una sola vez habilita a su empresa a operar la lógica de negocio de forma autónoma para siempre.

**Responsabilidades:**

Endpoint de evaluación:
- `POST /v1/evaluate` — evalúa un contexto JSON contra el ruleset activo del tenant y retorna decisión, razón, regla activada, traza y latencia

Endpoints de gestión de rulesets (para flujos de CI/CD y uso programático):
- `POST /v1/rulesets` — crea un nuevo ruleset en estado borrador
- `GET /v1/rulesets` — lista los rulesets del tenant
- `GET /v1/rulesets/:id` — retorna el ruleset completo con su versión activa
- `PUT /v1/rulesets/:id` — actualiza el contenido del ruleset (crea borrador)
- `POST /v1/rulesets/:id/publish` — publica el borrador activo como nueva versión en producción
- `POST /v1/rulesets/:id/rollback` — revierte a una versión anterior especificada

Manejo de errores:
- Estructura de error unificada en todos los endpoints: `{ error, message, details? }`
- Códigos HTTP estándar: `401` key inválida, `404` recurso no encontrado, `422` payload inválido, `429` límite excedido

**Ideas de diseño:**
- El contrato de error es idéntico en todos los endpoints. La inconsistencia en errores es la mayor fuente de fricción para quien integra — obliga a escribir lógica de manejo diferente para cada endpoint
- Versioning desde el día uno con `/v1/` aunque sea la única versión. Agregarlo retroactivamente a una API con clientes integrados es disruptivo
- Paginación cursor-based en endpoints de listado, no offset-based. Los offsets generan resultados inconsistentes en listas que cambian mientras se pagina

---

### Registro y onboarding self-service `[MVP]`

**Qué es:** El flujo que convierte a un visitante nuevo en un tenant activo con su primera API key y la SPA lista para usar, sin intervención manual de nadie en Ruppert.

**Por qué existe:** La primera experiencia determina si el usuario va a adoptar el producto. Un onboarding largo o confuso es suficiente para perderlo antes de que vea el valor real.

**Responsabilidades:**
- Registro con email/contraseña u OAuth (GitHub o Google)
- Confirmación de email con activación del tenant
- Creación automática del tenant, workspace y primera API key de test al confirmar
- Pre-carga de un ruleset de ejemplo funcional (caso de uso real, no abstracto)
- Email de bienvenida con la API key y un snippet de curl listo para copiar y ejecutar
- Pantalla inicial con el endpoint visible y el snippet de la primera evaluación, sin pantallas en blanco

**Ideas de diseño:**
- El objetivo es que el developer haga su primera evaluación exitosa en menos de cinco minutos desde el registro
- El ruleset de ejemplo debe ser de un caso de uso real (aprobación de crédito básica o elegibilidad), con condiciones, prioridades y acción por defecto ya configuradas. No un ejemplo abstracto o genérico
- El estado vacío de la SPA guía activamente hacia el primer paso — nunca muestra una interfaz sin dirección

---

### Billing por evaluaciones `[MVP]`

**Qué es:** El sistema que cuenta las evaluaciones por tenant y gestiona la facturación automática según el plan contratado.

**Por qué existe:** El modelo de negocio de Ruppert es pricing por uso. Sin billing confiable y transparente no hay negocio sostenible.

**Responsabilidades:**
- Contar cada evaluación de producción por tenant de forma atómica, sin pérdidas ni duplicados
- No contar evaluaciones con keys de test contra el límite mensual ni generar cargo por ellas
- Alertar al tenant por email y banner en la SPA al alcanzar el 80% del límite del plan
- Bloquear evaluaciones de producción al superar el límite del plan gratuito y dirigir al upgrade
- Gestionar planes y suscripciones via Stripe con facturación automática al final del período
- Mostrar consumo actual en tiempo real desde el dashboard, coincidiendo exactamente con el número de billing

**Ideas de diseño:**
- El contador de evaluaciones es atómico e independiente del audit trail. Son dos sistemas con propósitos distintos: uno para compliance, uno para facturación. Combinarlos crearía un acoplamiento frágil
- La estructura de planes: Free (10,000 eval/mes, 30 días retención), Starter (100,000 eval/mes, 6 meses retención, precio fijo), Growth (1,000,000 eval/mes, 2 años retención, fijo + por evaluación adicional), Enterprise (sin límite, retención configurable, precio negociado)
- Si el consumo visible en la SPA y la factura generada por Stripe divergen, el tenant pierde confianza en los números — deben derivar de la misma fuente

---

## Capa 5 — Expansión del producto

Estos módulos amplían las capacidades de Ruppert más allá del núcleo inicial. Están planificados y las decisiones de arquitectura del MVP deben tenerlos en cuenta para no bloquearlos, pero no se implementan en la primera versión.

---

### Variables de contexto anidadas `[POST-MVP]`

**Qué es:** Soporte para referencias a campos anidados en el contexto enviado a la API: `customer.score`, `loan.requested_amount`, `applicant.address.country`.

**Por qué existe:** En el MVP el contexto es estrictamente plano. Muchos sistemas del cliente envían objetos JSON con estructura anidada y necesitan aplanarlos antes de llamar a la API, lo cual es trabajo adicional innecesario que genera fricción en la integración.

**Ideas de diseño:**
- La extensión requiere un parser de paths en el evaluador y cambios en el builder para permitir ingresar campos con notación de punto
- El DSL debe actualizarse para distinguir entre campos planos y paths anidados, o adoptar una notación uniforme que cubra ambos

---

### Decision Tables `[POST-MVP]`

**Qué es:** Una interfaz alternativa al builder de árbol, con formato de tabla tipo spreadsheet donde cada fila es una regla y cada columna es una condición o el resultado.

**Por qué existe:** Para reglas simples con muchas combinaciones de valores (tablas de tarifas por segmento, matrices de elegibilidad por zona geográfica y edad), el formato de tabla es mucho más legible y editable que el árbol de nodos.

**Ideas de diseño:**
- Las decision tables son representaciones alternativas del mismo DSL interno — el evaluador no cambia, solo la UI de edición
- Especialmente útiles para casos de uso de pricing y elegibilidad con muchas variantes
- El mismo ruleset podría tener dos vistas intercambiables: árbol y tabla, según la preferencia del usuario

---

### Múltiples rulesets en una evaluación (Chaining) `[POST-MVP]`

**Qué es:** La capacidad de evaluar más de un ruleset en una sola llamada a la API y recibir todas las decisiones en una respuesta.

**Por qué existe:** Algunos flujos de decisión requieren consultar múltiples conjuntos de reglas independientes simultáneamente: elegibilidad + scoring + fraude + KYC. Hacerlo en una sola llamada reduce latencia y simplifica el código del cliente.

**Ideas de diseño:**
- Los rulesets se evalúan en paralelo (son independientes entre sí) o en secuencia si hay dependencias entre sus resultados
- La respuesta agrupa las decisiones por ruleset con la misma estructura que una evaluación individual
- El audit trail registra cada evaluación del batch de forma independiente

---

### Webhooks por decisión `[POST-MVP]`

**Qué es:** Sistema de notificaciones que avisa al sistema del cliente cuando una evaluación produce una decisión específica, de forma asíncrona.

**Por qué existe:** No todos los flujos de negocio son síncronos. A veces otros sistemas necesitan reaccionar automáticamente a ciertas decisiones sin tener que consultar la API de forma activa.

**Ideas de diseño:**
- Los webhooks son completamente asíncronos — nunca bloquean ni retrasan la respuesta del endpoint `/evaluate`
- El payload incluye firma HMAC para que el cliente pueda verificar que el webhook es legítimo y no fue manipulado
- Implementar como cola interna: la evaluación encola el webhook, un worker lo procesa y entrega con backoff exponencial en caso de fallo
- La arquitectura base de cola puede diseñarse en el MVP para facilitar la activación posterior

---

### Distributed Rate Limiting `[POST-MVP]`

**Qué es:** Rate limiting avanzado basado en ventanas deslizantes sobre Redis para arquitecturas multi-instancia distribuidas, reemplazando al rate limiting básico del MVP.

**Por qué existe:** El rate limiting básico del MVP funciona correctamente para un servicio con instancias limitadas. Al escalar a arquitecturas distribuidas con decenas de instancias, se necesita un mecanismo más preciso y eficiente.

**Ideas de diseño:**
- Algoritmo de ventana deslizante (sliding window) en lugar de ventana fija, para evitar el efecto de doble carga al inicio de cada período
- Implementado sobre Redis con operaciones atómicas para garantizar consistencia entre instancias

---

### AI-assisted rule authoring `[POST-MVP]`

**Qué es:** Asistencia de IA dentro del builder para generar reglas a partir de descripciones en lenguaje natural.

**Por qué existe:** Aunque el builder visual es accesible para un analista sin contexto técnico, la barrera de pensar en términos de condiciones lógicas formales sigue siendo real para algunos usuarios. La IA puede traducir la intención del analista a la estructura formal del DSL.

**Ideas de diseño:**
- El usuario describe la regla en lenguaje natural: "rechazar si el cliente tiene más de 3 deudas y un score menor a 600". Ruppert genera la estructura de condiciones correspondiente para que el usuario revise y confirme
- La IA propone, el usuario confirma. El equipo de negocio mantiene control total sobre la regla final — nunca se publica nada sin revisión explícita
- La regla generada pasa siempre por el validador del DSL antes de mostrarse en el builder
- Es especialmente útil para usuarios nuevos que aún no tienen el modelo mental de condiciones lógicas interiorizado

---

### Self-hosting `[POST-MVP]`

**Qué es:** La posibilidad de desplegar Ruppert en la infraestructura propia del cliente (VPC, on-premise, Kubernetes).

**Por qué existe:** Empresas con regulaciones estrictas sobre dónde pueden residir sus datos (datos financieros, PII) no pueden usar la versión cloud de Ruppert. El self-hosting les permite mantener los datos dentro de su propia infraestructura.

**Ideas de diseño:**
- Aplica principalmente a empresas enterprise con requisitos regulatorios de residencia de datos
- El modelo de licencia para self-hosting es diferente al modelo SaaS por evaluaciones — generalmente una licencia anual por instancia o por número de tenants
- El sistema de billing externo (Stripe) no aplica en self-hosting; la gestión de licencias es separada

---

### SSO / SAML `[POST-MVP]`

**Qué es:** Integración con proveedores de identidad corporativos (Azure AD, Okta) para que los usuarios de grandes empresas accedan a la SPA con sus credenciales corporativas.

**Por qué existe:** Empresas enterprise requieren SSO como condición para adoptar cualquier herramienta nueva. Sin SSO, Ruppert queda fuera de su proceso de evaluación independientemente de sus méritos técnicos.

**Ideas de diseño:**
- Soportar el estándar SAML 2.0 y OIDC para compatibilidad con los proveedores más comunes (Okta, Azure AD, Google Workspace)
- La configuración de SSO por tenant debe poder hacerse desde la SPA sin intervención del equipo de Ruppert
- En modo SSO, la gestión de contraseñas y sesiones se delega completamente al proveedor de identidad del cliente