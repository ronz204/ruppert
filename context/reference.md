# GoRules - Referencias

> Guía de referencia técnica y de producto — pensada para entender bien a nuestro principal competidor antes de diseñar el hub.

---

## 1. ¿Qué es GoRules, en una frase?

Es un **motor de reglas de negocio (BRE)** escrito en Rust, con un **BRMS** (la capa de producto: editor visual, versionado, entornos, IA) construido encima. La idea central: las reglas de negocio se modelan como **grafos JSON** que cualquier lenguaje puede ejecutar en microsegundos, sin depender de un servidor.

Piensa en dos capas bien separadas:

| Capa | Qué es | Licencia |
|---|---|---|
| **Zen Engine** | El motor que ejecuta las reglas | Open source (MIT), en Rust |
| **GoRules BRMS** | El producto completo: editor, nube, entornos, IA, auditoría | Freemium / comercial |

Esto es clave porque **no venden solo software cerrado**: regalan el motor y cobran por la capa de gestión, colaboración y compliance alrededor. Es el mismo modelo que GitLab o Elastic.

---

## 2. El lado técnico: cómo funciona por dentro

### 2.1 El motor — Zen Engine

- Escrito **100% en Rust** 🦀 — de ahí la velocidad y la seguridad de memoria.
- Es una librería **embebible**, no un servicio al que le pegas por red. Se compila e integra directamente en tu aplicación.
- Provee **bindings nativos** para: NodeJS, Python, Go, Java, C#, Kotlin (JVM y Android), Swift (iOS), además de Rust puro.
- También corre como **microservicio REST** si prefieres ese modelo (repo `agent-public`).
- Resultado práctico: **latencia de microsegundos**, funciona **offline**, y no hay "fee por evaluación" — corre local, cuantas veces quieras.

> 💡 Esto es lo que más deberíamos anotar: al ser una librería nativa (no una llamada HTTP a un servidor de reglas), GoRules evita el problema clásico de los BRMS enterprise (Drools, IBM ODM) donde cada evaluación implica latencia de red o de un runtime pesado tipo JVM.

### 2.2 El formato — JDM (JSON Decision Model)

Las reglas no son código, son **grafos guardados en JSON**. Esto las hace:
- Versionables como cualquier archivo (diff, git, PRs)
- Portables entre entornos y lenguajes
- Auditable línea por línea (sin caja negra)

Un grafo JDM tiene siempre:
- **1 nodo Input** ("Request") → por donde entran los datos
- **1 o más nodos Output** ("Response") → por donde sale el resultado
- Nodos intermedios conectados por *edges* (flechas), que van moviendo y transformando la data de izquierda a derecha

### 2.3 Los tipos de nodo (el corazón del modelo)

| Nodo | Para qué sirve |
|---|---|
| **Decision Table** | Reglas estilo hoja de cálculo: condiciones → resultados. Se puede importar directo desde Excel. |
| **Expression Node** | Cálculos y transformaciones con el ZEN Expression Language (ej. `sum(map(items, #.price * #.qty))`). |
| **Switch Node** | Ramifica el flujo según condiciones. Tiene 2 políticas: `first` (para en la primera que matchea) o `collect` (sigue por todas las que matcheen). |
| **Function Node** | Lógica más compleja vía función custom. |
| **Decision Node** | Invoca **otro** grafo/decisión ya existente → permite modularizar y reusar lógica entre proyectos. |

Ejemplo real de un Expression Node (tal cual lo documentan):

```json
{
  "type": "expressionNode",
  "content": {
    "expressions": [
      { "key": "subtotal", "value": "sum(map(items, #.price * #.qty))" },
      { "key": "tax", "value": "$.subtotal * 0.08" },
      { "key": "total", "value": "$.subtotal + $.tax" }
    ]
  }
}
```

⚠️ Detalle importante de diseño: si un Expression Node falla, **detiene todo el grafo** — no hay evaluación silenciosa de errores. Es una decisión consciente de seguridad/previsibilidad.

### 2.3.1 Cómo evalúa realmente una Decision Table (el detalle que casi nadie explica bien)

Esto es denso pero vale oro si vamos a construir algo similar:

