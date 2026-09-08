# Roadmap de dockdi

Documento de seguimiento manual y local del progreso de desarrollo de `dockdi`. Cada fase contiene su objetivo central, criterios de éxito y la lista detallada de tareas con casillas de verificación (`- [ ]`) para el control de avance.

---

## Estado General del Proyecto

| Fase | Descripción | Estado |
|---|---|---|
| **Fase 0** | Mecanismo central y validación (Constructor ↔ Tokens) | 🟡 Pendiente / Listo para iniciar |
| **Fase 1** | Core container mínimo (`bind`/`get`, Transient) | ⚪ Pendiente |
| **Fase 2** | Ciclo de vida y Scopes (Singleton, Resolution Scope) | ⚪ Pendiente |
| **Fase 3** | DX de errores (Ciclos con traza completa y sugerencias) | ⚪ Pendiente |
| **Fase 4** | Resolución asíncrona opt-in (Async factories) | ⚪ Pendiente |
| **Fase 5** | Utilidades de testing (Mocking y Overrides) | ⚪ Pendiente |
| **Fase 6** | Empaquetado y publicación (Dual ESM/CJS, npm) | ⚪ Pendiente |
| **Fase 7** | Extensiones futuras (Child containers, integraciones) | ⚪ Futuro |

---

## Fase 0 — Mecanismo Central y Validación

**Objetivo**: Prototipar el branded token y resolver el desafío arquitectónico más crítico de `dockdi`: asociar los parámetros del constructor de una clase con sus respectivos tokens de inyección sin recurrir a decoradores (`@inject`), `reflect-metadata` ni configuración en `tsconfig.json`, superando la fragilidad de orden de Brandi.

- **Criterio de éxito**: Un prototipo ejecutable y validado con tests en Bun (`bun test`) que demuestre que el compilador de TypeScript valida los tipos de los tokens frente a los parámetros del constructor y que un resolver mínimo instancia la clase correctamente.

### Tareas
- [ ] **Diseño del Branded Token (`Token<T>`)**
  - [ ] Definir el tipo phantom sobre `symbol` (`unique symbol` brand no exportado a runtime).
  - [ ] Implementar la función creadora `token<T>(description?: string): Token<T>`.
  - [ ] Escribir tests de tipado estático verificando que dos tokens con tipos incompatibles (`Token<A>` vs `Token<B>`) no sean asignables entre sí a nivel de TypeScript.
- [ ] **Investigación y prototipado del mapeo Constructor ↔ Tokens**
  - [ ] Explorar enfoques de asociación: tupla tipada vinculada a la clase vs. helper constructor tipado vs. inferencia por función factoría.
  - [ ] Evaluar seguridad frente al gap de Brandi (garantizar en compile-time que el orden y tipo de los tokens correspondan exactamente a los parámetros del constructor).
  - [ ] Prototipar la sintaxis elegida en un archivo de prueba en `libraries/dockdi-ts`.
- [ ] **Resolver y validación mínima en Bun**
  - [ ] Implementar un resolver mínimo que tome el constructor y la tupla de tokens y resuelva las dependencias instanciando con `new`.
  - [ ] Validar ejecución exitosa con `bun test` y `bun x tsc --noEmit`.
  - [ ] Documentar formalmente la decisión de diseño acordada como base para la Fase 1.

---

## Fase 1 — Core Container Mínimo

**Objetivo**: Construir el contenedor básico de inyección de dependencias de extremo a extremo, soportando registro de bindings y resolución síncrona bajo scope `transient`.

- **Criterio de éxito**: Contenedor funcional con API pública `bind` y `get`, que resuelva dependencias transitivas simples y falle con errores claros cuando falte un token.

### Tareas
- [ ] **Estructura del Container y Registro**
  - [ ] Implementar la clase `Container` con almacenamiento interno de bindings (`Map<Token<unknown>, Binding<unknown>>`).
  - [ ] Diseñar e implementar la API fluida de registro `container.bind(token)`.
  - [ ] Soportar binding a clase (`toClass(Constructor, tokens)`).
  - [ ] Soportar binding a valor constante (`toValue(value)`).
  - [ ] Soportar binding a fábrica síncrona (`toFactory(factoryFn, tokens)`).
