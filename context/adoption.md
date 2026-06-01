# Ruppert — Flujo de adopción

## Los dos roles del flujo

Ruppert tiene dos usuarios distintos con responsabilidades distintas. Entender esto es clave para entender el flujo.

**El developer** — Es el usuario de la integración técnica. Se registra, configura la cuenta, hace la primera evaluación exitosa y conecta la API al sistema del cliente. Una vez que la integración está hecha, su trabajo en Ruppert termina. No necesita volver a tocar nada a menos que quiera cambiar la integración técnica.

**El equipo de negocio** — Son los usuarios frecuentes. Analistas de riesgo, product managers, compliance officers. Nunca tocan código ni ven JSON. Crean reglas desde el builder visual, las prueban, las publican y monitorizan los resultados. Este es el ciclo diario de uso.

El flujo de adopción existe precisamente para transferir el control del developer al equipo de negocio de forma fluida y sin fricción.

---

## Fase 1 — Registro y primera impresión del developer

**Quién:** El developer

**Objetivo:** Que el developer entienda en minutos qué es Ruppert y tenga la confianza de que puede integrarlo.

**Qué ocurre:**
- El developer se registra con email y contraseña (u OAuth con GitHub o Google) desde la SPA
- Se crea automáticamente un tenant a su nombre con configuración base
- La cuenta se pre-carga con un ruleset de ejemplo funcional — no una pantalla vacía. El ejemplo usa un caso de uso real (aprobación de crédito básica) con condiciones, prioridades y acción por defecto ya configuradas
- La SPA muestra prominentemente la primera API key de test generada y el endpoint de evaluación listo para copiar
- Se envía un email de bienvenida con la API key y un ejemplo de llamada a `/evaluate` listo para ejecutar desde la terminal

**Resultado esperado:** El developer entiende el modelo mental del producto (rulesets → evaluación → decisión) antes de tocar una sola línea de código.

---

## Fase 2 — Primera evaluación exitosa en menos de 5 minutos

**Quién:** El developer

**Objetivo:** El primer "funciona" debe ocurrir lo antes posible. La experiencia de integración inicial es determinante para que el developer la complete y no la abandone.

**Qué ocurre:**
- La SPA muestra un snippet de ejemplo listo para copiar con la API key de test, el endpoint correcto y un contexto de prueba compatible con el ruleset de ejemplo pre-cargado
- El developer ejecuta el request desde su terminal o desde Postman — un `curl` o una petición HTTP simple
- La API responde con la decisión, la razón, la regla activada y la latencia
- La primera evaluación aparece en el historial de la SPA en tiempo real

**Resultado esperado:** El developer ve el sistema funcionando end-to-end antes de haber escrito ningún código de integración. Ese momento de "funciona" es lo que convierte la evaluación en una integración real.

Un developer que llega a este punto con éxito casi siempre completa la integración. Un developer que no llega aquí en los primeros minutos abandona.

---

## Fase 3 — Integración en el sistema del cliente

**Quién:** El developer

**Objetivo:** Conectar la API de Ruppert al sistema real del cliente para que las evaluaciones ocurran de forma automatizada.

**Qué ocurre:**
- El developer reemplaza la API key de test por la de producción (o genera una nueva)
- Identifica los puntos del sistema del cliente donde se necesita una decisión — por ejemplo, cuando un usuario completa una solicitud de crédito
- En esos puntos, agrega una llamada `POST /v1/evaluate` con el contexto relevante del caso: los campos que las reglas necesitarán evaluar (score, deudas, monto, etc.)
- Conecta la respuesta de Ruppert al flujo de decisión del sistema: si la `decision` es aprobada, avanzar; si es rechazada, mostrar el `reason` al usuario final

**Resultado esperado:** El sistema del cliente obtiene decisiones en tiempo real sin ninguna lógica de evaluación en su propio código. Toda la lógica vive en Ruppert.

**Tiempo estimado:** Horas, no días. La integración es una llamada HTTP simple. No hay SDK obligatorio, no hay configuración compleja, no hay webhooks ni callbacks requeridos.

---

## Fase 4 — Handoff al equipo de negocio

**Quién:** El developer (transfiere), el equipo de negocio (recibe)

**Objetivo:** Que el equipo de negocio tome el control de la SPA y entienda qué puede hacer desde ahí sin necesitar ayuda técnica.

**Qué ocurre:**
- El developer invita al equipo de negocio a la cuenta desde la SPA (gestión de usuarios)
- El developer explica brevemente el modelo: "Este ruleset es el que usa nuestro sistema. Cuando lo cambias y lo publicas, el cambio entra en efecto de inmediato en producción"
- El developer deja de ser necesario en el flujo diario

