# Orbi en el wizard móvil — full-screen + tira de contexto — Design Spec

**Fecha:** 2026-09-09
**Estado:** Aprobado para implementación
**Reemplaza:** la parte "Mobile" de [`2026-09-04-orbi-wizard-adaptive-ui-design.md`](2026-09-04-orbi-wizard-adaptive-ui-design.md)
(el `OrbiBottomSheet` con estados peek/full). El FAB adaptativo, la burbuja y la
bienvenida proactiva de ese spec **quedan como están**.

## Problema

Orbi en el wizard, en teléfonos, hoy usa `OrbiBottomSheet` con estados
**peek (45vh) / full**. Problemas verificados en el código:

1. **Hueco entre input y teclado.** El sheet es `position: fixed; bottom: 0` con
   alto en `vh`. En iOS Safari el viewport de layout **no se achica** al aparecer
   el teclado: el borde inferior del sheet queda detrás del teclado, iOS empuja
   la página para revelar el input, y entre el input y el teclado queda una
   franja donde asoma el wizard. **No hay nada de `visualViewport` en todo Orbi.**
2. **Zoom de iOS al enfocar.** `OrbiInput` usa `font-size: 13px`; Safari hace
   auto-zoom con inputs `< 16px`.
3. **El drag para cerrar se dispara al scrollear los mensajes.** El handler de
   `OrbiBottomSheet` busca `.orbi-messages-scroll` y `.orbi-input-area` para
   ignorar el gesto, pero **esas clases no existen** en `OrbiMessages` ni en
   `OrbiInput`.
4. **`transition: height 250ms`** en el sheet → animar `height` tironea.
5. **peek 45vh + teclado ~40vh** → el área de chat queda inservible y el 15%
   restante muestra el wizard por detrás (confuso).
6. `100vh` en vez de `100dvh`/`svh`; backdrop muy tenue.

Además, el objetivo original ("ver el wizard mientras Orbi sugiere") pelea con la
física del teléfono: en 375px no entra bien formulario + chat a la vez.

## Decisión de diseño

**Orbi en el wizard móvil pasa a ser full-screen, con una tira de contexto
arriba. Se elimina el estado `peek` en móvil.** Un solo tamaño.

Orbi sigue siendo un **copiloto por paso**: el formulario es la columna
vertebral, Orbi recomienda / rellena / tilda usando las tools que ya tiene
(`selectWizardOption`, `fillWizardField`, `suggestBusinessName`,
`suggestSubdomain`, `suggestDescription`), y **ofrece** "Continuar" cuando el
paso está válido. Orbi no navega el wizard por su cuenta.

### Layout de la pantalla de Orbi (móvil, wizard)

```
┌───────────────────────────────┐
│  ● Orbi                      ✕ │  tira de contexto (fija)
│  Paso 3 de 5 · Tu negocio      │
│  [✓ Nombre] [✦ Descripción] …  │  chips del paso
├───────────────────────────────┤
│  chat (scroll, anclado abajo)  │
│                                │
├───────────────────────────────┤
│  [chips rápidos del paso]      │  composer (fijo, sobre el teclado)
│  [ Escribí un mensaje…    ▶ ]  │
└───────────────────────────────┘
```

- **Tira de contexto** (`OrbiWizardCtx`, nuevo): reemplaza el header actual del
  sheet.
  - Fila: avatar Orbi + "Orbi" + `Paso N de M · <label del paso>` + botón ✕.
  - Fila de **chips del paso** (scroll horizontal): ver "Chips por paso".
  - `M` = cantidad total de pasos del onboarding (rubro + los del wizard +
    cuenta). `N` = paso actual. Se saca del contexto (ver más abajo).
- **Chat**: `OrbiMessages` sin cambios de contenido. Vive **siempre** por encima
  del teclado (nunca lo cruza). Se reancla al fondo (`scrollTop = scrollHeight`)
  al aparecer/desaparecer el teclado y al llegar un mensaje nuevo.
- **Composer** (`OrbiInput` retocado): fila de chips rápidos del paso + barra de
  input. `font-size: 16px` mínimo. Textarea que crece hasta ~4 líneas. Pegado
  arriba del teclado.
- **Cierre**: X en la tira, gesto de arrastrar hacia abajo desde la tira, o
  Escape. Al cerrar se vuelve al wizard en el mismo paso, con los campos llenos y
  el resalte violeta (`sugeridosPorOrbi`).

### Manejo del teclado / viewport — `useOrbiViewport` (nuevo hook)

