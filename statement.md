# dockdi — approach.md

## Propósito

Librería de inyección de dependencias para TypeScript, type-first, basada en tokens explícitos (branded types) en lugar de decorators + `reflect-metadata`. El objetivo no es competir en features contra InversifyJS o NestJS, sino resolver mejor un problema puntual: que declarar y resolver dependencias en TS se sienta natural, seguro en compile-time, y sin gimnasia de tooling (sin tocar `tsconfig.json`, sin polyfills de `Reflect`).

## Dominio y modelo conceptual

- **Token\<T\>**: identificador tipado en runtime (un `Symbol` con un phantom type asociado) que representa "algo resoluble de tipo T". Es la unidad atómica de todo el sistema — no hay injection sin un token.
- **Container**: registro que mapea tokens a estrategias de resolución (`Binding`). Expone `bind`/`get` como superficie mínima.
- **Binding**: la estrategia concreta para satisfacer un token — instanciar una clase, ejecutar una factory, o devolver un valor constante.
- **Scope**: gobierna el ciclo de vida de una instancia resuelta (singleton, transient, y potencialmente resolution-scope inspirado en Brandi).
- **Composition root**: el único lugar de la aplicación consumidora donde se arman los bindings; el resto del código nunca debería importar el container directamente.
- **Constructor↔tokens mapping**: el problema de fondo del proyecto. Sin reflection, algo tiene que decirle al container qué token corresponde a cada parámetro del constructor. Este es el punto de diseño más importante de dockdi (ver Fase 0 y Riesgos).

## Invariantes

- Cero decorators, cero `reflect-metadata`, cero flags de `tsconfig.json` requeridos.
- Los tokens llevan el tipo solo en compile-time (phantom type) — costo runtime igual al de un `Symbol` plano.
- La resolución es síncrona por default; el soporte async es explícito y opt-in, nunca el camino implícito.
- Un ciclo de dependencias o un token faltante deben producir un error que muestre la cadena completa de resolución, no solo el punto de fallo.
- Cero dependencias de producción.
- Build dual ESM/CJS con `.d.ts` incluidos.

## Fuera de alcance (v1)

- Property injection — solo constructor injection.
- Integraciones con frameworks (Elysia, Express, etc.) — fase posterior, fuera de este approach.
- Cualquier forma de decorators, incluso opcional.
- Hierarchical/child containers — se evalúa si entra en v1 o se pospone según cómo salga la Fase 0.

## Roadmap fasado

**Fase 0 — Mecanismo central y validación**
Prototipar el branded token y un resolver mínimo sin reflection. Este es el punto crítico: definir cómo se asocia un constructor con sus tokens de forma que ataque el gap de `injected()` de Brandi (declaración separada, orden frágil). Validar el prototipo compilando y corriendo en Bun. Salida: decisión de diseño documentada, no código de producción todavía.

**Fase 1 — Core container mínimo**
`bind`/`get`, un solo scope (transient), errores básicos de token no encontrado. Sin scopes múltiples, sin async, sin nada más. Objetivo: un extremo a extremo funcionando.

**Fase 2 — Scopes**
Singleton y resolution-scope. Suite de tests por escenario de ciclo de vida (comparando instancias entre resoluciones).

**Fase 3 — DX de errores**
Detección de ciclos con cadena completa en el mensaje. Mensajes de token faltante con sugerencias (ej. tokens similares registrados). Este es un diferenciador declarado frente a la competencia — merece tiempo dedicado, no un afterthought.

**Fase 4 — Factories async**
Soporte opt-in de resolución async, sin romper el modelo síncrono por default.

**Fase 5 — Testing utilities**
Mecanismo de override/mock de bindings scoped a un test, evaluando si el `capture()/restore()` de Brandi es suficiente o si dockdi puede ofrecer algo más declarativo.

**Fase 6 — Empaquetado y publicación**
Build dual ESM/CJS, presupuesto de bundle size, documentación pública, publish a npm.

**Fase 7 (futuro, fuera de este approach) — Hierarchical containers e integraciones**
Child containers, y evaluar una integración nativa con Elysia una vez el core esté estable.

## Riesgos

- El mecanismo constructor↔tokens (Fase 0) podría no tener una solución genuinamente mejor que la de Brandi sin caer en decorators — si eso pasa, dockdi corre el riesgo real de terminar siendo "otro Brandi" sin diferenciación.
- Los branded types pueden producir errores de inferencia de TypeScript confusos en casos límite (generics anidados, uniones) — hay que probar esto temprano, no asumirlo resuelto.
- Mantener cero dependencias mientras se construye DX rica (mensajes de error, soporte async) sin inflar el bundle.
- Alcance de scopes: agregar demasiados tipos de scope desde el inicio complica la API sin validar primero que sean necesarios.

## Decisiones pendientes de validar

- Nombres finales de los métodos de binding (`toClass`/`toFactory`/`toValue` como propuesta inicial, inspirados en el vocabulario de Nest, en vez de `toInstance` de Brandi).
- Si resolution-scope entra en v1 o se pospone a v2 según qué tan seguido se necesite en la práctica.
- Diseño concreto del mecanismo constructor↔tokens — pendiente de la Fase 0.