- Las filas se evalúan **de arriba hacia abajo**, siguiendo una **hit policy** configurable en la esquina superior derecha de la tabla.
- **Cada columna de entrada se evalúa con lógica AND** entre sí, dentro de una misma fila. Si una celda de esa columna está vacía, esa columna se evalúa como verdadera automáticamente (no filtra nada).
- **Hit policy `first`**: se detiene en la primera fila que matchea → devuelve **un objeto** (o `null`/`undefined` si ninguna fila matchea). Es el comportamiento clásico "if/elif/elif".
- **Hit policy `collect`**: sigue evaluando todas las filas → devuelve **un arreglo de objetos**, uno por cada fila que matcheó (o arreglo vacío si ninguna matcheó). Útil cuando varias reglas pueden aplicar simultáneamente (ej. varios descuentos acumulables).
- Las celdas de entrada aceptan **unary tests** (igualdad, comparaciones numéricas, booleanos, funciones de fecha/hora, funciones de arreglo) escritas en ZEN Expression Language — es decir, no son solo "igual a X", sino expresiones completas.
- Existe también la **"expression evaluation"** dentro de una sola celda, dejando el selector de columna vacío, para comparar varios campos del contexto entrante a la vez. Ejemplo real documentado:

```
IF time(transaction.createdAt) > time("19:00:00") AND transaction.amount > 1000
THEN {"status": "reject"}
ELSE {"status": "approve"}
```

El **Switch node** reutiliza exactamente esta misma lógica de hit policy (`first` / `collect`), pero para ramificar el *grafo* en lugar de filas de una tabla — y a diferencia de la tabla, **no transforma los datos**: reenvía el contexto completo, intacto, hacia la(s) rama(s) de salida.

### 2.4 El editor visual

- **JDM Editor**: componente **React open source** independiente (repo separado en GitHub, ~300 estrellas, licencia MIT).
- Se puede usar standalone (embeberlo en tu propio producto) o dentro del BRMS completo de GoRules.
- Incluye un **simulador integrado** para probar el grafo con datos reales antes de moverlo a producción.

### 2.5 La separación clave: BRMS vs. Agent

Esto es quizás el detalle arquitectónico más importante y menos obvio a primera vista: **GoRules separa la gestión de reglas de la ejecución de reglas** en dos componentes que escalan de forma independiente.

| Componente | Rol | Quién lo usa |
|---|---|---|
| **BRMS** | Autoría, testing, versionado. Interfaz web + APIs. | Usuarios de negocio y developers |
| **Agent** | Motor de ejecución en Rust puro. Solo evalúa reglas ya publicadas. | Tus servicios en producción |

¿Por qué importa esta separación? Porque un **único BRMS central** puede convivir con **múltiples Agents** desplegados por entorno (DEV, UAT, PROD), cada uno con acceso IAM restringido solo a su propio storage de reglas. El BRMS nunca toca producción directamente: publica el JSON, y cada Agent lo recoge según sus permisos.

Ambos componentes son **stateless**, lo que en la práctica significa:
- **Escalado horizontal**: agregas réplicas detrás de un load balancer sin coordinación entre ellas.
- **Escalado vertical**: subes CPU/memoria para rule sets más grandes o mayor throughput.
- El **Agent en Rust escala de forma lineal** con los recursos disponibles — no hay garbage collector ni JVM warm-up de por medio.
- Actualizas reglas **sin reiniciar servicios** ni downtime: los cambios se propagan solos.

### 2.6 Dónde corre (arquitectura de despliegue)

Un solo motor, tres formas de correrlo:

- **Cloud** → GoRules administra la infraestructura
- **Self-hosted** → tu VPC, con Docker o Kubernetes (Helm chart oficial, compatible con EKS/AKS/GKE); dependencia única de PostgreSQL
- **Embebido** → lo compilas directo dentro de tu app, en el lenguaje que sea

Formas concretas de evaluar reglas en producción, según el caso de uso:
- **Servicio REST en Rust con hot-reloading** — para evaluación vía API sin tocar tu stack
- **Embebido directo** en Node.js, Python, Rust o Go — cero latencia de red
- **PySpark o Rust nativo** — para procesar millones de registros en batch (pipelines de datos)
- **Edge computing vía WASM** para escenarios de baja latencia extrema

Y en cuanto a integración con la infraestructura moderna: ingress vía NGINX/Traefik, service mesh con Istio/Linkerd (canary deployments, traffic mirroring), métricas Prometheus + dashboards Grafana ya armados, y despliegue GitOps con ArgoCD/Flux.

### 2.6 Tracción como proyecto open source

- Repo principal `gorules/zen`: **~1.8k estrellas**, 194 forks — tracción real pero no masiva.
- Ya lo usan empresas en producción (mencionan casos de insurtech en Australia/Nueva Zelanda).
- Certificación **SOC 2 Type II** — señal de que apuntan en serio a clientes enterprise/regulados.

---

## 3. El lado de producto: qué vende GoRules

### 3.1 Los 3 momentos del ciclo de vida de una regla

**🎨 Modelar** — Canvas visual, arrastrar y conectar nodos. Tablas de decisión estilo spreadsheet (importables desde Excel).

