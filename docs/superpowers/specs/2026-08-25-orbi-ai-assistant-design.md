# ORBI — Asistente de IA para Órbita

**Fecha:** 2026-08-25
**Estado:** Diseño aprobado, pendiente plan de implementación

---

## 1. Qué es ORBI

Un copilot de IA integrado en la plataforma Órbita que opera como side panel contextual. No solo responde preguntas: ejecuta acciones complejas de múltiples pasos con feedback visual en tiempo real.

ORBI vive exclusivamente en la web (no WhatsApp, no canal externo). El widget existente `OrbiChat.tsx` es la base del componente frontend.

---

## 2. Superficies

ORBI opera en dos superficies con capacidades distintas:

### 2.1 Wizard de Onboarding

- **Quién lo usa:** dueño nuevo creando su negocio
- **Niveles:** Guía + Asistencia (no ejecución — no hay API del negocio aún)
- **Proactividad:** detecta inactividad en campos obligatorios (~30s), muestra nudge sutil preguntando si quiere ayuda
- **Acciones sobre formularios:** pre-rellena campos con sugerencias. Los campos quedan con borde violeta y tag "Sugerido por Orbi — editá si querés"
- **Contexto:** paso actual del wizard, campos vacíos/llenos, rubro elegido
- **Limitación:** no avanza pasos por el usuario, no crea la cuenta

### 2.2 Panel Administrativo

- **Quién lo usa:** dueño o miembro del equipo operando su tienda
- **Niveles:** Guía + Asistencia + Ejecución completa
- **Proactividad:** no interviene proactivamente, solo responde cuando el usuario abre el panel
- **Acciones:** CRUD completo via API, navegación entre módulos, consulta de datos
- **Contexto:** módulo/pantalla actual, datos del negocio, permisos del usuario
- **Feedback visual:** pipeline de pasos con checkmarks en tiempo real

---

## 3. Tres niveles de interacción

| Nivel | Ejemplo | Qué hace ORBI |
|---|---|---|
| **Guía** | "Cómo configuro el envío?" | Explica paso a paso, ofrece botón para navegar al módulo correcto |
| **Asistencia** | Usuario trabado en "nombre del negocio" (wizard) | Detecta inactividad, pregunta si quiere ayuda, sugiere opciones, pre-rellena campo |
| **Ejecución** | "Creame un producto: iPhone 13 Pro Max" + 3 fotos | Ejecuta pipeline completo: procesa imágenes, remueve fondo, genera descripción, asigna categoría, publica. Con feedback paso a paso |

---

## 4. Zona prohibida

Acciones que ORBI nunca ejecuta, aunque el usuario se lo pida:

- Eliminar negocio
- Cambiar plan de suscripción / facturación
- Modificar contraseñas o credenciales
- Remover miembros del equipo
- Cualquier acción de "Zona peligrosa" en configuración

Estas acciones no se registran como tools en el LLM. Si el usuario las pide, ORBI responde que no puede hacerlo y explica cómo hacerlo manualmente.

---

## 5. Fuera de alcance

- No es chatbot de WhatsApp — vive solo en la web
- No atiende clientes finales en el storefront — es solo para el dueño/equipo
- No reemplaza la UI — guía al usuario a usar el panel, no hace un panel paralelo
- No toma decisiones autónomas — ejecuta lo que el usuario pidió, no actúa por cuenta propia

---

## 6. Arquitectura técnica

### 6.1 Componentes del backend (NestJS)

```
OrbiModule
├── OrbiGateway       — endpoint SSE, recibe mensajes, streamea respuestas
├── ContextBuilder    — arma system prompt dinámico con módulo, datos del negocio, permisos
├── ToolRegistry      — define acciones ejecutables, mapea a servicios existentes
└── LlmAdapter        — interfaz agnóstica al provider (Groq / OpenAI / Anthropic)
```

**OrbiGateway (SSE):** recibe POST con mensaje + contexto, retorna stream de Server-Sent Events con chunks de texto y eventos de acción.

**ContextBuilder:** construye el system prompt inyectando:
- Superficie actual (wizard / panel)
- Módulo y sección donde está el usuario
- Datos del negocio (nombre, rubro, productos existentes, categorías)
- Permisos del usuario (qué puede y no puede hacer)
- Tools disponibles filtrados por superficie y permisos

**ToolRegistry:** catálogo de acciones invocables por el LLM via function calling. Cada tool define nombre, descripción, parámetros, y mapea a un servicio existente (ProductService, DiscountService, etc.). Las tools de zona prohibida no se registran.