- [ ] **Motor de Resolución Síncrona (`get`)**
  - [ ] Implementar `container.get(token)` con resolución recursiva de dependencias.
  - [ ] Aplicar scope `transient` por defecto (cada resolución crea una instancia nueva e independiente).
  - [ ] Manejar tokens no registrados lanzando un error específico con el nombre/descripción del token faltante.
- [ ] **Suite de Pruebas de la Fase 1**
  - [ ] Tests de resolución de dependencias lineales (ej. `A -> B -> C`).
  - [ ] Tests validando que múltiples llamadas a `get` con scope transient devuelven referencias distintas (`instance1 !== instance2`).
  - [ ] Tests de fallo al solicitar tokens inexistentes.

---

## Fase 2 — Ciclo de Vida y Scopes

**Objetivo**: Incorporar políticas de ciclo de vida de instancias (`singleton` y evaluar `resolution-scope`), garantizando consistencia referencial y control de memoria.

- **Criterio de éxito**: Pruebas unitarias que demuestren la preservación exacta de referencias para singletons y aislamiento entre llamadas para transient/resolution-scope.

### Tareas
- [ ] **Scope Singleton**
  - [ ] Extender la API de binding para especificar scope: `.inSingletonScope()` o `.scope('singleton')`.
  - [ ] Implementar la caché de instancias singleton dentro del contenedor.
  - [ ] Asegurar que resoluciones concurrentes o dependencias compartidas reutilicen la misma instancia (`instance1 === instance2`).
- [ ] **Evaluación e Implementación de Resolution-Scope**
  - [ ] Analizar la viabilidad y necesidad práctica de un scope acotado al árbol de una resolución (`resolution-scope` / contextual).
  - [ ] Si se aprueba: implementar contexto de resolución efímero que comparta instancias solo durante el ciclo de ejecución de un único `container.get()`.
- [ ] **Suite de Pruebas de Ciclo de Vida**
  - [ ] Tests de identidad referencial en grafos diamante (ej. `A` depende de `B` y `C`, ambos dependen del singleton `D`).
  - [ ] Tests de limpieza de memoria o reinicio de contenedor si aplica.

---

## Fase 3 — Experiencia de Desarrollo (DX) y Diagnóstico de Errores

**Objetivo**: Convertir el manejo de errores en un factor diferenciador clave de `dockdi`: detectar dependencias circulares antes de desbordar el stack y ofrecer mensajes detallados con trazas completas y sugerencias.

- **Criterio de éxito**: Ningún ciclo produce `Maximum call stack size exceeded`; en su lugar, se lanza un error descriptivo que imprime la secuencia completa del ciclo (ej. `A -> B -> C -> A`).

### Tareas
- [ ] **Detección de Dependencias Circulares**
  - [ ] Implementar pila de resolución activa (`resolutionStack`) durante la invocación recursiva de `get`.
  - [ ] Detectar presencia de un token en la pila antes de intentar resolverlo.
  - [ ] Interrumpir la ejecución inmediatamente al encontrar un ciclo.
- [ ] **Formateo de Errores y Diagnóstico**
  - [ ] Crear jerarquía de clases de error dedicadas (`CircularDependencyError`, `MissingTokenError`, `InvalidBindingError`).
  - [ ] Formatear el mensaje de ciclo mostrando la ruta completa: `Token[A] -> Token[B] -> Token[C] -> Token[A]`.
  - [ ] En errores de token faltante, inspeccionar el registro y sugerir tokens con descripciones similares (cálculo de distancia o coincidencia de nombres).
- [ ] **Suite de Pruebas de Diagnóstico**
  - [ ] Tests de ciclos directos (`A -> B -> A`).
  - [ ] Tests de ciclos indirectos (`A -> B -> C -> D -> B`).
  - [ ] Tests verificando el texto exacto y la claridad del mensaje de error emitido.

---

## Fase 4 — Factorías y Resolución Asíncrona (Opt-in)

**Objetivo**: Soportar resolución asíncrona cuando las dependencias dependan de factorías o inicializaciones asíncronas, protegiendo estrictamente el camino síncrono por defecto.

- **Criterio de éxito**: La resolución síncrona `container.get()` continúa operando sin penalización ni contaminación de `Promise`, mientras que `container.resolveAsync()` o factorías asíncronas resuelven limpiamente mediante `Promise`.

