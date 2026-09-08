# Orbi Wizard Adaptive UI — Design Spec

**Fecha:** 2026-09-04
**Estado:** Aprobado para implementación

## Problema

Orbi en el Wizard tiene tres problemas de UX:

1. **FAB estático**: El botón flotante de Orbi (`bottom: 90px`) no reacciona al footer del wizard — en `ElegirRubro` el footer aparece/desaparece con animación, y el FAB queda fijo sin adaptarse.
2. **Mobile inutilizable**: El panel lateral (360px → 100vw en mobile) tapa completamente el wizard. El usuario no puede ver las opciones mientras recibe sugerencias de Orbi.
3. **Sin bienvenida proactiva**: No hay mensaje de bienvenida al entrar al wizard. El usuario no sabe que Orbi existe hasta que toca el FAB o pasan 30s de inactividad en un campo.

## Decisiones de diseño

- **FAB adaptativo**: se desliza arriba del footer cuando aparece, baja cuando desaparece.
- **Mobile**: híbrido burbuja+chips (sugerencias rápidas sin panel) + bottom sheet parcial (chat expandido ~45% pantalla).
- **Desktop**: panel lateral de 360px sin cambios funcionales.
- **Bienvenida**: burbuja auto-expandida con mensaje de saludo al entrar al primer paso, auto-colapso a los 6 segundos.

## Arquitectura de componentes

### 1. `OrbiWizardFAB` (nuevo)

Reemplaza el markup inline duplicado en `ElegirRubro.tsx:387-403` y `SetupUnificado.tsx:1129-1145`.

**Props:**
```ts
interface OrbiWizardFABProps {
  onClick: () => void
}
```

**Comportamiento:**
- Lee `--orbi-wizard-bottom` (CSS variable ya publicada por `useOrbiSafeArea`) para calcular su posición `bottom`.
- Cuando `--orbi-wizard-bottom` es `0px` (sin footer): `bottom: 24px`.
- Cuando `--orbi-wizard-bottom` > 0 (footer visible): `bottom: footerHeight + 16px`.
- Transición CSS: `transition: bottom 250ms ease-out`.
- Usa `MutationObserver` en `document.documentElement.style` para reaccionar a cambios en la CSS variable, o alternativamente lee el valor en un `useLayoutEffect` con las mismas deps que `useOrbiSafeArea`.
- Se oculta (`opacity: 0, pointer-events: none`) cuando el panel/bottom-sheet de Orbi está abierto.

**Estilos (sin cambios visuales, mismos que el actual):**
- 48x48px, `border-radius: 50%`
- `background: linear-gradient(135deg, #3B82F6, #8B5CF6)`
- `box-shadow: 0 4px 16px rgba(59,130,246,0.35)`
- `z-index: 170`
- Hover: `scale(1.08)`, transición 150ms

### 2. `OrbiBubble` (nuevo)

Burbuja flotante que muestra mensajes de Orbi sin abrir el panel. Posicionada relativa al FAB (arriba-izquierda).

**Props:**
```ts
interface OrbiBubbleProps {
  message: string
  chips?: { label: string; action: () => void }[]
  onDismiss: () => void
  autoHideMs?: number // default: undefined (no auto-hide)
}
```

**Comportamiento:**
- Aparece arriba del FAB, alineada a la derecha.
- `max-width: 280px` en desktop, en mobile `left: 16px; right: 72px` (deja espacio para el FAB).
- Animación de entrada: `scale(0.9) + opacity(0)` → `scale(1) + opacity(1)`, origin en bottom-right, 250ms ease-out.
- Animación de salida: inversa, 150ms.
- Tiene un botón X para cerrar.
- Si `autoHideMs` está definido, se auto-cierra después de ese tiempo.
- Al tocar un chip → ejecuta `action()` y cierra la burbuja.
- Si el usuario toca fuera de la burbuja y del FAB → cierra.
- `z-index: 175` (entre FAB=170 y panel/backdrop=199).
- Posición `bottom`: misma lógica que el FAB + la altura del FAB (48px) + gap (12px).

**Estilos:**
- `background: var(--color-bg)`, `border: 1px solid var(--color-border)`
- `border-radius: 16px`, `padding: 14px 18px`
- `box-shadow: 0 8px 32px rgba(0,0,0,0.12)`
- Chips: pills con `background: rgba(59,130,246,0.1)`, `color: #3B82F6`, `border-radius: 8px`, `padding: 6px 14px`, `font-size: 12px`, `font-weight: 600`.