**🤖 El copiloto de IA, en concreto** — no es un chatbot decorativo pegado al costado, son 4 piezas específicas:
1. **AI Copilot integrado** — genera reglas a partir de lenguaje natural (le describes la lógica de negocio y arma el grafo/tabla).
2. **Servidor MCP propio** — expone el modelo de reglas como herramientas MCP, para que agentes de IA *externos* (tu propio agente interno, Claude, otro LLM) puedan leer y modificar decisiones directamente, sin pasar por el editor visual.
3. **Multi-provider LLM (BYOLLM)** — no te casan con un solo proveedor de modelo; puedes traer tu propia llave/proveedor de LLM (disponible desde el plan Business hacia arriba).
4. **Generación automática de casos de prueba** — la IA analiza la lógica ya modelada y genera edge cases para validar cobertura por rama, antes de que testees manualmente.

**🧪 Probar** — Corres datos reales y ves nodo por nodo qué se disparó, qué valores cambiaron y cuánto tardó cada paso. La IA puede generar automáticamente casos de prueba para cubrir bordes/edge cases.

**🚀 Desplegar** — Workflow "estilo Git": branches para aislar cambios, commits con historial completo, rollback de un clic, y flujos de aprobación (aceptar/rechazar/comentar) antes de promover a producción.

### 3.2 Features enterprise

- Self-hosting en VPC/on-prem (Docker/K8s)
- SSO (Azure AD, Okta, cualquier proveedor OIDC)
- CI/CD tipo git entre entornos Dev/UAT/Producción
- Auditoría completa (quién cambió qué y cuándo)
- Arquitectura **stateless** pensada para escalar horizontalmente y con recuperación ante desastres
- Servicios profesionales para implementaciones a medida

### 3.3 Precios (self-hosted, todos con evaluaciones ilimitadas)

| Plan | Precio | Para quién | Incluye destacado |
|---|---|---|---|
| **Free** | 0 €/mes | Probar en tu infra | Editor visual, API, Docker/K8s, 2 usuarios, 1 proyecto |
| **Team** | 50 €/mes | Equipos chicos/startups | 5 usuarios, 2 proyectos |
| **Business** | 500 €/mes | Escalar multi-entorno | 2 entornos (Stage/Prod), SSO Azure AD/Okta, audit log, diff viewer, SLA básico |
| **Enterprise** | Custom | Cargas críticas | Entornos ilimitados, copiloto IA + integración LLM, SLA a medida, ingeniero de soporte dedicado, acceso a analista de negocio |

📌 Dato importante: **las evaluaciones son siempre ilimitadas**, incluso en el plan gratis. Lo que se paga es colaboración (usuarios, proyectos), gobernanza (entornos, SSO, auditoría) y soporte — no el uso del motor. Refuerza que el motor es un commodity que regalan; el negocio está en la capa de gestión.

### 3.4 Industrias donde se posicionan activamente

Fintech (KYC, AML, scoring de crédito) · Seguros (suscripción, siniestros) · Aviación (tarifas, pricing) · Salud (decisiones clínicas) · Retail (pricing, promociones) · Logística (ruteo, envíos) · Sector público (elegibilidad, permisos) · Telecom (planes, facturación).

Todas comparten un patrón: **mucha lógica condicional, que cambia seguido, y que alguien necesita auditar**.

---

## 4. Resumen visual del "foso" (moat)

```
┌─────────────────────────────────────────────┐
│  Motor Rust + bindings nativos 8 lenguajes  │  ← difícil de igualar rápido
├─────────────────────────────────────────────┤
│  Formato JDM abierto y portable             │  ← estándar que buscan controlar
├─────────────────────────────────────────────┤
│  Editor React open source + simulador       │  ← ya tiene tracción propia
├─────────────────────────────────────────────┤
│  Workflow git-like + auditoría + SSO        │  ← lo que realmente cobran
├─────────────────────────────────────────────┤
│  Copiloto IA + servidor MCP                 │  ← la apuesta más reciente
└─────────────────────────────────────────────┘
```

La base (motor + formato) es replicable con tiempo. Lo difícil de alcanzar rápido es la combinación de **rendimiento nativo + confianza enterprise (SOC 2) + tracción de comunidad** que ya acumularon.

---

*Fuentes: sitio oficial gorules.io (producto, precios, arquitectura, IA/MCP, cloud-native, BRMS), documentación docs.gorules.io (JDM, tipos de nodo, decision tables, hit policies, SDKs, arquitectura BRMS/Agent), repositorios GitHub gorules/zen y gorules/zen-go, Artifact Hub (Helm chart), más cobertura de terceros (SaaSworthy, Medium, The Digital Project Manager).*