**LlmAdapter:** abstracción agnóstica al provider. Interfaz uniforme para chat + function calling + streaming. El provider se decide después (Groq, OpenAI, o Anthropic). Un solo punto de cambio.

### 6.2 Protocolo de comunicación: SSE

No WebSockets. SSE es más simple y perfecto para request-response streaming.

**Request:**
```
POST /orbi/chat
Content-Type: application/json

{
  "message": "Creame un producto iPhone 13 Pro Max, 128GB, usado, $650.000",
  "attachments": ["img1.jpg", "img2.jpg", "img3.jpg"],
  "context": {
    "surface": "panel",
    "module": "productos",
    "section": "lista",
    "businessId": "abc-123",
    "permissions": ["products:write", "discounts:write", ...]
  },
  "conversationId": "conv-456"
}
```

**Response (SSE stream):**
```
event: text
data: {"chunk": "Dale, te creo el producto con las 3 fotos."}

event: action_start
data: {"id": "step-1", "label": "Procesando imágenes", "tool": "processImages"}

event: action_complete
data: {"id": "step-1", "result": "3 imágenes procesadas"}

event: action_start
data: {"id": "step-2", "label": "Removiendo fondo", "tool": "removeBackground"}

event: action_complete
data: {"id": "step-2", "result": "Fondo removido"}

event: action_start
data: {"id": "step-3", "label": "Generando descripción", "tool": "generateDescription"}

event: action_complete
data: {"id": "step-3", "result": "Descripción generada"}

event: action_start
data: {"id": "step-4", "label": "Asignando categoría", "tool": "assignCategory"}

event: action_complete
data: {"id": "step-4", "result": "Categoría: Celulares"}

event: action_start
data: {"id": "step-5", "label": "Publicando producto", "tool": "createProduct"}

event: action_complete
data: {"id": "step-5", "result": {"productId": "xyz-789", "name": "iPhone 13 Pro Max"}}

event: text
data: {"chunk": "Listo! iPhone 13 Pro Max publicado a $650.000. Le removí el fondo a las fotos y lo puse en \"Celulares\". ¿Querés ajustar algo?"}

event: done
data: {}
```

### 6.3 Context awareness

**En el wizard:**
- Hook `useOrbiContext()` expone: `{ surface: 'wizard', step: 2, stepName: 'tu-negocio', emptyFields: ['nombre', 'descripcion'], filledFields: ['telefono'] }`
- Zustand store `useOnboardingStore` ya tiene todo el estado del wizard
- Timer por campo: si un campo obligatorio vacío lleva >30s sin `onChange`, ORBI recibe evento `user_idle_on_field`

**En el panel admin:**
- `AdminSeccionShell` ya parsea `moduloPadre` y `seccion` de la URL
- Mismo hook `useOrbiContext()` expone: `{ surface: 'panel', module: 'descuentos', section: 'crear', businessId: '...' }`
- Cada módulo puede opcionalmente aportar contexto extra via un provider

### 6.4 Conversación

- Cada sesión de ORBI mantiene un historial conversacional (`conversationId`)
- El historial permite encadenar acciones: "creame un producto" → "ahora agregale un descuento del 10%"
- El historial se persiste en backend (tabla `orbi_conversations` con `messages` JSON)
- Límite de contexto: últimos N mensajes + system prompt + tools (ajustar según modelo)

---

## 7. Sistema de Tools

Acciones que ORBI puede invocar via function calling del LLM, organizadas por módulo:

### 7.1 Productos
| Tool | Descripción |
|---|---|
| `createProduct` | Crear producto con nombre, descripción, precio, imágenes, categoría, specs |
| `updateProduct` | Editar campos de un producto existente |
| `listProducts` | Consultar productos (para contexto y respuestas) |
| `generateDescription` | Generar descripción con AI (reutiliza `ProductAiService` existente) |
| `removeBackground` | Remover fondo de imagen (reutiliza `BackgroundRemovalService` existente) |

### 7.2 Descuentos
| Tool | Descripción |
|---|---|
| `createDiscount` | Crear descuento porcentual o fijo |
| `createCoupon` | Crear cupón con código |
| `listDiscounts` | Consultar descuentos activos |

### 7.3 Pedidos
| Tool | Descripción |
|---|---|
| `listOrders` | Consultar pedidos (solo lectura) |
| `getOrderDetail` | Ver detalle de un pedido |
| `updateOrderStatus` | Cambiar estado de un pedido |