**Reemplaza `OrbiNudge`:** La funcionalidad de nudge por inactividad se migra a usar `OrbiBubble` en vez de `OrbiNudge`. `OrbiNudge.tsx` se depreca.

### 3. `OrbiBottomSheet` (nuevo)

Panel de Orbi en formato bottom sheet para mobile (< 768px).

**Props:**
```ts
interface OrbiBottomSheetProps {
  onClose: () => void
}
```

**Estados (3):**
- **Cerrado**: no renderizado.
- **Peek** (~45% de viewport): header + últimos mensajes + input visible. El wizard se ve arriba.
- **Full** (100% - safe-area-top): chat completo igual al panel actual.

**Gestos de drag:**
- Drag handle visible en la parte superior (pill de 40x4px, `background: var(--color-border)`).
- Drag hacia arriba desde peek → full.
- Drag hacia abajo desde peek → cerrado.
- Drag hacia abajo desde full → peek.
- Implementación: `touch events` (touchstart/touchmove/touchend) con threshold de 50px para cambiar de estado.
- `will-change: transform` durante el drag para performance.

**Layout interno (igual que OrbiPanel):**
1. Drag handle (8px altura, centrado)
2. Header (icono Orbi + título + X)
3. `<OrbiMessages />` (flex: 1, scroll)
4. `<OrbiInput />` (sticky bottom, respeta safe-area-bottom)

**Estilos:**
- `position: fixed`, `left: 0`, `right: 0`, `bottom: 0`
- `z-index: 200`
- `border-radius: 16px 16px 0 0`
- `background: var(--color-bg)`
- `box-shadow: 0 -8px 32px rgba(0,0,0,0.15)`
- Backdrop: `rgba(0,0,0,0.15)`, clickeable para cerrar.
- Transición entre estados: `transform: translateY()`, 250ms ease-out.
- Altura peek: `45vh`. Altura full: `calc(100vh - env(safe-area-inset-top))`.

### 4. Modificaciones a `OrbiPanel` (existente)

**Cambio central:** Routing condicional basado en viewport.

```tsx
export function OrbiPanel() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  // ... existing logic ...
  if (!isOpen) return null
  if (isMobile) return <OrbiBottomSheet onClose={close} />
  // ... existing desktop panel JSX ...
}
```

Se necesita un hook `useMediaQuery` — si no existe en el proyecto, se crea inline (4 líneas con `matchMedia`).

El panel desktop no cambia: misma posición, mismo ancho 360px, mismas CSS variables.

### 5. Modificaciones a `useOrbiStore` (existente)

Nuevos campos y acciones para la burbuja:

```ts
// Nuevos campos en OrbiState
bubble: { message: string; chips?: { label: string; actionKey: string }[]; autoHideMs?: number } | null
welcomeShown: boolean  // flag para no repetir bienvenida

// Nuevas acciones
showBubble: (bubble: OrbiState['bubble']) => void
hideBubble: () => void
markWelcomeShown: () => void
```

`welcomeShown` NO persiste — vive solo en memoria de Zustand. Un refresh de la página resetea el flag, lo que es aceptable (el usuario vuelve a ver el saludo si refresca — no es molesto porque es un saludo, no un popup recurrente). Si se necesita persistencia, se usa `sessionStorage` directamente en el componente que dispara la bienvenida.

### 6. Mensaje de bienvenida proactivo

**Trigger:** En `ElegirRubro.tsx`, un `useEffect` que se ejecuta 1.5s después del mount:

```ts
useEffect(() => {
  const shown = sessionStorage.getItem('orbi-welcome-shown')
  if (shown) return
  const timer = setTimeout(() => {
    useOrbiStore.getState().showBubble({
      message: '¡Hola! Soy Orbi, tu asistente. Estoy acá para ayudarte a crear tu tienda.',
      autoHideMs: 6000,
    })
    sessionStorage.setItem('orbi-welcome-shown', '1')
  }, 1500)
  return () => clearTimeout(timer)
}, [])
```

- Delay de 1.5s para que la página termine de renderizar y el usuario tenga contexto.
- No muestra chips (es solo saludo).
- Auto-colapso a los 6 segundos.
- `sessionStorage` para no repetir en la misma sesión de navegador, pero sí en sesiones nuevas.

### 7. Migración de `OrbiNudge` → `OrbiBubble`

La lógica de `useInactivityDetector` se mantiene intacta. Lo que cambia es el render:

En `SetupUnificado.tsx`, donde hoy se renderiza `<OrbiNudge>`:

```tsx
// Antes:
{idleField && !isOrbiOpen && <OrbiNudge field={idleField} context={orbiContext} onDismiss={...} />}

// Después:
useEffect(() => {
  if (idleField && !useOrbiStore.getState().isOpen) {
    useOrbiStore.getState().showBubble({
      message: `¿Te ayudo con ${FIELD_LABELS[idleField] ?? idleField}?`,
      chips: [
        { label: 'Sí, dale', actionKey: `help-${idleField}` },
        { label: 'No, gracias', actionKey: 'dismiss' },
      ],
    })
  }
}, [idleField])
```

Los chips ejecutan acciones a través de un handler en `SetupUnificado` que resuelve `actionKey`:
- `help-<field>` → abre panel + envía mensaje a Orbi.
- `dismiss` → cierra la burbuja + marca el campo como dismissed.

### 8. Modificaciones a `ElegirRubro.tsx`

- Eliminar FAB inline (líneas 387-403).
- Agregar `<OrbiWizardFAB onClick={toggleOrbi} />`.
- Agregar `<OrbiBubble>` condicional basado en `useOrbiStore(s => s.bubble)`.
- Agregar `useEffect` de bienvenida proactiva.

### 9. Modificaciones a `SetupUnificado.tsx`

- Eliminar FAB inline (líneas 1129-1145).
- Agregar `<OrbiWizardFAB onClick={toggleOrbi} />`.
- Agregar `<OrbiBubble>` condicional.
- Reemplazar `<OrbiNudge>` por lógica de burbuja (ver sección 7).

## z-index stack

| Elemento | z-index | Notas |
|---|---|---|
| Wizard header (sticky) | 50 / 1000 | ElegirRubro=50, SetupUnificado=1000 |
| Footer wizard | 100 / 1000 | ElegirRubro=100, SetupUnificado=1000 |
| OrbiWizardFAB | 170 | Sin cambio |
| OrbiBubble | 175 | Nuevo — entre FAB y backdrop |
| OrbiPanel backdrop | 199 | Sin cambio |
| OrbiPanel / OrbiBottomSheet | 200 | Sin cambio |

## Animaciones

| Elemento | Entrada | Salida | Duración |
|---|---|---|---|
| FAB ↕ | `transition: bottom 250ms ease-out` | Misma transición | 250ms |
| Burbuja | `scale(0.9) opacity(0)` → `scale(1) opacity(1)` | Inversa | 250ms / 150ms |
| Bottom sheet (peek) | `translateY(100%)` → `translateY(55%)` | `translateY(100%)` | 250ms ease-out |
| Bottom sheet (full) | `translateY(55%)` → `translateY(0)` | `translateY(55%)` | 250ms ease-out |
| Footer wizard (ElegirRubro) | `fadeUp 0.3s ease` | — | 300ms (existente) |

## Accesibilidad

- FAB: `aria-label="Abrir asistente Orbi"`, `role="button"`.
- Burbuja: `role="alert"`, `aria-live="polite"` para que screen readers anuncien el mensaje.
- Bottom sheet: focus trap cuando está en estado full. `aria-modal="true"`.
- Chips: botones reales (`<button>`), no divs. Min size 44x44px (touch target).
- Escape cierra burbuja y bottom sheet (ya existe para panel).
- `prefers-reduced-motion`: duración de animaciones → 0ms.

## Archivos involucrados

| Archivo | Acción |
|---|---|
| `apps/web/src/components/orbi/OrbiWizardFAB.tsx` | Crear |
| `apps/web/src/components/orbi/OrbiBubble.tsx` | Crear |
| `apps/web/src/components/orbi/OrbiBottomSheet.tsx` | Crear |
| `apps/web/src/components/orbi/OrbiPanel.tsx` | Modificar (routing mobile) |
| `apps/web/src/components/orbi/useOrbiStore.ts` | Modificar (bubble state) |
| `apps/web/src/components/orbi/useMediaQuery.ts` | Crear (si no existe) |
| `apps/web/src/modules/onboarding/ElegirRubro.tsx` | Modificar |
| `apps/web/src/modules/onboarding/SetupUnificado.tsx` | Modificar |
| `apps/web/src/components/orbi/OrbiNudge.tsx` | Deprecar (mantener archivo, eliminar uso) |
| `apps/web/src/components/orbi/useInactivityDetector.ts` | Sin cambios |