### Tareas
- [ ] **Bindings Asíncronos**
  - [ ] Soporte para factorías asíncronas (`toAsyncFactory(asyncFn, tokens)`).
  - [ ] Tipado estático que impida resolver un binding asíncrono mediante el método síncrono `get`.
- [ ] **Método de Resolución Asíncrona**
  - [ ] Implementar `container.resolveAsync(token): Promise<T>`.
  - [ ] Propagación asíncrona de dependencias (resolución en paralelo de argumentos independientes con `Promise.all` cuando sea seguro).
  - [ ] Preservar la detección de ciclos dentro del pipeline asíncrono.
- [ ] **Suite de Pruebas Asíncronas**
  - [ ] Tests de resolución de factorías con retardo / llamadas asíncronas simuladas.
  - [ ] Tests verificando que intentar resolver un token asíncrono con `get()` síncrono lanza un error explicativo en lugar de devolver una `Promise` sin resolver.

---

## Fase 5 — Utilidades de Testing

**Objetivo**: Proporcionar a los consumidores de `dockdi` facilidades ergonómicas y declarativas para sobrescribir dependencias (mocks/stubs) en suites de pruebas unitarias.

- **Criterio de éxito**: Los desarrolladores pueden crear snapshots, clonar contenedores o sobrescribir bindings puntuales de forma aislada por test sin contaminar el contenedor original.

### Tareas
- [ ] **Mecanismo de Overrides / Mocks**
  - [ ] Diseñar API de sobreescritura (ej. `container.override(token).toValue(mock)` o `container.createChild()` acotado a pruebas).
  - [ ] Implementar restauración de bindings (`restore()` o `snapshot()`).
  - [ ] Garantizar que las sobreescrituras invaliden adecuadamente las cachés de singleton afectadas.
- [ ] **Suite de Pruebas para Testing Utilities**
  - [ ] Tests de aislamiento verificando que un override en un test no afecte a resoluciones en tests posteriores.
  - [ ] Tests de sustitución de dependencias anidadas profundas por un mock.

---

## Fase 6 — Empaquetado, Optimización y Publicación

**Objetivo**: Preparar el paquete para su distribución en el ecosistema npm con presupuesto estricto de bundle size, cero dependencias de producción y compatibilidad universal ESM/CJS.

- **Criterio de éxito**: Paquete publicado en npm con artefactos `.mjs`, `.cjs` y `.d.ts`, validado en proyectos cliente puros en Node.js, Bun y navegadores.

### Tareas
- [ ] **Configuración de Build Dual**
  - [ ] Configurar script de compilación (usando Bun o rollup/esbuild ligero) para emitir ESM y CommonJS.
  - [ ] Generar mapas de declaración TypeScript (`.d.ts` y `.d.cts`).
  - [ ] Configurar `exports`, `main`, `module` y `types` en `package.json`.
- [ ] **Auditoría de Invariantes**
  - [ ] Verificar que `dependencies` en `package.json` permanezca vacío (`0` dependencias en runtime).
  - [ ] Medir y documentar el tamaño del bundle (establecer presupuesto de bundle size, ej. < 3 KB minified).
- [ ] **Documentación y Ejemplos**
  - [ ] Redactar `README.md` público con guía de inicio rápido, ejemplos de uso y comparación conceptual con soluciones basadas en decoradores.
  - [ ] Crear ejemplos funcionales listos para ejecutar.
- [ ] **Publicación**
  - [ ] Configurar pipeline de CI/CD para pruebas y publicación automatizada.
  - [ ] Publicar versión `1.0.0` en npm.

---

## Fase 7 — Extensiones Futuras (Fuera del Alcance Inicial)

**Objetivo**: Evaluar e incorporar características avanzadas tras la estabilización de la versión 1.0.

- [ ] **Contenedores Jerárquicos (Child Containers)**: Árboles de contenedores con herencia de bindings y fallback hacia el contenedor padre.
- [ ] **Integración Nativa con Frameworks**: Adaptadores específicos para inyección contextual en frameworks web (ej. Elysia en Bun, Express, Fastify).
- [ ] **Plugins / Middleware de Resolución**: Hooks para instrumentación, telemetría y logging de resoluciones.