### 7.4 Clientes
| Tool | Descripción |
|---|---|
| `listCustomers` | Consultar clientes |
| `getCustomerDetail` | Ver detalle de un cliente y su historial |

### 7.5 Configuración
| Tool | Descripción |
|---|---|
| `updateBusinessInfo` | Cambiar nombre, descripción, teléfono, logo |
| `updatePaymentMethods` | Activar/desactivar métodos de pago |
| `updateShipping` | Configurar envíos y zonas de entrega |

### 7.6 Navegación
| Tool | Descripción |
|---|---|
| `navigateTo` | Llevar al usuario a un módulo/sección específica del panel |

### 7.7 Reportes / Consultas
| Tool | Descripción |
|---|---|
| `getSalesReport` | Ventas por período (día, semana, mes) |
| `getProductReport` | Productos más vendidos, stock bajo |
| `getCustomerReport` | Clientes nuevos, recurrentes, ticket promedio |

### 7.8 Wizard (solo en superficie onboarding)
| Tool | Descripción |
|---|---|
| `fillWizardField` | Pre-rellenar un campo del wizard |
| `suggestBusinessName` | Generar sugerencias de nombre basadas en rubro |
| `suggestSubdomain` | Sugerir subdominio disponible |
| `suggestDescription` | Generar descripción del negocio |

### 7.9 No registradas (zona prohibida)
Estas acciones no existen como tools — el LLM no puede invocarlas:
- Eliminar negocio / cambiar plan / facturación
- Modificar contraseñas o credenciales
- Remover miembros del equipo
- Acciones de "Zona peligrosa"

---

## 8. UI / UX

### 8.1 Side panel (overlay)

- **Posición:** panel lateral derecho que flota sobre el contenido (overlay con sombra)
- **Ancho:** 320px en panel admin, 280px en wizard
- **El contenido principal mantiene su ancho completo** — no se empuja ni se comprime
- **Trigger:** botón "Orbi AI" en la parte inferior del sidebar con shortcut `Ctrl+K` (o `Cmd+K` en Mac)
- **En sidebar colapsado:** icono circular con el símbolo ✦
- **Header del panel:** icono Orbi + título + badge de contexto (módulo actual) + botón cerrar

### 8.2 Chat

