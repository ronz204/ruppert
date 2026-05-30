# Ruppert — Overview

## Qué es Ruppert

Ruppert es un motor de reglas de negocio como servicio (BRMS micro-SaaS). Permite a equipos de negocio definir su lógica de decisiones de forma visual desde una SPA, y evaluarla en tiempo real mediante una simple llamada HTTP, sin necesidad de tocar código ni hacer deploys.

El producto tiene dos partes que trabajan juntas: una **SPA** donde el tenant gestiona sus reglas con un builder visual, y una **API** que evalúa esas reglas cuando un sistema externo la consulta. JSON es el medio de transporte en toda la cadena — la SPA lo genera internamente, la API lo procesa, la DB lo almacena. El usuario de negocio nunca ve ni escribe JSON.

---

## El problema que resuelve

Cuando una empresa necesita implementar una regla de negocio — por ejemplo, "rechazar solicitud si el cliente tiene más de 3 deudas y un score menor a 600" — enfrenta dos opciones igualmente costosas:

**Opción A — hardcodear la lógica:** Un developer toca el código, pasa por revisión, staging y deploy. Un cambio simple puede tardar días o semanas. El equipo de negocio nunca puede moverse a su propia velocidad, y cada ajuste genera dependencia del área de tecnología.

**Opción B — construir su propio motor:** Requiere meses de ingeniería especializada en diseño de DSL, evaluación concurrente, versionado y auditoría. No es el core business de una fintech, una aseguradora o un equipo de onboarding.

Ruppert resuelve esto siendo la infraestructura compartida que cualquier empresa puede consumir: el equipo de negocio gestiona sus reglas desde la SPA sin tocar código, y los sistemas existentes consultan la API para obtener decisiones en tiempo real.

---

## Para quién es

Ruppert está orientado principalmente a empresas de la región latinoamericana en industrias donde las reglas de decisión cambian frecuentemente, necesitan trazabilidad regulatoria y son compartidas entre múltiples sistemas:

- **Fintechs** — reglas de aprobación de crédito, scoring, prevención de fraude, colecciones
- **Aseguradoras** — cotización de riesgo, validación de pólizas, exclusiones
- **Plataformas de onboarding B2B** — validaciones KYC, compliance, elegibilidad

El usuario primario dentro de cada empresa es el **equipo de negocio** (analistas de riesgo, product managers, compliance officers) que necesita cambiar reglas sin pasar por el equipo de tecnología. El **developer** es el usuario secundario que hace la integración inicial vía API y después se desentiende del flujo diario.

---

## Propuesta de valor

El valor de Ruppert no está en hacer algo imposible — cualquier developer puede escribir un `if/else`. El valor está en:

1. **Velocidad de cambio** — reglas que tardan días en modificarse pasan a cambiarse en segundos desde la SPA, sin tocar código ni hacer deploy
2. **Accesible para el equipo de negocio** — el builder visual elimina la necesidad de escribir JSON o código; cualquier persona puede crear y modificar reglas
3. **Fuente única de verdad** — múltiples sistemas consultan exactamente las mismas reglas en todo momento
4. **Trazabilidad automática** — cada evaluación queda registrada con qué regla se activó, qué valores tenía el contexto y qué decisión se tomó. Compliance listo sin trabajo extra
5. **Aislamiento multi-tenant** — cada cliente gestiona sus propias reglas de forma completamente independiente y segura

---

## Posicionamiento competitivo

El mercado de BRMS está dominado por dos tipos de soluciones: las enterprise (IBM ODM, FICO) que son complejas, caras y requieren meses de implementación, y las cloud-native modernas (GoRules, DecisionRules) que apuntan al mercado global angloparlante con un foco técnico-developer.

Ruppert compite en el espacio cloud-native con tres diferenciadores claros:

- **LatAm-first:** Diseñado para el contexto regulatorio y operacional de la región. Documentación, soporte y UX en español. Casos de uso orientados a los verticales que más crecen en LatAm (crédito, fraude, KYC).
- **Business-user genuinamente primero:** La mayoría de los competidores dicen "no-code" pero siguen requiriendo un developer para sacarle el jugo. El builder de Ruppert está diseñado para que un analista de riesgo sin contexto técnico pueda crear, probar y publicar una regla de forma autónoma.
- **Pricing que escala con el valor:** Modelo por evaluaciones. Las startups pequeñas pagan poco; las empresas grandes pagan más porque generan más valor. Sin licencias fijas que no se ajustan al crecimiento.

---

## Cómo funciona en términos generales

### El Ruleset
Es la definición de reglas que el tenant construye en la SPA usando el builder visual. El builder genera internamente la estructura JSON que Ruppert entiende — el tenant nunca ve ni escribe JSON directamente. Un ruleset puede tener múltiples reglas con condiciones anidadas, operadores lógicos y acciones con decisión y razón. Cada ruleset tiene versiones: el tenant puede publicar una nueva versión, ver el historial y hacer rollback a cualquier versión anterior.

### El Context
Son los datos del caso concreto a evaluar en tiempo real. El sistema externo del cliente los envía como JSON en cada llamada a la API — los valores relevantes para esa evaluación específica (score del cliente, número de deudas, monto solicitado, etc.).

### La Evaluación
Ruppert carga el ruleset activo del tenant desde caché, lo evalúa contra el contexto recibido y devuelve una decisión junto con la trazabilidad completa: qué regla se activó, por qué y en cuánto tiempo. Si ninguna regla se cumple, se aplica la decisión por defecto del ruleset.