`apps/web/src/components/orbi/useOrbiViewport.ts`

- Escucha `window.visualViewport` (`resize` + `scroll`), con fallback a
  `window` si no existe.
- Calcula:
  - `keyboardHeight = Math.max(0, layoutH - vv.height - vv.offsetTop)`
    (`layoutH` = `document.documentElement.clientHeight`).
  - `offsetTop = vv.offsetTop` (iOS desplaza el visual viewport al enfocar).
- Publica esos valores como estado **y** como CSS vars en
  `document.documentElement`: `--orbi-vv-height`, `--orbi-kb`, `--orbi-vv-top`.
- Debounce/rAF para no thrashear en el gesto de scroll del teclado.
- Devuelve `{ keyboardHeight, viewportHeight, offsetTop, keyboardOpen }`.

El sheet se posiciona:
```
position: fixed;
top: 0; left: 0; right: 0;
height: var(--orbi-vv-height, 100dvh);
transform: translateY(var(--orbi-vv-top, 0px));
```
Con eso el borde inferior del sheet se apoya **exacto** sobre el teclado y el
composer queda flush contra él. Sin hueco.

**Extra global (a revisar aparte, no bloquea):** agregar
`interactive-widget=resizes-content` al `<meta name="viewport">` de
[`_document.tsx`](../../../apps/web/src/pages/_document.tsx). Ayuda en Android.
Verificar que no mueva la landing ni el panel antes de mergear.

### Body scroll lock

Mientras el sheet está abierto en móvil: bloquear el scroll del `<body>`
(`overflow: hidden` + guardar/restaurar `scrollY`), para que el wizard de atrás
no scrollee bajo el sheet. Se limpia al cerrar.

### Chips por paso

Las chips son **100% por paso**. En los pasos con campos, reflejan **qué falta**:
`✦ <campo>` (violeta) = Orbi puede ayudar y está vacío; `✓ <campo>` (verde) = ya
está. Tocar una chip hace `send("Ayudame con <campo>", context)` y (si Orbi está
cerrado, que en móvil no aplica) lo abre.

| stepName | Chips | Tipo |
|---|---|---|
| `elegir-rubro` | "Vendo productos", "Doy servicios", "Ayudame a elegir" | prompt |
| `subrubros` | "Ropa y calzado", "Varios tipos", "¿Cuáles elijo?" | prompt |
| `tu-negocio` | `Nombre`, `Descripción`, `Subdominio` (+ `Modo de venta` si `conModoVenta`) | campo, con estado ✦/✓ |
| `ubicacion` | "Vendo solo online", "Tengo local", "Los dos" | prompt |
| `cuenta` | "¿Por qué necesito cuenta?", "¿Es seguro?" | prompt (informativas) |

Los textos exactos se afinan en implementación; la estructura es esta.

**Chips rápidos del composer** (fila sobre el input): 2-3 por paso, distintas de
las de la tira — son "siguiente acción sugerida" ("Sugerime una descripción",
"¿Qué es el subdominio?").

### Avance de paso desde Orbi

- `SetupUnificado` ya calcula `bloqueo: { campo, texto } | null` y
  `puedeAvanzar`. `ElegirRubro` tiene su equivalente.
- Se extiende `WizardOverrides` (en
  [`useOrbiContext.ts`](../../../apps/web/src/components/orbi/useOrbiContext.ts))
  con:
  ```ts
  stepChips?: { key: string; label: string; filled?: boolean; kind: 'field' | 'prompt' }[]
  totalSteps?: number
  stepIndex?: number       // 1-based
  canAdvance?: boolean
  blockReason?: string | null
  ```
  Lo computan `SetupUnificado` / `ElegirRubro` en el mismo `useEffect` que ya
  llama `setWizardContext`, agregando como deps los valores de campo — pero
  **solo re-llamando `setWizardContext` cuando cambia el estado vacío/lleno de un
  campo** (comparar contra el anterior), no en cada tecla, para no re-renderizar
  el sheet de más.
- La tira muestra, debajo del chat o como card al final de los mensajes:
  - `canAdvance === true` → card "Paso completo · **Continuar →**".
  - `canAdvance === false` con `blockReason` → texto ámbar "Te falta: `<blockReason>`".
- El botón "Continuar" del sheet hace
  `window.dispatchEvent(new CustomEvent('orbi:advance-step'))`.
  `SetupUnificado` / `ElegirRubro` escuchan ese evento (igual que ya escuchan
  `orbi:select-option`) y llaman su `avanzar()` si `puedeAvanzar`.