- **Mensajes del usuario:** burbuja azul (#3B82F6) alineada a la derecha
- **Mensajes de ORBI:** burbuja gris (#F1F5F9) alineada a la izquierda
- **Attachments:** thumbnails de imágenes adjuntas arriba del mensaje del usuario
- **Input:** campo con border-radius tipo pill, botón de envío circular azul
- **Placeholder:** "Preguntale algo a Orbi..."

### 8.3 Feedback de ejecución (pipeline)

Cuando ORBI ejecuta una acción multi-paso, muestra una card con:
- Título de la operación ("Creando producto...")
- Lista de pasos con íconos de estado:
  - ✓ verde (#10B981) — completado
  - ● azul (#3B82F6) con pulso animado — en progreso
  - ○ gris (#CBD5E1) — pendiente
- Al completar, la card cambia a fondo verde claro (#ECFDF5) con título "Producto creado"
- ORBI envía un mensaje de texto al final confirmando qué hizo y preguntando si ajustar algo

### 8.4 Botón de navegación

Cuando ORBI sugiere navegar a otro módulo, muestra un botón azul claro con flecha:
- Fondo: #EFF6FF, borde: #DBEAFE, texto: #1D4ED8
- Texto: "Ir a Configuración → Envíos"
- Al clickear, usa `router.push()` para navegar

### 8.5 Card de datos (consultas)

Cuando ORBI responde con datos estructurados (ventas, métricas):
- Card blanca con bordes, filas de label + valor
- Valores positivos en verde, negativos en rojo
- Permite visualizar datos sin navegar al dashboard

### 8.6 Nudge proactivo (solo wizard)

Cuando ORBI detecta inactividad en un campo:
- Burbuja flotante pequeña (no el panel completo) en esquina inferior derecha
- Icono Orbi ✦ + texto: "¿Te ayudo con el nombre?"
- Dos botones: "Sí, dale" (primario) / "No, gracias" (secundario)
- Si el usuario acepta, se abre el side panel con sugerencias contextuales
- Si rechaza, la burbuja desaparece y no vuelve a aparecer para ese campo

### 8.7 Campos pre-rellenados por ORBI (solo wizard)

- Borde violeta (#8B5CF6) + fondo lavanda (#F5F3FF)
- Tag debajo: "✦ Sugerido por Orbi — editá si querés"
- Al editarlo manualmente, el campo vuelve al estilo normal (el tag desaparece)
- Subdominio: si ORBI lo sugiere y está disponible, muestra "✓ disponible" en verde

### 8.8 Producto creado por ORBI (panel admin)

- El producto nuevo aparece en la grilla con borde violeta y badge "Nuevo ✦"
- El badge desaparece al recargar la página o después de N segundos

---

## 9. Datos y persistencia

### 9.1 Tabla `orbi_conversations`
```
id              UUID    PK
businessId      UUID    FK → businesses
userId          UUID    FK → users (el member/owner que interactúa)
surface         ENUM    'wizard' | 'panel'
messages        JSONB   array de {role, content, timestamp, toolCalls?}
context         JSONB   último contexto enviado (módulo, sección)
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### 9.2 Relación con el modelo existente
- ORBI reutiliza servicios existentes: `ProductService`, `DiscountService`, `OrderService`, etc.
- No crea tablas de productos/descuentos propias — usa las mismas que el panel
- Las acciones de ORBI pasan por los mismos guards de permisos que las acciones manuales

---

## 10. Consideraciones de diseño

### 10.1 ORBI en el wizard sin cuenta creada

En el wizard, el usuario aún no tiene cuenta (la cuenta se crea después del pago). Esto implica:
- No hay `userId` ni `businessId` disponibles
- Las tools del wizard (`suggestBusinessName`, `suggestDescription`, `fillWizardField`) operan mayormente client-side sobre el Zustand store
- `suggestSubdomain` requiere un API call ligero (el endpoint de validación de subdominio ya existe)
- El endpoint de ORBI en modo wizard es un endpoint público con rate limiting estricto (por IP + fingerprint), no requiere auth
- No se persisten conversaciones del wizard (son efímeras, se pierden al cerrar)

### 10.2 Mobile

En pantallas < 768px:
- El side panel se convierte en full-screen overlay (panel-bottom o modal de pantalla completa)
- El botón de Orbi se mueve a la barra de navegación inferior (si existe) o queda como FAB circular
- El nudge proactivo del wizard se muestra como toast en la parte inferior

---

## 11. Seguridad

- Cada request a `/orbi/chat` (modo panel) pasa por `AuthGuard` — requiere sesión válida
- En modo wizard: endpoint público con rate limiting estricto (máximo 10 requests/minuto por IP)
- El `ContextBuilder` filtra tools según los permisos del usuario (`permissions` array)
- Si un usuario no tiene `products:write`, ORBI no puede crear productos para él
- Las herramientas de zona prohibida no existen en el registry — no es filtro, es ausencia
- Rate limiting en el endpoint SSE: máximo N requests por minuto por usuario
- Attachments (imágenes) se validan en tipo y tamaño antes de procesarse

---

## 11. LLM Provider

**Decisión pendiente.** La interfaz `LlmAdapter` abstrae el provider:

```typescript
interface LlmAdapter {
  chat(params: {
    systemPrompt: string;
    messages: Message[];
    tools: ToolDefinition[];
    onTextChunk: (chunk: string) => void;
    onToolCall: (call: ToolCall) => Promise<ToolResult>;
  }): Promise<void>;
}
```

Cualquier provider que soporte function calling + streaming sirve. Candidatos:
- **Groq** — ya integrado, rápido, barato. Modelos Llama.
- **OpenAI** — GPT-4o-mini para costo, GPT-4o para calidad. Mejor function calling.
- **Anthropic** — Claude. Muy bueno en español y en instrucciones complejas.

La decisión se toma en la fase de implementación con una prueba de calidad en español + function calling.

---

## 13. Glosario

| Término | Significado |
|---|---|
| **Nudge** | Burbuja sutil que ORBI muestra proactivamente invitando al usuario a pedir ayuda |
| **Pipeline** | Secuencia de pasos que ORBI ejecuta con feedback visual |
| **Tool** | Acción que el LLM puede invocar via function calling (ej: `createProduct`) |
| **Surface** | Superficie donde ORBI opera: `wizard` o `panel` |
| **Side panel** | Panel lateral overlay donde vive la interfaz de chat de ORBI |
| **Zona prohibida** | Conjunto de acciones que ORBI nunca ejecuta (eliminar negocio, credenciales, etc.) |