**Lo que el equipo de negocio recibe:**
- Acceso completo al builder visual para editar reglas
- El Rule Tester para verificar cambios antes de publicar
- El historial de evaluaciones para auditar decisiones pasadas
- Las métricas para entender el comportamiento de las reglas en producción

**Resultado esperado:** El equipo de negocio puede operar de forma completamente autónoma. El developer no es el cuello de botella para ningún cambio en la lógica de decisión.

---

## Fase 5 — Operación diaria del equipo de negocio

**Quién:** El equipo de negocio

**Objetivo:** Ciclo recurrente de modificación, validación y publicación de reglas sin fricción técnica.

### El ciclo estándar de un cambio de regla

**1. Identificar la necesidad de cambio**
El equipo detecta que una regla necesita ajuste — por ejemplo, el umbral de score para aprobación pasa de 600 a 650 porque los datos de morosidad cambiaron.

**2. Editar en el builder**
Abrir el ruleset en la SPA, modificar la condición afectada directamente en la interfaz visual. El cambio queda en estado borrador: no afecta producción todavía.

**3. Verificar con el Rule Tester**
Ingresar casos de prueba con los valores relevantes (score 640, score 660, casos borde) y verificar que el árbol de condiciones muestra verde/rojo en los nodos correctos.

**4. Publicar**
Confirmar la publicación desde la SPA. La nueva versión entra en efecto de forma inmediata en producción. Las evaluaciones siguientes ya usan el nuevo umbral.

**5. Monitorizar**
Revisar el historial de evaluaciones en los minutos siguientes para confirmar que el comportamiento es el esperado. Ver la distribución de decisiones en el dashboard para detectar cambios anómalos.

### El ciclo de auditoría

Cuando compliance o un cliente externo pregunta "¿por qué se tomó esta decisión el día X?":

- El equipo abre el historial de evaluaciones
- Filtra por fecha, ruleset o decisión según lo que busca
- Abre el detalle de la evaluación específica
- Ve el contexto exacto que tenía el caso en ese momento y la traza completa que derivó en la decisión

No hay que pedirle nada a tecnología para responder esa pregunta.

---

## Gestión del ciclo de vida de un ruleset

Un ruleset puede estar en tres estados. Entender los estados es esencial para operar sin miedo a cometer errores irreversibles.

**Borrador** — El estado de trabajo. Las modificaciones en el builder viven aquí. No afectan producción. Se puede iterar libremente.

**Publicado** — La versión activa que recibe evaluaciones reales. Solo hay una versión publicada a la vez. Publicar un borrador archiva la versión anterior y la nueva entra en efecto de inmediato.

**Archivado** — Versiones anteriores que ya no están activas. El historial completo es consultable y cualquier versión archivada puede restaurarse mediante rollback.

### Rollback

Si una versión publicada produce comportamiento inesperado en producción, el equipo puede hacer rollback a cualquier versión anterior con confirmación explícita. El cambio es inmediato. No requiere intervención del developer.

---

## Qué NO ocurre en este flujo

Es tan importante saber qué se elimina como saber qué se agrega.

- **No hay deploys** para cambiar una regla. El developer no toca código cuando el negocio ajusta un umbral.
- **No hay tickets ni aprobaciones técnicas** para que el equipo de negocio modifique sus propias reglas.
- **No hay JSON a mano** — el equipo de negocio nunca escribe ni lee la estructura interna del ruleset.
- **No hay pérdida de trazabilidad** — cada cambio queda versionado, cada evaluación queda registrada.
- **No hay dependencia operativa del developer** una vez que la integración inicial está hecha.

---

## Diagrama de responsabilidades por fase

| Fase | Responsable | Herramienta |
|------|-------------|-------------|
| Registro y configuración inicial | Developer | SPA |
| Primera evaluación | Developer | API (curl / Postman) |
| Integración en sistema del cliente | Developer | API (`POST /v1/evaluate`) |
| Gestión de API keys de producción | Developer | SPA — sección de API keys |
| Creación y edición de reglas | Equipo de negocio | SPA — builder visual |
| Verificación antes de publicar | Equipo de negocio | SPA — Rule Tester |
| Publicación y rollback | Equipo de negocio | SPA — gestión de versiones |
| Auditoría de decisiones pasadas | Equipo de negocio | SPA — historial de evaluaciones |
| Monitorización de métricas | Equipo de negocio | SPA — dashboard |