- Al cambiar `stepName`, `setWizardContext` ya emite el divider y el mensaje
  "¡Avanzaste a X!" — se mantiene. La tira y las chips se actualizan solas
  (`useSyncExternalStore`).

## Arquitectura de componentes

### Nuevos

| Archivo | Qué es |
|---|---|
| `apps/web/src/components/orbi/useOrbiViewport.ts` | Hook `visualViewport`: alto del teclado, offset, CSS vars. |
| `apps/web/src/components/orbi/OrbiWizardCtx.tsx` | Tira de contexto (fila paso + chips). Solo móvil-wizard. |
| `apps/web/src/components/orbi/OrbiStepChips.ts` | Config declarativa `stepName → chips` + helper para el estado ✦/✓ a partir del `formState`. |

### Modificados

| Archivo | Cambio |
|---|---|
| `OrbiBottomSheet.tsx` | Reescribir: full-screen (sin `peek`), usa `useOrbiViewport` para posicionar, tira `OrbiWizardCtx` en vez del header actual, gesto de drag-down solo en la tira, body scroll lock, animar `transform` no `height`. |
| `OrbiInput.tsx` | `font-size: 16px` (mejora barata compartida: aplica a wizard **y** panel); `<input>` → `<textarea rows=1>` con auto-grow (máx ~4 líneas); clase `orbi-input-area` real; fila de chips rápidos del paso (prop nueva `quickChips`, solo la pasa el sheet del wizard). |
| `OrbiMessages.tsx` | Clase `orbi-messages-scroll` real en el contenedor scrolleable; reanclar al fondo cuando cambia `--orbi-kb`. |
| `OrbiPanel.tsx` | Sin cambios de routing: sigue `isMobile && isWizard → OrbiBottomSheet`. El panel no-wizard móvil (`.orbi-panel-root` a `100vw`) **queda como está** en esta ronda salvo por la mejora barata compartida (ver abajo). Unificar los dos a un mismo sheet es un follow-up. |
| `useOrbiContext.ts` | `WizardOverrides` + `OrbiContext` con `stepChips`, `totalSteps`, `stepIndex`, `canAdvance`, `blockReason`. |
| `types.ts` | Reflejar los campos nuevos de `OrbiContext`. |
| `SetupUnificado.tsx` | Calcular y pasar `stepChips` / `canAdvance` / `blockReason` a `setWizardContext`; escuchar `orbi:advance-step`; re-llamar `setWizardContext` solo cuando cambia lleno/vacío de un campo. |
| `ElegirRubro.tsx` | Ídem para su paso (chips prompt, `canAdvance` = hay opción elegida). |
| `_document.tsx` | *(opcional, PR aparte)* `interactive-widget=resizes-content`. |

### Sin cambios

`OrbiWizardFAB`, `OrbiBubble`, `useOrbiSafeArea` (sigue para el panel desktop),
`useOrbiChat`, backend de Orbi, tools, prompts.

## z-index / animación

- Sheet full-screen: `z-index: 200` (sin cambio). Backdrop: se puede sacar (el
  sheet tapa todo) o subir a `rgba(0,0,0,.35)` para el instante de la animación.
- Entrada: `translateY(100%) → translateY(0)`, 280ms `cubic-bezier(.32,.72,0,1)`.
- `prefers-reduced-motion`: sin transición.

## Accesibilidad

- Sheet: `role="dialog"`, `aria-modal="true"`, focus trap, Escape cierra.
- Chips: `<button>` reales, target ≥ 44×44.
- Tira: el `Paso N de M` como texto normal (no `aria-live` — cambia en respuesta
  a una acción del usuario).
- La card "Paso completo / Te falta X": `aria-live="polite"`.
- Textarea con `aria-label`.

## Fuera de alcance

- Rediseño del panel de Orbi en desktop.
- Cambiar las tools o los prompts de Orbi.
- Que Orbi navegue el wizard de forma autónoma (sigue siendo copiloto por paso).
- El modelo conversacional puro (hacer todo el onboarding chateando).

## Riesgos / cosas a verificar

- `visualViewport` en el WebView de Instagram/IG in-app browser (mucho tráfico de
  onboarding entra por ahí) — probar.
- `interactive-widget` puede mover otras pantallas → PR aparte, con revisión
  visual de landing + panel.
- El `useEffect` de `setWizardContext` en `SetupUnificado` no debe entrar en loop
  al agregar deps de formulario — comparar contra el snapshot anterior antes de
  notificar.
- iOS: al cerrar el sheet, restaurar bien el `scrollY` del wizard.
