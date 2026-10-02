# Prompt para Claude Design — el nuevo Orbi del panel

Copiar todo lo que está debajo de la línea en un chat nuevo de Claude Design. Antes de mandarlo,
adjuntar **capturas del panel actual** (Inicio, Pedidos y Productos, en claro y en oscuro, una de
escritorio y una de celular) y una del Orbi de hoy abierto: Claude Design no ve el código, y sin
capturas va a inventar un panel que no es el nuestro.

Fuente de este prompt: `docs/superpowers/specs/2026-10-01-orbi-fase-3-ui-panel-design.md` (§5–§7,
§12). Si el diseño que vuelve contradice el spec en algo de comportamiento, manda el spec; si mejora
algo visual, se actualiza el spec.

---

Necesito el diseño completo del nuevo chat de **Orbi**, el asistente de IA que vive dentro del panel
de administración de **Órbita**, una plataforma argentina donde comercios chicos y medianos manejan
su tienda online (pedidos, productos, clientes, descuentos, mensajes). Los usuarios son dueños y
empleados de comercios, **no son técnicos**. Todo el texto de la interfaz va en **español
rioplatense con voseo** ("Escribile a Orbi", "Probá de nuevo").

Orbi responde dudas sobre cómo usar el panel, consulta datos reales del negocio (ventas, pedidos,
stock) y **propone acciones** (crear un cupón, marcar un pedido como enviado) que la persona aprueba
con una tarjeta antes de que pasen. Adjunto capturas del panel actual y del Orbi de hoy, que se ve
pobre y se reemplaza entero.

## Restricciones de identidad (no negociables)

Orbi vive **adentro** de un panel con identidad propia. Si cambia la paleta o la tipografía, se va a
leer como otro producto pegado. Usá exactamente esto:

- **Tipografía:** Geist (texto e interfaz), Geist Mono (números y detalles técnicos). Nada más.
- **Íconos:** lucide-react, trazo de 1,5–2 px. **Ningún emoji como ícono.**
- **Logo de Orbi:** una estrella de cuatro puntas plateada con un satélite azul que la orbita, sobre
  un disco navy (adjunto captura). Ya existe; no lo rediseñes, solo ubicalo.
- **Modo claro y modo oscuro**, los dos, en cada pantalla. El modo oscuro del panel tiene un fondo de
  "cielo" casi negro azulado.
- **Tokens de color** (usalos por nombre en las especificaciones):

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#FFFFFF` | `#05080F` | Fondo |
| `--color-surface` | `#F8FAFC` | `#0B101D` | Paneles, tarjetas |
| `--color-surface-alt` | `#F1F5F9` | `#151D31` | Hover, burbuja de la persona |
| `--color-border` | `#E2E8F0` | `#1B2439` | Bordes |
| `--color-border-strong` | `#CBD5E1` | `#2D3A59` | Bordes de inputs, separadores fuertes |
| `--color-text` | `#0F172A` | `#E8EDF7` | Títulos y texto principal |
| `--color-body` | `#334155` | `#A9B4CB` | Texto de cuerpo |
| `--color-muted` | `#64748B` | `#7E89A6` | Texto secundario (el **pensamiento** de Orbi usa este, no uno más claro) |
| `--color-primary` | `#3B82F6` | `#60A5FA` | Acción principal, foco |
| `--color-primary-bg` | `#EFF6FF` | azul al 12 % | Fondos tintados |
| `--color-success` / `-bg` | `#10B981` / `#ECFDF5` | `#34D399` / verde al 12 % | Actividad OK, acción aplicada |
| `--color-warning` / `-bg` | `#F59E0B` / `#FFFBEB` | `#FBBF24` / ámbar al 12 % | Esperando aprobación, mantenimiento |
| `--color-error` / `-bg` | `#EF4444` / `#FEF2F2` | `#F87171` / rojo al 10 % | Error |
| `--chip-*-fg` | `#1E40AF` `#065F46` `#B45309` `#991B1B` | claros | Texto sobre fondo tintado (contraste 4,5:1) |

