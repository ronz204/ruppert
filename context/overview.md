# Ruppert — Overview

## Qué es Ruppert

Ruppert es un motor de reglas de negocio como servicio (BRMS micro-SaaS). Permite a los equipos de negocio definir, probar y modificar su lógica de decisiones desde una interfaz visual, mientras que los sistemas técnicos externos la consumen en tiempo real mediante una simple llamada HTTP. No hay deploys. No hay tickets a tecnología. No hay dependencia del equipo de ingeniería para cambiar una regla.

El producto tiene dos partes que trabajan juntas: una **SPA** donde el tenant gestiona sus rulesets con un builder visual, y una **API** que los evalúa cuando un sistema externo la consulta. JSON es el medio de transporte en toda la cadena — la SPA lo genera internamente, la API lo procesa, la DB lo almacena. El usuario de negocio nunca ve ni escribe JSON.

---

## El problema que resuelve

Cuando una empresa necesita implementar o ajustar una regla operativa — por ejemplo, "rechazar solicitud si el cliente tiene más de 3 deudas y un score menor a 600" — enfrenta dos opciones igualmente costosas:

**Opción A — hardcodear la lógica:** Un developer toca el código, pasa por revisión, staging y deploy. Un cambio simple puede tardar días o semanas. El equipo de negocio nunca puede moverse a su propia velocidad; cada ajuste genera dependencia del área de tecnología.

**Opción B — construir su propio motor:** Requiere meses de ingeniería especializada en diseño de DSL, evaluación concurrente, versionado y auditoría. No es el core business de una fintech, una aseguradora o un equipo de onboarding.

Ruppert actúa como la infraestructura compartida que resuelve ambos problemas: el negocio gestiona la lógica de forma autónoma desde la SPA, y los sistemas existentes integran la API una sola vez.

---

## Para quién es

Ruppert está orientado principalmente a empresas latinoamericanas en industrias donde las reglas de decisión cambian frecuentemente, necesitan trazabilidad regulatoria y son compartidas entre múltiples sistemas:

- **Fintechs** — reglas de aprobación de crédito, scoring, prevención de fraude, colecciones
- **Aseguradoras** — cotización de riesgo, validación de pólizas, exclusiones
- **Plataformas de onboarding B2B** — validaciones KYC, compliance, elegibilidad

Dentro de cada empresa conviven dos perfiles de usuario con necesidades distintas. El **developer** hace la integración técnica inicial vía API y después se desentiende del flujo diario. El **equipo de negocio** (analistas de riesgo, product managers, compliance officers) opera la SPA de forma autónoma y recurrente: crea reglas, las prueba, las publica y audita sus resultados.

---

## Propuesta de valor

El valor de Ruppert no está en hacer algo imposible — cualquier developer puede escribir un `if/else`. El valor está en quién puede hacerlo y en cuánto tiempo:

1. **Velocidad de cambio** — reglas que tardan días en modificarse pasan a cambiarse en minutos desde la SPA, sin tocar código ni hacer deploy
2. **Accesible para el equipo de negocio** — el builder visual elimina la necesidad de escribir código; cualquier analista puede crear, probar y publicar reglas de forma autónoma
3. **Fuente única de verdad** — múltiples sistemas consultan exactamente las mismas reglas en todo momento
4. **Trazabilidad automática** — cada evaluación queda registrada con qué regla se activó, qué valores tenía el contexto y qué decisión se tomó. Compliance listo sin trabajo extra
5. **Aislamiento multi-tenant** — cada cliente gestiona sus propias reglas de forma completamente independiente y segura

---

## Posicionamiento competitivo

El mercado de BRMS está dominado por dos tipos de soluciones: las enterprise (IBM ODM, FICO) que son complejas, caras y requieren meses de implementación, y las cloud-native modernas (GoRules, DecisionRules) que apuntan al mercado global angloparlante con un foco técnico-developer.

Ruppert compite en el espacio cloud-native con tres diferenciadores claros:

**LatAm-first.** Diseñado para el contexto regulatorio y operacional de la región. Documentación, soporte y UX en español. Casos de uso orientados a los verticales que más crecen en LatAm: crédito, fraude, KYC. La interfaz y los templates hablan el idioma del analista de riesgo latinoamericano — no la jerga de ingeniería de software.

**Business-user genuinamente primero.** La mayoría de los competidores dicen "no-code" pero siguen requiriendo un developer para sacarle el jugo. El builder de Ruppert está diseñado para que un analista de riesgo sin contexto técnico pueda crear, probar y publicar una regla de forma completamente autónoma.

**Compliance como activo, no como feature secundaria.** Ruppert no se vende solo como herramienta de eficiencia operativa. Para los organismos reguladores de la región (CNBV, CMF, Superfinanciera), el sistema de registro inmutable de evaluaciones con traza completa convierte a Ruppert en el sistema central de cumplimiento — un activo que el oficial de compliance y el área legal no querrán perder.

---

## Cómo funciona en términos generales

### El Ruleset
Es la definición de reglas que el tenant construye en la SPA usando el builder visual. El builder genera internamente la estructura JSON que Ruppert entiende — el tenant nunca ve ni escribe JSON. Un ruleset puede tener múltiples reglas con condiciones anidadas, operadores lógicos y acciones con decisión y razón. Cada ruleset tiene versiones: el tenant puede publicar una nueva versión, ver el historial completo y hacer rollback a cualquier versión anterior.

### El Context
Son los datos del caso concreto a evaluar en tiempo real. El sistema externo del cliente los envía como JSON en cada llamada a la API — los valores relevantes para esa evaluación específica (score del cliente, número de deudas, monto solicitado, etc.).

### La Evaluación
Ruppert carga el ruleset activo del tenant desde caché, lo evalúa contra el contexto recibido y devuelve una decisión junto con la trazabilidad completa: qué regla se activó, por qué y en cuánto tiempo. Si ninguna regla se cumple, se aplica la decisión por defecto del ruleset. El resultado de cada evaluación queda registrado de forma inmutable en el audit trail.