Sombra de tarjeta: `0 1px 3px rgba(15,23,42,.06)` en claro; en oscuro, sombra profunda con un filo
de luz arriba.

## Parte A — Lo que se construye ahora (diseño detallado, listo para implementar)

### A1. Cuatro presentaciones, un solo chat

El mismo chat (misma conversación, mismo texto a medio escribir) se muestra de cuatro formas según
el ancho. Cambiar de una a otra no recarga nada.

| Ancho | Vista | Cómo se comporta |
|---|---|---|
| ≥ 1280 px | **Lateral que empuja** | Panel a la derecha, 400 px (redimensionable 320–560 con un tirador en el borde izquierdo). El contenido del panel se corre, **no queda tapado**. No es modal |
| 768–1279 px | **Superpuesto** | Mismo panel encima del contenido, con fondo tenue detrás. Se cierra tocando afuera o con Esc. Modal |
| < 768 px | **Hoja desde abajo** | Media altura o pantalla completa (arrastrable), respeta el teclado del celular y los bordes seguros (notch, barra de inicio) |
| Cualquiera | **Página dedicada** | Ruta propia del panel. Lista de sesiones a la izquierda (≥ 1024 px) o en un desplegable arriba (< 1024), chat al centro con ancho de lectura de 760 px como máximo |

Mostrame cada vista **con el panel de fondo** (por ejemplo, la pantalla de Pedidos), en claro y en
oscuro, para ver cómo convive.

### A2. Encabezado del chat

- Título de la sesión (es un botón: en el lateral abre el selector de sesiones).
- Botones de ícono: **Nueva sesión**, **Expandir a página**, **Abrir en pestaña nueva**, **Cerrar**.
  En el celular, áreas táctiles de 44 × 44 px.
- **Reservá un espacio a la derecha** para una barra de "uso restante" que llega más adelante
  (Parte B): cuando aparezca no tiene que mover nada.

### A3. Un mensaje de Orbi, por partes

Mientras Orbi trabaja se ve todo en vivo y en este orden. Diseñá cada parte y el mensaje completo:

1. **Pensamiento:** una línea corta en texto atenuado por cada paso ("Voy a buscar los pedidos
   pendientes de esta semana"). Es la narración de Orbi, no un razonamiento técnico.
2. **Actividad:** una fila por cada consulta que hizo, con ícono de estado (**en curso**, **listo**,
   **error**), una etiqueta en castellano, un resumen y el tiempo: "Buscó pedidos pendientes · 4
   encontrados · 0,8 s". Algunas filas tienen un botón **"Ir a Pedidos"**.
3. **Tarjeta de aprobación:** cuando Orbi propone un cambio. Muestra qué va a hacer con cada valor
   (por ejemplo: "Marcar el pedido #1024 de Ana López como **Enviado**") y dos botones,
   **Confirmar** y **Cancelar**. Estados: pendiente, aplicada, cancelada, vencida. Diseñá los cuatro.
4. **Respuesta:** el texto final, que se escribe en vivo. Puede traer negrita, listas, encabezados
   chicos, links internos del panel y alguna **tabla chica** (por ejemplo, ventas por día de la
   semana). Diseñá cómo se ve cada uno.

**Al terminar**, el pensamiento y la actividad se pliegan en una línea que se puede abrir: "Revisó 3
cosas · 6 s". Diseñá plegado y desplegado.

Casos que también quiero ver:
- Una respuesta **cortada** por la persona: lo que llegó más un aviso "Detenido".
- Una **falla pasajera**: "Orbi tuvo un problema para responder. Probá de nuevo en unos minutos",
  con botón Reintentar.
- **Orbi en mantenimiento** (cuando el proveedor de IA está caído y un admin lo apagó): un aviso fijo
  arriba del input ("Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo.
  Mientras tanto, el Manual del panel sigue disponible", con link al Manual), input deshabilitado y
  sin repetir el aviso en cada mensaje.
- Un **mensaje de la persona** (burbuja simple, alineada a la derecha).

### A4. Input

- Caja de texto que crece hasta 6 líneas. Enter envía, Shift+Enter baja de línea.
- Botón Enviar que, mientras Orbi responde, pasa a **Detener** (mismo lugar, otro ícono y etiqueta).
- **Chip de contexto** arriba del texto: "Viendo: Pedidos" (la pantalla actual), con una X para
  sacarlo.
- **Prompts sugeridos** debajo, de 4 a 6 según la pantalla ("¿Cuánto vendí esta semana?", "¿Qué
  pedidos están sin enviar?"). Al tocarlos se copian en la caja, **no se envían**. Se ven cuando la
  sesión está vacía; con conversación, quedan accesibles sin ocupar lugar fijo (proponé cómo).
- Etiqueta visible o accesible "Escribile a Orbi" (no solo un placeholder).

### A5. Sesiones

- Lista agrupada por **Hoy / Ayer / Esta semana / Antes**, con las **fijadas** arriba, una búsqueda
  por título y un filtro de **archivadas**.
- Cada fila: título, cuándo, y un indicador si Orbi está **esperando una aprobación** en esa sesión
  (que no dependa solo del color).
- Menú de tres puntos por fila: **Renombrar** (edición en el lugar), **Fijar / Desfijar**,
  **Archivar**, **Borrar**. Borrar abre una confirmación: "Se borra la conversación. No se puede
  deshacer". Las archivadas se borran solas a los 180 días sin actividad: decilo en el filtro de
  archivadas, en una línea.
- Diseñala en el lateral (desplegable desde el título) y en la página dedicada (columna izquierda).

### A6. Estados vacíos y de carga

- **Sesión nueva**: el logo de Orbi, un saludo corto y los prompts sugeridos de la pantalla.
- **Sin sesiones todavía** y **búsqueda sin resultados**.
- **Cargando una sesión** (esqueleto, sin saltos de layout).

### A7. Movimiento

- Entradas de 150–300 ms, `ease-out`, solo con `transform` y `opacity`; animá uno o dos elementos
  por vista, no todo.
- Con **movimiento reducido** activado: sin deslizamientos, sin efecto de tipeo, el logo quieto.
  Indicá qué cambia.

### A8. Accesibilidad (se revisa contra esto)

- Contraste 4,5:1 en claro **y** en oscuro para todo texto, incluido el pensamiento atenuado.
- Foco visible en todo lo interactivo (anillo con `--color-primary`), orden de tabulación igual al
  visual.
- Ningún estado comunicado **solo con color** (activo/error/esperando llevan ícono o texto).
- Áreas táctiles de 44 px con 8 px de separación en el celular.
- Sin scroll horizontal a 375, 768, 1024 y 1440 px. Sin texto de cuerpo menor a 16 px en el celular.

## Parte B — Lo que llega después (boceto, para que la Parte A no se tenga que rehacer)

No hace falta detalle. Quiero ver que **encajan** en lo de arriba sin moverlo:

1. **Barra de uso restante** en el encabezado: un porcentaje ("Te queda 62 % del día"), **nunca**
   tokens ni dólares. Y un estado "llegaste al límite de hoy".
2. **Selector de modo** en el input, al estilo de los asistentes de código: *Solo consultas* /
   *Preguntarme antes* (default) / *Automático* / *Sin confirmaciones*.
3. **Tarjeta de aprobación completa**: "Ver completo" para textos largos, Editar antes de aprobar.
4. **@menciones** en el input: al escribir @ aparece un buscador de pedidos, productos y clientes del
   negocio; la mención queda como un chip dentro del texto.
5. **Cola de tareas**: cuando Orbi hace un trabajo largo de varios pasos, una lista con el estado y
   el progreso de cada paso.

## Qué te pido que entregues

1. Cada pantalla de la Parte A en **escritorio (1440), tablet (1024) y celular (375)**, en **claro y
   oscuro**.
2. Los componentes sueltos con todos sus estados (fila de actividad, tarjeta, input, fila de
   sesión, menú, avisos).
3. Especificaciones: medidas, espaciados, radios, tokens usados por elemento y duraciones de
   animación.
4. La Parte B como boceto, sobre las mismas pantallas.
5. Una lista corta de **las decisiones que tomaste** y que yo debería confirmar.
