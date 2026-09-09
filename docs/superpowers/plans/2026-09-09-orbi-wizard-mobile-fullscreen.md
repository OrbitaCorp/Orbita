# Orbi Wizard Móvil — Full-Screen + Tira de Contexto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer Orbi en el wizard de onboarding en teléfonos: un panel full-screen con una tira de contexto (paso actual + chips por paso), el input pegado al teclado sin huecos, y un puente para avanzar de paso desde el chat.

**Architecture:** Se reemplaza el `OrbiBottomSheet` con estados peek/full por un sheet full-screen posicionado con `visualViewport` (nuevo hook `useOrbiViewport`). Una tira de contexto (`OrbiWizardCtx`) muestra `Paso N de M` + chips derivadas del `stepName` y del estado del formulario. `SetupUnificado`/`ElegirRubro` publican los datos del paso vía el `setWizardContext` que ya existe; el botón "Continuar" del chat despacha un `CustomEvent('orbi:advance-step')` que el wizard ya-escucha-eventos-parecidos consume. Orbi sigue siendo copiloto por paso: no navega solo.

**Tech Stack:** Next.js (pages router), React 18, TypeScript, Zustand (`useOrbiStore`), `useSyncExternalStore` (`useOrbiContext`), vitest (`environment: 'node'`, solo lógica pura — sin jsdom ni testing-library), estilos inline + `<style>` embebido (patrón del proyecto para Orbi).

**Spec:** [`docs/superpowers/specs/2026-09-09-orbi-wizard-mobile-fullscreen-design.md`](../specs/2026-09-09-orbi-wizard-mobile-fullscreen-design.md)

## Global Constraints

- **Estilos:** los componentes de Orbi usan **estilos inline** (`style={{...}}`) y bloques `<style>{`...`}</style>` embebidos, con variables CSS `var(--color-*)`. No hay Tailwind en `components/orbi/`. Seguir ese patrón — NO introducir clases utilitarias nuevas ni CSS modules.
- **`<style>` embebido:** el contenido va en un template literal con backticks. **Nunca** poner backticks dentro del texto del CSS/comentarios de ese bloque (rompe el parser JSX). Ya pasó una vez.
- **Tests:** vitest con `environment: 'node'`, `include: ['src/**/*.test.ts']`. Solo se testea **lógica pura** en archivos `.ts` (no `.tsx`, no hooks, no componentes). Correr: `npm --prefix apps/web run test`.
- **Typecheck:** `npm --prefix apps/web run typecheck` (`tsc --noEmit`). Ya hay errores preexistentes por tipos de `vitest` faltantes en 4 archivos `*.test.ts` — ignorar esos; ningún archivo de este plan debe sumar errores nuevos.
- **Lint:** `npm --prefix apps/web run lint`.
- **Español rioplatense** en todo texto de UI y comentarios (vos/tenés/querés).
- **`prefers-reduced-motion`:** toda transición/animación nueva se apaga bajo `@media (prefers-reduced-motion: reduce)`.
- **Touch targets** ≥ 44×44 px en todo control nuevo.
- **iOS:** el input de texto debe tener `font-size` ≥ 16px (si no, Safari hace zoom al enfocar).
- **Commits:** frecuentes, uno por task como mínimo. Cerrar los mensajes con:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Rama:** el trabajo va en una rama, no directo a `main` (el repo despliega el frontend en cada push a `main`).
- **No tocar:** el backend de Orbi (`apps/api/src/orbi/`), sus prompts, sus tools. Este plan es 100% frontend.

---

## File Structure

### Nuevos

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/components/orbi/orbiViewport.ts` | Función pura `computeKeyboardMetrics()` — el cálculo del alto del teclado a partir de medidas del viewport. Testeable sin DOM. |
| `apps/web/src/components/orbi/orbiViewport.test.ts` | Tests de `computeKeyboardMetrics()`. |
| `apps/web/src/components/orbi/useOrbiViewport.ts` | Hook React: suscribe `window.visualViewport`, publica `--orbi-vv-height` / `--orbi-kb` / `--orbi-vv-top` en `<html>`, devuelve `{ keyboardHeight, viewportHeight, offsetTop, keyboardOpen }`. |
| `apps/web/src/components/orbi/orbiWizardSteps.ts` | Config declarativa `stepName → { label, chips, quickChips }` + `deriveStepChips(stepName, form, opts)` puro. |
| `apps/web/src/components/orbi/orbiWizardSteps.test.ts` | Tests de `deriveStepChips()`. |
| `apps/web/src/components/orbi/OrbiWizardCtx.tsx` | La tira de contexto: fila (avatar + "Orbi" + `Paso N de M · label` + ✕) + fila de chips del paso. Solo se usa dentro del sheet full-screen del wizard. |

### Modificados

| Archivo | Cambio |
|---|---|
| `apps/web/src/components/orbi/types.ts` | `OrbiContext` gana `stepChips`, `totalSteps`, `stepIndex`, `canAdvance`, `blockReason`. |
| `apps/web/src/components/orbi/useOrbiContext.ts` | `WizardOverrides` refleja los campos nuevos; se propagan al `OrbiContext` del branch `wizard`. |
| `apps/web/src/components/orbi/OrbiInput.tsx` | `font-size: 16px`; `<input>` → `<textarea>` con auto-grow; clase real `orbi-input-area`; prop opcional `quickChips`. |
| `apps/web/src/components/orbi/OrbiMessages.tsx` | Clase real `orbi-messages-scroll` en el div scrolleable; reanclar al fondo cuando cambia `--orbi-kb`. |
| `apps/web/src/components/orbi/OrbiBottomSheet.tsx` | Reescritura: full-screen (sin `peek`), posicionado con `useOrbiViewport`, tira `OrbiWizardCtx`, drag-down solo desde la tira, body scroll lock, animación por `transform`, card "Continuar / Te falta X". |
| `apps/web/src/modules/onboarding/SetupUnificado.tsx` | Computa y pasa `stepChips/totalSteps/stepIndex/canAdvance/blockReason` a `setWizardContext`; escucha `orbi:advance-step`. |
| `apps/web/src/modules/onboarding/ElegirRubro.tsx` | Pasa chips tipo prompt + `totalSteps/stepIndex` (paso 1). |

### Sin tocar

`OrbiPanel.tsx` (routing igual: `isMobile && isWizard → OrbiBottomSheet`), `OrbiWizardFAB`, `OrbiBubble`, `OrbiNudge`, `useOrbiSafeArea`, `useOrbiChat`, `useOrbiStore`, `OrbiIcon`, `_document.tsx` (el `interactive-widget` es follow-up aparte).

---

## Task 1: `useOrbiViewport` — plomería de teclado

**Files:**
- Create: `apps/web/src/components/orbi/orbiViewport.ts`
- Create: `apps/web/src/components/orbi/orbiViewport.test.ts`
- Create: `apps/web/src/components/orbi/useOrbiViewport.ts`

**Interfaces:**
- Produces:
  ```ts
  // orbiViewport.ts
  export interface ViewportInput {
    layoutHeight: number      // document.documentElement.clientHeight
    visualHeight: number      // visualViewport.height
    visualOffsetTop: number   // visualViewport.offsetTop
  }
  export interface KeyboardMetrics {
    keyboardHeight: number    // px, >= 0
    viewportHeight: number    // px, alto útil (== visualHeight)
    offsetTop: number         // px, >= 0
    keyboardOpen: boolean     // keyboardHeight > 120
  }
  export function computeKeyboardMetrics(input: ViewportInput): KeyboardMetrics

  // useOrbiViewport.ts
  export function useOrbiViewport(active: boolean): KeyboardMetrics
  // Cuando active === true: suscribe visualViewport y publica en <html>:
  //   --orbi-vv-height (px), --orbi-kb (px), --orbi-vv-top (px)
  // Cuando active === false: limpia las vars y no suscribe nada.
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/orbi/orbiViewport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeKeyboardMetrics } from './orbiViewport'

describe('computeKeyboardMetrics', () => {
  it('sin teclado: keyboardHeight 0, keyboardOpen false', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 844, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(0)
    expect(m.keyboardOpen).toBe(false)
    expect(m.viewportHeight).toBe(844)
    expect(m.offsetTop).toBe(0)
  })

  it('teclado abierto: keyboardHeight = layout - visual - offsetTop', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 500, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(344)
    expect(m.keyboardOpen).toBe(true)
  })

  it('iOS desplaza el visual viewport: descuenta offsetTop', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 500, visualOffsetTop: 40 })
    expect(m.keyboardHeight).toBe(304)
    expect(m.offsetTop).toBe(40)
  })

  it('nunca devuelve valores negativos (rebote de scroll)', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 900, visualOffsetTop: -20 })
    expect(m.keyboardHeight).toBe(0)
    expect(m.offsetTop).toBe(0)
  })

  it('teclado chico (< 120px, barra de sugerencias sola) no cuenta como abierto', () => {
    const m = computeKeyboardMetrics({ layoutHeight: 844, visualHeight: 760, visualOffsetTop: 0 })
    expect(m.keyboardHeight).toBe(84)
    expect(m.keyboardOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web run test -- orbiViewport`
Expected: FAIL — `Cannot find module './orbiViewport'`.

- [ ] **Step 3: Write `orbiViewport.ts`**

Create `apps/web/src/components/orbi/orbiViewport.ts`:

```ts
// Cálculo puro del alto del teclado a partir de medidas del viewport.
// Vive aparte del hook para poder testearlo sin DOM (vitest corre en 'node').

export interface ViewportInput {
  layoutHeight: number
  visualHeight: number
  visualOffsetTop: number
}

export interface KeyboardMetrics {
  keyboardHeight: number
  viewportHeight: number
  offsetTop: number
  keyboardOpen: boolean
}

// Debajo de esto es la barra de sugerencias del teclado o ruido de medición,
// no un teclado de verdad — no vale la pena reacomodar el sheet por eso.
const KEYBOARD_MIN = 120

export function computeKeyboardMetrics(input: ViewportInput): KeyboardMetrics {
  const offsetTop = Math.max(0, input.visualOffsetTop)
  const keyboardHeight = Math.max(0, input.layoutHeight - input.visualHeight - offsetTop)
  return {
    keyboardHeight,
    viewportHeight: input.visualHeight,
    offsetTop,
    keyboardOpen: keyboardHeight > KEYBOARD_MIN,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web run test -- orbiViewport`
Expected: PASS (5 tests).

- [ ] **Step 5: Write `useOrbiViewport.ts`**

Create `apps/web/src/components/orbi/useOrbiViewport.ts`:

```ts
import { useEffect, useState } from 'react'
import { computeKeyboardMetrics, type KeyboardMetrics } from './orbiViewport'

const VACIO: KeyboardMetrics = { keyboardHeight: 0, viewportHeight: 0, offsetTop: 0, keyboardOpen: false }

// Suscribe window.visualViewport y publica el alto del teclado como estado y
// como variables CSS en <html>, para que el sheet de Orbi se apoye EXACTO
// sobre el teclado (en iOS el viewport de layout no se achica al aparecer el
// teclado — sin esto el input queda detrás y asoma el wizard por el hueco).
export function useOrbiViewport(active: boolean): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>(VACIO)

  useEffect(() => {
    const root = document.documentElement

    const limpiar = () => {
      root.style.removeProperty('--orbi-vv-height')
      root.style.removeProperty('--orbi-kb')
      root.style.removeProperty('--orbi-vv-top')
    }

    if (!active) {
      limpiar()
      setMetrics(VACIO)
      return
    }

    const vv = window.visualViewport
    let raf = 0

    const medir = () => {
      raf = 0
      const m = computeKeyboardMetrics({
        layoutHeight: root.clientHeight,
        visualHeight: vv ? vv.height : window.innerHeight,
        visualOffsetTop: vv ? vv.offsetTop : 0,
      })
      root.style.setProperty('--orbi-vv-height', `${m.viewportHeight || root.clientHeight}px`)
      root.style.setProperty('--orbi-kb', `${m.keyboardHeight}px`)
      root.style.setProperty('--orbi-vv-top', `${m.offsetTop}px`)
      setMetrics(m)
    }

    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir) }

    medir()
    vv?.addEventListener('resize', agendar)
    vv?.addEventListener('scroll', agendar)
    window.addEventListener('resize', agendar)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', agendar)
      vv?.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
      limpiar()
    }
  }, [active])

  return metrics
}
```

- [ ] **Step 6: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep -E "orbiViewport|useOrbiViewport" || echo "sin errores nuevos"`
Expected: `sin errores nuevos`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/orbi/orbiViewport.ts apps/web/src/components/orbi/orbiViewport.test.ts apps/web/src/components/orbi/useOrbiViewport.ts
git commit -m "feat(orbi): hook useOrbiViewport para anclar el sheet al teclado en móvil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `orbiWizardSteps` — config de chips por paso

**Files:**
- Create: `apps/web/src/components/orbi/orbiWizardSteps.ts`
- Create: `apps/web/src/components/orbi/orbiWizardSteps.test.ts`

**Interfaces:**
- Consumes: `WizardFormState` de `./useOrbiContext` (ya exportado — `{ nombre?, descripcion?, subdominio?, modoVenta?, subrubros?, tipoLocal?, telefonoCargado?, logoCargado?, direccionCargada? }`).
- Produces:
  ```ts
  export type OrbiChipKind = 'field' | 'prompt'
  export interface OrbiStepChip {
    key: string           // 'nombre' | 'descripcion' | ... para field; slug para prompt
    label: string         // texto visible SIN el ícono (✦/✓ los agrega el componente)
    kind: OrbiChipKind
    filled?: boolean      // solo kind 'field'
    send: string          // el mensaje que se manda a Orbi al tocarla
  }
  export const ORBI_STEP_LABELS: Record<string, string>   // stepName -> label humano
  export function deriveStepChips(
    stepName: string,
    form: WizardFormState,
    opts: { conModoVenta?: boolean } = {},
  ): { chips: OrbiStepChip[]; quickChips: string[] }
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/orbi/orbiWizardSteps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveStepChips, ORBI_STEP_LABELS } from './orbiWizardSteps'

describe('ORBI_STEP_LABELS', () => {
  it('tiene un label por cada stepName real del onboarding', () => {
    for (const s of ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta']) {
      expect(ORBI_STEP_LABELS[s]).toBeTruthy()
    }
  })
})

describe('deriveStepChips', () => {
  it('elegir-rubro: chips tipo prompt, sin estado filled', () => {
    const { chips, quickChips } = deriveStepChips('elegir-rubro', {})
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every(c => c.kind === 'prompt')).toBe(true)
    expect(chips.every(c => c.filled === undefined)).toBe(true)
    expect(quickChips.length).toBeGreaterThan(0)
  })

  it('tu-negocio: chips de campo con filled segun el form', () => {
    const { chips } = deriveStepChips('tu-negocio', { nombre: 'Aromas del Valle', descripcion: '', subdominio: '' })
    const byKey = Object.fromEntries(chips.map(c => [c.key, c]))
    expect(byKey.nombre.kind).toBe('field')
    expect(byKey.nombre.filled).toBe(true)
    expect(byKey.descripcion.filled).toBe(false)
    expect(byKey.subdominio.filled).toBe(false)
  })

  it('tu-negocio: incluye "modoVenta" solo si conModoVenta', () => {
    const sin = deriveStepChips('tu-negocio', {}, { conModoVenta: false })
    const con = deriveStepChips('tu-negocio', {}, { conModoVenta: true })
    expect(sin.chips.some(c => c.key === 'modoVenta')).toBe(false)
    expect(con.chips.some(c => c.key === 'modoVenta')).toBe(true)
    expect(con.chips.find(c => c.key === 'modoVenta')!.filled).toBe(false)
  })

  it('tu-negocio: modoVenta filled cuando el form lo tiene', () => {
    const { chips } = deriveStepChips('tu-negocio', { modoVenta: 'ecommerce' }, { conModoVenta: true })
    expect(chips.find(c => c.key === 'modoVenta')!.filled).toBe(true)
  })

  it('ubicacion y subrubros y cuenta: prompts, no fields', () => {
    for (const s of ['ubicacion', 'subrubros', 'cuenta']) {
      const { chips } = deriveStepChips(s, {})
      expect(chips.every(c => c.kind === 'prompt')).toBe(true)
    }
  })

  it('stepName desconocido: listas vacías, no tira', () => {
    const { chips, quickChips } = deriveStepChips('inexistente', {})
    expect(chips).toEqual([])
    expect(quickChips).toEqual([])
  })

  it('cada chip trae un mensaje "send" no vacío', () => {
    for (const s of ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta']) {
      const { chips } = deriveStepChips(s, {}, { conModoVenta: true })
      expect(chips.every(c => c.send.trim().length > 0)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web run test -- orbiWizardSteps`
Expected: FAIL — `Cannot find module './orbiWizardSteps'`.

- [ ] **Step 3: Write `orbiWizardSteps.ts`**

Create `apps/web/src/components/orbi/orbiWizardSteps.ts`:

```ts
import type { WizardFormState } from './useOrbiContext'

export type OrbiChipKind = 'field' | 'prompt'

export interface OrbiStepChip {
  key: string
  label: string
  kind: OrbiChipKind
  filled?: boolean
  send: string
}

// stepName -> nombre humano del paso. Los stepName válidos son EXACTOS: los
// emite ElegirRubro ('elegir-rubro') y STEP_NAMES de SetupUnificado.
export const ORBI_STEP_LABELS: Record<string, string> = {
  'elegir-rubro': 'Tu rubro',
  'subrubros': 'Qué vendés',
  'tu-negocio': 'Tu negocio',
  'ubicacion': 'Ubicación',
  'cuenta': 'Tu cuenta',
}

const prompt = (label: string, send = label): OrbiStepChip => ({
  key: label.toLowerCase().replace(/[^a-z]+/g, '-'),
  label,
  kind: 'prompt',
  send,
})

// Campos de "tu-negocio" que Orbi puede completar, en orden.
const CAMPOS_TU_NEGOCIO: { key: keyof WizardFormState; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'subdominio', label: 'Subdominio' },
]

function campoLleno(form: WizardFormState, key: string): boolean {
  const v = (form as Record<string, unknown>)[key]
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v)
}

export function deriveStepChips(
  stepName: string,
  form: WizardFormState,
  opts: { conModoVenta?: boolean } = {},
): { chips: OrbiStepChip[]; quickChips: string[] } {
  switch (stepName) {
    case 'elegir-rubro':
      return {
        chips: [
          prompt('Vendo productos', 'Vendo productos'),
          prompt('Doy servicios', 'Doy servicios'),
          prompt('Ayudame a elegir', 'Ayudame a elegir mi rubro'),
        ],
        quickChips: ['¿Qué rubro me conviene?'],
      }

    case 'subrubros':
      return {
        chips: [
          prompt('Contame qué vendo', 'Te cuento qué vendo y elegís las opciones'),
          prompt('Vendo varios tipos', 'Vendo varios tipos de productos'),
          prompt('¿Cuáles elijo?', '¿Cuáles opciones me convienen?'),
        ],
        quickChips: ['Elegime las que correspondan'],
      }

    case 'tu-negocio': {
      const chips: OrbiStepChip[] = CAMPOS_TU_NEGOCIO.map(c => ({
        key: c.key,
        label: c.label,
        kind: 'field' as const,
        filled: campoLleno(form, c.key),
        send: `Ayudame con ${c.label.toLowerCase()}`,
      }))
      if (opts.conModoVenta) {
        chips.push({
          key: 'modoVenta',
          label: 'Tipo de tienda',
          kind: 'field',
          filled: campoLleno(form, 'modoVenta'),
          send: 'Ayudame a elegir el tipo de tienda',
        })
      }
      return {
        chips,
        quickChips: ['Sugerime un nombre', 'Sugerime una descripción', '¿Qué es el subdominio?'],
      }
    }

    case 'ubicacion':
      return {
        chips: [
          prompt('Vendo solo online', 'Vendo solo online'),
          prompt('Tengo local', 'Tengo un local físico'),
          prompt('Los dos', 'Tengo local y también vendo online'),
        ],
        quickChips: ['¿Qué pongo acá?'],
      }

    case 'cuenta':
      return {
        chips: [
          prompt('¿Por qué necesito cuenta?', '¿Por qué necesito crear una cuenta?'),
          prompt('¿Es seguro?', '¿Mis datos están seguros?'),
        ],
        quickChips: ['¿Qué contraseña conviene?'],
      }

    default:
      return { chips: [], quickChips: [] }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web run test -- orbiWizardSteps`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep orbiWizardSteps || echo ok`
Expected: `ok`.

```bash
git add apps/web/src/components/orbi/orbiWizardSteps.ts apps/web/src/components/orbi/orbiWizardSteps.test.ts
git commit -m "feat(orbi): config de chips por paso del wizard (deriveStepChips)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Extender `OrbiContext` con los datos del paso

**Files:**
- Modify: `apps/web/src/components/orbi/types.ts`
- Modify: `apps/web/src/components/orbi/useOrbiContext.ts`

**Interfaces:**
- Consumes: `OrbiStepChip` de `./orbiWizardSteps` (Task 2).
- Produces: `OrbiContext` con campos nuevos, disponibles vía `useOrbiContext()`:
  ```ts
  interface OrbiContext {
    // ...lo de antes...
    stepChips?: import('./orbiWizardSteps').OrbiStepChip[]
    quickChips?: string[]
    totalSteps?: number       // total de pasos del onboarding que ve el usuario (incluye Rubro y Pago)
    stepIndex?: number        // 1-based, el paso actual dentro de ese total
    canAdvance?: boolean       // el paso actual está completo/válido
    blockReason?: string | null // qué falta para avanzar (texto corto), si canAdvance === false
  }
  ```

- [ ] **Step 1: Editar `types.ts`**

En `apps/web/src/components/orbi/types.ts`, dentro de `interface OrbiContext`, después de `availableOptions?: ...`, agregar:

```ts
  /** Datos del paso del wizard para la tira de contexto móvil. Los publica
   *  SetupUnificado / ElegirRubro vía setWizardContext. */
  stepChips?: import('./orbiWizardSteps').OrbiStepChip[]
  quickChips?: string[]
  totalSteps?: number
  stepIndex?: number
  canAdvance?: boolean
  blockReason?: string | null
```

- [ ] **Step 2: Editar `useOrbiContext.ts` — `WizardOverrides`**

En `apps/web/src/components/orbi/useOrbiContext.ts`, la interface `WizardOverrides` (arriba de todo) pasa a:

```ts
interface WizardOverrides {
  step?: number
  stepName?: string
  rubro?: string
  availableOptions?: { key: string; label: string; description?: string }[]
  stepChips?: import('./orbiWizardSteps').OrbiStepChip[]
  quickChips?: string[]
  totalSteps?: number
  stepIndex?: number
  canAdvance?: boolean
  blockReason?: string | null
}
```

- [ ] **Step 3: Editar `useOrbiContext.ts` — propagar al `OrbiContext`**

En la función `useOrbiContext()`, el branch de `/onboarding` ya hace `...overrides`, así que los campos nuevos se propagan solos. **Verificar** que el objeto devuelto sea:

```ts
    if (router.pathname.startsWith('/onboarding')) {
      return {
        surface: 'wizard' as const,
        ...overrides,
      }
    }
```

No hace falta cambiarlo si ya está así. Si `overrides` estuviera desestructurado campo por campo, agregar los nuevos.

- [ ] **Step 4: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep -E "types.ts|useOrbiContext" || echo ok`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/orbi/types.ts apps/web/src/components/orbi/useOrbiContext.ts
git commit -m "feat(orbi): OrbiContext lleva los datos del paso del wizard (chips, avance)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `OrbiInput` — 16px, textarea con auto-grow, chips rápidos

**Files:**
- Modify: `apps/web/src/components/orbi/OrbiInput.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface Props {
    onSend: (message: string) => void
    disabled?: boolean
    quickChips?: string[]   // NUEVO: chips arriba del input; tocarlas = onSend(texto)
  }
  ```
  El contenedor raíz del componente pasa a tener `className="orbi-input-area"`.

- [ ] **Step 1: Reescribir `OrbiInput.tsx`**

Reemplazar el contenido de `apps/web/src/components/orbi/OrbiInput.tsx` por:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  quickChips?: string[]
}

const MAX_H = 96 // ~4 líneas

export function OrbiInput({ onSend, disabled, quickChips }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // OrbiPanel/OrbiBottomSheet desmontan este componente al cerrarse, así que
  // este mount ES "el panel se acaba de abrir": enfocamos para poder escribir.
  useEffect(() => { inputRef.current?.focus() }, [])

  const autoGrow = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`
  }, [])

  useEffect(() => { autoGrow() }, [text, autoGrow])

  const handleSend = (value?: string) => {
    const trimmed = (value ?? text).trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    requestAnimationFrame(autoGrow)
    inputRef.current?.focus()
  }

  return (
    <div className="orbi-input-area" style={{
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      padding: '8px 12px',
    }}>
      {quickChips && quickChips.length > 0 && (
        <div style={{
          display: 'flex', gap: 7, overflowX: 'auto', padding: '2px 0 9px',
          scrollbarWidth: 'none',
        }}>
          {quickChips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              disabled={disabled}
              style={{
                flexShrink: 0, font: 'inherit', fontSize: 12, fontWeight: 600,
                padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: '#3B82F6', cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '5px 5px 5px 14px',
        borderRadius: 22,
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="Escribí un mensaje..."
          disabled={disabled}
          aria-label="Mensaje para Orbi"
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            resize: 'none', fontFamily: 'inherit',
            // 16px es OBLIGATORIO: con menos, iOS Safari hace zoom al enfocar.
            fontSize: 16, lineHeight: 1.35, color: 'var(--color-text)',
            maxHeight: MAX_H, padding: '8px 0',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={disabled || !text.trim()}
          aria-label="Enviar"
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: text.trim() && !disabled ? '#3B82F6' : 'var(--color-border)',
            border: 'none', cursor: text.trim() && !disabled ? 'pointer' : 'default',
            display: 'grid', placeItems: 'center', transition: 'background 200ms',
          }}
        >
          <Send size={15} strokeWidth={2} color="white" style={{ marginLeft: 1 }} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep OrbiInput || echo ok`
Expected: `ok` (si aparece un error en `OrbiPanel.tsx`/`OrbiBottomSheet.tsx` por el cambio de `<input>` a `<textarea>`, es esperado: se resuelve en Tasks 6 y 7 — esos ya pasan `quickChips` o nada. El typecheck completo se corre al final).

- [ ] **Step 3: Verificación en navegador**

Levantar el dev server (`npm --prefix apps/web run dev`, o el preview del harness). Abrir `/onboarding/rubro` en emulación móvil (viewport 390×844), abrir Orbi (FAB), enfocar el input:
- El input NO debe hacer zoom (el texto de la página se mantiene del mismo tamaño).
- Escribir varias líneas: el input crece hasta ~4 líneas y después scrollea internamente.
- Enter manda; Shift+Enter hace salto de línea.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/orbi/OrbiInput.tsx
git commit -m "feat(orbi): input a 16px (sin zoom iOS), textarea con auto-grow, chips rapidas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `OrbiMessages` — clase de scroll real + reanclar con teclado

**Files:**
- Modify: `apps/web/src/components/orbi/OrbiMessages.tsx`

**Interfaces:**
- Produces: el contenedor scrolleable de la lista de mensajes tiene `className="orbi-messages-scroll"` (lo consume el guard de drag de `OrbiBottomSheet`, Task 8).

- [ ] **Step 1: Poner la clase real**

En `apps/web/src/components/orbi/OrbiMessages.tsx`, en el `return` final de `OrbiMessages()` (el `<div style={{ flex: 1, overflowY: 'auto', ... }}>`), agregar `className="orbi-messages-scroll"`:

```tsx
  return (
    <div
      className="orbi-messages-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
```

Y también al `<div>` del empty state (el `<div style={{ flex: 1, display: 'flex', ...}}>`), para que el guard funcione igual cuando no hay mensajes:

```tsx
    return (
      <div className="orbi-messages-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
```

- [ ] **Step 2: Reanclar al fondo cuando cambia el teclado**

En `OrbiMessages()`, el `useEffect` que hace `bottomRef.current?.scrollIntoView(...)` hoy depende solo de `[messages]`. Agregar un segundo efecto que observe la CSS var `--orbi-kb` vía un `ResizeObserver` sobre el propio contenedor no sirve — usar en cambio un listener del `visualViewport`:

```tsx
  // Cuando aparece/desaparece el teclado, el alto del contenedor cambia y el
  // último mensaje se va de vista. Lo volvemos a pegar abajo.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const alFondo = () => { bottomRef.current?.scrollIntoView({ block: 'end' }) }
    vv.addEventListener('resize', alFondo)
    return () => vv.removeEventListener('resize', alFondo)
  }, [])
```

- [ ] **Step 3: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep OrbiMessages || echo ok`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/orbi/OrbiMessages.tsx
git commit -m "fix(orbi): clase orbi-messages-scroll real y reanclado al abrir el teclado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `OrbiWizardCtx` — la tira de contexto

**Files:**
- Create: `apps/web/src/components/orbi/OrbiWizardCtx.tsx`

**Interfaces:**
- Consumes: `useOrbiContext()` (Task 3: `stepChips`, `quickChips`, `totalSteps`, `stepIndex`, `stepName`), `useOrbiChat().send`, `ORBI_STEP_LABELS` (Task 2), `OrbiIcon`.
- Produces:
  ```tsx
  export function OrbiWizardCtx({ onClose }: { onClose: () => void }): JSX.Element
  ```
  Renderiza la fila (avatar + "Orbi" + "Paso N de M · label" + botón ✕) y la fila de chips. Al tocar una chip: `send(chip.send, context)`.

- [ ] **Step 1: Crear el componente**

Create `apps/web/src/components/orbi/OrbiWizardCtx.tsx`:

```tsx
import { X } from 'lucide-react'
import { OrbiIcon } from './OrbiIcon'
import { useOrbiContext } from './useOrbiContext'
import { useOrbiChat } from './useOrbiChat'
import { ORBI_STEP_LABELS } from './orbiWizardSteps'

// La tira de contexto del sheet full-screen de Orbi en el wizard: reemplaza
// "ver el wizard por detrás" — decís en qué paso estás y qué campos puede
// tocar Orbi, sin el formulario entero.
export function OrbiWizardCtx({ onClose }: { onClose: () => void }) {
  const context = useOrbiContext()
  const { send } = useOrbiChat()

  const label = context.stepName ? (ORBI_STEP_LABELS[context.stepName] ?? '') : ''
  const nums = context.stepIndex && context.totalSteps
    ? `Paso ${context.stepIndex} de ${context.totalSteps}`
    : ''
  const sub = [nums, label].filter(Boolean).join(' · ')

  const chips = context.stepChips ?? []

  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 9px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <OrbiIcon size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>Orbi</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar Orbi"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
            color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 7, padding: '0 16px 11px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chips.map(chip => {
            const done = chip.kind === 'field' && chip.filled === true
            const miss = chip.kind === 'field' && chip.filled === false
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => send(chip.send, context)}
                style={{
                  flexShrink: 0, font: 'inherit', fontSize: 11.5, fontWeight: 600,
                  padding: '6px 11px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${miss ? 'rgba(139,92,246,.4)' : done ? 'rgba(22,163,74,.35)' : 'var(--color-border)'}`,
                  background: miss ? 'rgba(139,92,246,.07)' : done ? 'rgba(22,163,74,.06)' : 'var(--color-surface)',
                  color: miss ? '#8B5CF6' : done ? '#16A34A' : 'var(--color-body)',
                }}
              >
                {miss ? '✦ ' : done ? '✓ ' : ''}{chip.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep OrbiWizardCtx || echo ok`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/orbi/OrbiWizardCtx.tsx
git commit -m "feat(orbi): OrbiWizardCtx, la tira de contexto del sheet movil

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `OrbiBottomSheet` — full-screen, anclado al teclado

**Files:**
- Modify: `apps/web/src/components/orbi/OrbiBottomSheet.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `useOrbiViewport` (Task 1), `OrbiWizardCtx` (Task 6), `useOrbiContext` (Task 3: `canAdvance`, `blockReason`, `quickChips`), `useOrbiChat`, `OrbiMessages`, `OrbiInput` (Task 4: prop `quickChips`).
- Produces: `export function OrbiBottomSheet({ onClose }: { onClose: () => void })` — sin cambios de firma. Despacha `window.dispatchEvent(new CustomEvent('orbi:advance-step'))` al tocar "Continuar".

- [ ] **Step 1: Reescribir el componente**

Reemplazar el contenido de `apps/web/src/components/orbi/OrbiBottomSheet.tsx` por:

```tsx
import { useRef, useCallback, useEffect } from 'react'
import { useOrbiChat } from './useOrbiChat'
import { useOrbiContext } from './useOrbiContext'
import { useOrbiViewport } from './useOrbiViewport'
import { OrbiWizardCtx } from './OrbiWizardCtx'
import { OrbiMessages } from './OrbiMessages'
import { OrbiInput } from './OrbiInput'
import { track } from '@/lib/analytics/wizardTracker'

const DRAG_CLOSE = 90

export function OrbiBottomSheet({ onClose }: { onClose: () => void }) {
  const { send, isStreaming } = useOrbiChat()
  const context = useOrbiContext()
  useOrbiViewport(true) // publica --orbi-vv-height / --orbi-kb / --orbi-vv-top

  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragDelta = useRef(0)
  const dragging = useRef(false)

  useEffect(() => {
    if (context.surface === 'wizard') {
      track('orbi_open', { step: context.step, stepName: context.stepName, rubro: context.rubro })
    }
  }, [context])

  // Escape cierra.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Body scroll lock: el wizard de atrás no debe scrollear bajo el sheet.
  useEffect(() => {
    const y = window.scrollY
    const body = document.body
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, y)
    }
  }, [])

  // Drag para cerrar: SOLO desde la tira de contexto (no desde el chat ni el input).
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('.orbi-messages-scroll') || t.closest('.orbi-input-area')) return
    dragging.current = true
    dragStartY.current = e.touches[0].clientY
    dragDelta.current = 0
    if (sheetRef.current) sheetRef.current.style.willChange = 'transform'
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    dragDelta.current = Math.max(0, e.touches[0].clientY - dragStartY.current)
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    const el = sheetRef.current
    if (el) { el.style.willChange = ''; el.style.transition = ''; el.style.transform = '' }
    if (dragDelta.current > DRAG_CLOSE) onClose()
    dragDelta.current = 0
  }, [onClose])

  const avanzar = () => {
    window.dispatchEvent(new CustomEvent('orbi:advance-step'))
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.28)', animation: 'orbi-fade-in 200ms ease-out' }}
      />

      <div
        ref={sheetRef}
        className="orbi-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Orbi asistente"
        style={{
          position: 'fixed',
          left: 0, right: 0, top: 0,
          height: 'var(--orbi-vv-height, 100dvh)',
          transform: 'translateY(var(--orbi-vv-top, 0px))',
          zIndex: 200,
          background: 'var(--color-bg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'orbi-slide-up 280ms cubic-bezier(.32,.72,0,1)',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* pill de arrastre */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>

        <OrbiWizardCtx onClose={onClose} />

        <OrbiMessages />

        {context.surface === 'wizard' && context.canAdvance === true && (
          <div aria-live="polite" style={{
            flexShrink: 0, margin: '0 12px 8px', padding: '11px 13px',
            border: '1.5px solid rgba(37,99,235,.3)', background: 'rgba(37,99,235,.05)',
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--color-body)' }}>
              <strong style={{ color: 'var(--color-text)' }}>Este paso está completo.</strong>
            </span>
            <button
              onClick={avanzar}
              style={{
                font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 9,
                border: 'none', background: '#2563EB', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {context.surface === 'wizard' && context.canAdvance === false && context.blockReason && (
          <div aria-live="polite" style={{
            flexShrink: 0, margin: '0 12px 8px', padding: '9px 11px',
            fontSize: 11.5, color: '#B45309', background: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 10,
          }}>
            Te falta: {context.blockReason}
          </div>
        )}

        <OrbiInput
          onSend={(m) => send(m, context)}
          disabled={isStreaming}
          quickChips={context.quickChips}
        />
      </div>

      <style>{`
        @keyframes orbi-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes orbi-slide-up { from { transform: translateY(100%) } to { transform: translateY(var(--orbi-vv-top, 0px)) } }
        @media (prefers-reduced-motion: reduce) {
          .orbi-sheet { animation: none !important; }
        }
      `}</style>
    </>
  )
}
```

> Nota: el `padding-bottom` con `env(safe-area-inset-bottom)` que tenía el input
> se saca — con el sheet anclado a `--orbi-vv-height` el borde inferior ya cae
> sobre el teclado, y sin teclado cae sobre el borde real de la pantalla (el
> `dvh` ya contempla la safe area en navegadores modernos). Si en verificación
> se ve pegado al borde en iPhone sin teclado, agregar
> `paddingBottom: 'env(safe-area-inset-bottom, 0px)'` al `.orbi-input-area`.

- [ ] **Step 2: Typecheck**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep OrbiBottomSheet || echo ok`
Expected: `ok`.

- [ ] **Step 3: Verificación en navegador (parcial — sin datos de paso todavía)**

Dev server. `/onboarding/rubro` en móvil (390×844). Abrir Orbi:
- El sheet ocupa toda la pantalla, entra deslizando desde abajo.
- La tira dice "Orbi" (los números de paso todavía no aparecen — llegan en Task 8).
- Enfocar el input y simular teclado (DevTools → toggle device toolbar → o el harness): el input queda pegado arriba del teclado, sin franja del wizard visible.
- Arrastrar hacia abajo desde la tira → cierra. Arrastrar desde la zona de mensajes → NO cierra (scrollea).
- Cerrar → el wizard de atrás quedó en la misma posición de scroll.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/orbi/OrbiBottomSheet.tsx
git commit -m "feat(orbi): OrbiBottomSheet full-screen anclado al teclado, con tira de contexto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `SetupUnificado` — publicar datos del paso + escuchar avance

**Files:**
- Modify: `apps/web/src/modules/onboarding/SetupUnificado.tsx`

**Interfaces:**
- Consumes: `deriveStepChips` (Task 2), `setWizardContext` (ya importado), el `bloqueo`/`puedeAvanzar`/`avanzar` que ya existen en el componente.
- Produces: llama `setWizardContext({... , stepChips, quickChips, totalSteps, stepIndex, canAdvance, blockReason })`. Escucha `window` para `'orbi:advance-step'`.

Contexto del archivo (ya leído):
- `STEP_NAMES = ['subrubros', 'tu-negocio', 'ubicacion', 'cuenta']`, `paso` es 0-based dentro de este componente.
- La barra que ve el usuario numera desde Rubro: `<BarraPasos pasos={pasosOnboarding(primerPasoLabel)} actual={paso + 1} />`. O sea `stepIndex = paso + 2` (Rubro = 1, subrubros = 2, ...), y `totalSteps = pasosOnboarding(primerPasoLabel).length`.
- `bloqueo: { campo, texto } | null` y `puedeAvanzar` ya calculados (líneas ~1055-1083).
- `conModoVenta` es una prop/variable del componente (aparece en `stepOptions['tu-negocio']`).
- Ya hay un `useEffect` con `window.addEventListener('orbi:select-option', ...)` (línea ~953) — copiar ese patrón.
- El `useEffect` de `setWizardContext` (línea ~920) hoy tiene deps `[paso, wizard.rubro, firstStepOptions]`.

- [ ] **Step 1: Importar `deriveStepChips`**

En los imports de Orbi (junto a `setWizardContext`):

```ts
import { deriveStepChips } from '@/components/orbi/orbiWizardSteps'
```

- [ ] **Step 2: Ampliar el `useEffect` de `setWizardContext`**

Reemplazar el `useEffect` de `setWizardContext` (el de deps `[paso, wizard.rubro, firstStepOptions]`) por:

```tsx
  const pasosBarra = pasosOnboarding(primerPasoLabel)
  const stepIndexUsuario = paso + 2 // Rubro es el 1 en la barra; este componente arranca en el 2

  // El estado vacío/lleno de cada campo que Orbi puede tocar. Se compara contra
  // el render anterior para NO re-notificar en cada tecla (ver useOrbiContext).
  const camposLlenos = [
    negocio.nombre.trim().length > 0,
    negocio.descripcion.trim().length > 0,
    negocio.subdominio.trim().length > 0,
    Boolean(negocio.modoVenta),
    seleccion.length > 0,
    negocio.tipoLocal.length > 0,
  ].join(',')

  useEffect(() => {
    const stepName = STEP_NAMES[paso]
    const { chips, quickChips } = deriveStepChips(
      stepName,
      {
        nombre: negocio.nombre,
        descripcion: negocio.descripcion,
        subdominio: negocio.subdominio,
        modoVenta: negocio.modoVenta,
        subrubros: seleccion,
        tipoLocal: negocio.tipoLocal,
      },
      { conModoVenta },
    )

    setWizardContext({
      step: paso,
      stepName,
      rubro: wizard.rubro,
      availableOptions: stepOptions[stepName],
      stepChips: chips,
      quickChips,
      totalSteps: pasosBarra.length,
      stepIndex: stepIndexUsuario,
      canAdvance: puedeAvanzar,
      blockReason: bloqueo?.texto ?? null,
    })
    trackPaso(paso + 1, stepName, wizard.rubro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, wizard.rubro, firstStepOptions, camposLlenos, puedeAvanzar, bloqueo?.texto])
```

> `bloqueo` y `puedeAvanzar` se calculan ANTES de este `useEffect` en el
> componente (líneas ~1055). Si el orden diera un "usado antes de declarar",
> mover este `useEffect` a después del bloque que calcula `bloqueo`.

- [ ] **Step 3: Escuchar `orbi:advance-step`**

Agregar, cerca del `useEffect` de `'orbi:select-option'`:

```tsx
  useEffect(() => {
    const handler = () => {
      // Mismo criterio que el botón "Continuar" del footer: solo si se puede.
      if (puedeAvanzar) avanzar()
    }
    window.addEventListener('orbi:advance-step', handler)
    return () => window.removeEventListener('orbi:advance-step', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeAvanzar, paso])
```

> `avanzar` es una función del componente (línea ~1105). Si está declarada
> después de este `useEffect`, este handler la toma por closure igual porque
> corre en un evento, no en el render — pero si el linter se queja, mover el
> `useEffect` debajo de `function avanzar()`.

- [ ] **Step 4: Typecheck + lint**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep SetupUnificado || echo ok`
Run: `npm --prefix apps/web run lint 2>&1 | grep SetupUnificado || echo ok`
Expected: `ok` en ambos.

- [ ] **Step 5: Verificación en navegador**

Dev server. Entrar al wizard (elegir un rubro en `/onboarding/rubro`, seguir a Setup). En móvil, en el paso "Tu negocio", abrir Orbi:
- La tira dice `Paso 3 de N · Tu negocio` (N = total real de la barra).
- Chips: `Nombre` `Descripción` `Subdominio` (+ `Tipo de tienda` si aplica), con `✦` violeta si vacío / `✓` verde si lleno.
- Con el paso incompleto: aparece la barra ámbar "Te falta: ...".
- Completar los campos (o pedírselo a Orbi) hasta que `puedeAvanzar` → aparece la card "Este paso está completo · Continuar →".
- Tocar "Continuar" en el chat → el wizard avanza al paso siguiente, la tira pasa a `Paso 4 de N · Ubicación`, las chips cambian.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/onboarding/SetupUnificado.tsx
git commit -m "feat(onboarding): SetupUnificado publica chips y estado de avance a Orbi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `ElegirRubro` — chips del paso 1

**Files:**
- Modify: `apps/web/src/modules/onboarding/ElegirRubro.tsx`

**Interfaces:**
- Consumes: `deriveStepChips` (Task 2), `setWizardContext` (ya importado), `seleccionado` (state que ya existe), `pasosOnboarding` (ya importado).
- Produces: `setWizardContext` con `stepChips`, `quickChips`, `totalSteps`, `stepIndex: 1`, `canAdvance: Boolean(seleccionado)`. **No** escucha `orbi:advance-step` (elegir un rubro ya navega solo — ver el handler de `orbi:select-option` que hace `router.push`).

Contexto (ya leído): el `useEffect` de `setWizardContext` (línea ~76) tiene deps `[rubros]`, `stepName: 'elegir-rubro'`, `step: 0`. La barra usa `<BarraPasos pasos={pasosOnboarding(labelPasoRubro(seleccionado))} actual={0} />` (el rubro es `actual={0}` acá, pero en la barra se muestra como el primero — para Orbi es el `Paso 1`).

- [ ] **Step 1: Importar `deriveStepChips`**

```ts
import { deriveStepChips } from '@/components/orbi/orbiWizardSteps'
```

- [ ] **Step 2: Ampliar el `useEffect` de `setWizardContext`**

Reemplazar ese `useEffect` (el de deps `[rubros]`) por:

```tsx
  useEffect(() => {
    const disponibles = rubros.filter(r => r.disponible)
    const { chips, quickChips } = deriveStepChips('elegir-rubro', {})
    setWizardContext({
      step: 0,
      stepName: 'elegir-rubro',
      availableOptions: disponibles.map(r => ({ key: r.key, label: r.label, description: r.descripcion })),
      stepChips: chips,
      quickChips,
      totalSteps: pasosOnboarding(labelPasoRubro(seleccionado)).length,
      stepIndex: 1,
      canAdvance: Boolean(seleccionado),
      blockReason: seleccionado ? null : 'Elegí tu rubro',
    })
    resetWizardFormState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubros, seleccionado])
```

> `labelPasoRubro` es una función que ya se usa en el `<BarraPasos>` de este
> archivo — si no está en scope en este punto, usar `pasosOnboarding('').length`
> (el largo no cambia con el label).

- [ ] **Step 3: Typecheck + lint**

Run: `npm --prefix apps/web run typecheck 2>&1 | grep ElegirRubro || echo ok`
Run: `npm --prefix apps/web run lint 2>&1 | grep ElegirRubro || echo ok`
Expected: `ok`.

- [ ] **Step 4: Verificación en navegador**

Dev server. `/onboarding/rubro` en móvil. Abrir Orbi:
- Tira: `Paso 1 de N · Tu rubro`.
- Chips: "Vendo productos" / "Doy servicios" / "Ayudame a elegir" (tipo prompt, sin ✦/✓).
- Barra ámbar "Te falta: Elegí tu rubro" mientras no haya rubro elegido.
- Escribir "vendo velas y aromatizadores" → Orbi recomienda un rubro y muestra el botón "Elegir X" (esto ya funciona hoy, verificar que sigue). Tocarlo → navega a Setup.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/onboarding/ElegirRubro.tsx
git commit -m "feat(onboarding): ElegirRubro publica las chips del paso 1 a Orbi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Verificación end-to-end + limpieza + build

**Files:**
- (posible) Modify: `apps/web/src/components/orbi/OrbiBottomSheet.tsx` (ajustes finos de la verificación)

- [ ] **Step 1: Suite de tests + typecheck + lint completos**

```bash
npm --prefix apps/web run test
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
```
Expected: los tests nuevos (`orbiViewport`, `orbiWizardSteps`) pasan; typecheck sin errores nuevos (los 4 de tipos de `vitest` preexistentes siguen, no sumar ninguno); lint limpio en los archivos tocados.

- [ ] **Step 2: Build de producción**

```bash
npm --prefix apps/web run build
```
Expected: build OK. Si falla por `visualViewport`/`window` en SSR, envolver los accesos en `typeof window !== 'undefined'` (el hook ya corre en `useEffect`, así que no debería; revisar `OrbiWizardCtx` y `OrbiMessages`).

- [ ] **Step 3: Verificación manual en el navegador — recorrido completo**

Dev server, emulación iPhone (390×844) con teclado real o simulado. Recorrer:

1. `/onboarding/rubro` → abrir Orbi → tira `Paso 1 de N`, chips prompt. Enfocar input: **sin zoom**. Escribir varias líneas: crece hasta 4. Cerrar con drag-down desde la tira.
2. Elegir un rubro → Setup, paso "Qué vendés" → abrir Orbi → `Paso 2 de N`, chips prompt.
3. Avanzar a "Tu negocio" → abrir Orbi → `Paso 3 de N`, chips de campo con `✦`. Pedir "sugerime un nombre", elegir uno → chip `Nombre` pasa a `✓`, aparece card de campo llenado. Barra ámbar mientras falten campos.
4. Con todo completo → card "Continuar →" en el chat → tocar → el wizard avanza, la tira y las chips cambian solas.
5. Teclado abierto en cualquiera de esos pasos: **no hay franja del wizard entre el input y el teclado**. La lista de mensajes queda anclada abajo.
6. Cerrar Orbi → el wizard quedó en el paso correcto, con los campos llenos y el resalte violeta.
7. `prefers-reduced-motion` activado (DevTools → Rendering → Emulate CSS): el sheet aparece sin animación.

Sacar screenshots de: (a) sheet abierto sin teclado, (b) sheet con teclado — mostrando que no hay hueco, (c) la card "Continuar". Adjuntarlas al PR.

- [ ] **Step 4: Chequeo desktop (no-regresión)**

En viewport ancho (≥ 1024px), entrar al wizard y abrir Orbi: debe seguir siendo el **panel lateral de 360px** de siempre (`OrbiPanel` desktop), sin la tira de contexto. El input ahora es un `<textarea>` a 16px — verificar que se ve bien en el panel también.

- [ ] **Step 5: Commit final + PR**

```bash
git add -A
git commit -m "chore(orbi): ajustes de verificacion del sheet movil del wizard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Abrir PR contra `main` con:
- Título: `feat(orbi): Orbi en el wizard móvil — full-screen + tira de contexto`
- Cuerpo: resumen de los problemas resueltos (hueco del teclado, zoom iOS, drag roto, peek inservible), link a la spec, las 3 screenshots.
- Cerrar con: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

---

## Follow-ups (fuera de este plan)

- `_document.tsx`: `<meta name="viewport" content="... interactive-widget=resizes-content">` — mejora el teclado en Android. PR aparte con revisión visual de landing + panel + storefront (cambia el comportamiento de `dvh` en toda la app).
- Unificar el panel no-wizard móvil (`.orbi-panel-root` a `100vw`) al mismo `OrbiBottomSheet` full-screen, para que también gane la plomería de teclado.
- Migrar `OrbiNudge` → `OrbiBubble` (pendiente del spec de 2026-09-04, no bloquea esto).

---

## Self-Review

**1. Spec coverage:**

| Sección del spec | Task |
|---|---|
| `useOrbiViewport` (visualViewport, CSS vars) | Task 1 |
| Body scroll lock | Task 7 (Step 1, `useEffect` de body lock) |
| Sheet full-screen, sin `peek`, `transform` no `height` | Task 7 |
| Tira de contexto `OrbiWizardCtx` | Task 6 |
| Chips por paso (config + estado ✦/✓) | Task 2 (`deriveStepChips`) + Task 6 (render) |
| Chips rápidos del composer | Task 2 (`quickChips`) + Task 4 (`OrbiInput`) + Task 7 (se pasan) |
| Avance de paso desde Orbi (`orbi:advance-step`) | Task 7 (dispatch) + Task 8 (listener SetupUnificado) |
| Card "Paso completo / Te falta X" | Task 7 |
| `OrbiContext` con `stepChips/totalSteps/stepIndex/canAdvance/blockReason` | Task 3 |
| `OrbiInput` 16px + textarea + clase real + quickChips | Task 4 |
| `OrbiMessages` clase `orbi-messages-scroll` + reanclado | Task 5 |
| Datos del paso desde `SetupUnificado` | Task 8 |
| Datos del paso desde `ElegirRubro` | Task 9 |
| No re-notificar en cada tecla (comparar estado lleno/vacío) | Task 8 (Step 2, `camposLlenos` como dep string) |
| Accesibilidad (dialog, aria-modal, aria-live, targets 44px) | Task 7 (dialog/modal/live), Task 4 y 6 (targets) |
| `prefers-reduced-motion` | Task 7 (`<style>` media query) |
| iOS: restaurar scrollY al cerrar | Task 7 (cleanup del body lock) |
| Verificación en IG in-app browser, iOS, desktop no-regresión | Task 10 |
| `_document.tsx` interactive-widget | Follow-up (explícito en spec como "PR aparte") |
| Panel no-wizard sin cambios | Confirmado en File Structure + Task 10 Step 4 |

Sin gaps.

**2. Placeholder scan:** sin "TBD"/"TODO"/"implementar después". Los textos de las chips son concretos (Task 2). Las notas tipo "si el linter se queja, mover el useEffect" son instrucciones reales de contingencia, no placeholders.

**3. Type consistency:**
- `KeyboardMetrics` / `computeKeyboardMetrics` / `useOrbiViewport(active: boolean)` — Task 1, usados igual en Task 7.
- `OrbiStepChip` (`key/label/kind/filled?/send`) — definido en Task 2, consumido igual en Task 3 (import type), Task 6 (render), Tasks 8-9 (via `deriveStepChips`).
- `deriveStepChips(stepName, form, { conModoVenta })` → `{ chips, quickChips }` — firma idéntica en Tasks 2, 8, 9.
- `ORBI_STEP_LABELS` — Task 2, usado en Task 6.
- `OrbiContext.canAdvance/blockReason/quickChips/stepChips/totalSteps/stepIndex` — Task 3, leídos en Tasks 6 y 7.
- Evento `'orbi:advance-step'` — string idéntico en Task 7 (dispatch) y Task 8 (listener).
- `className="orbi-messages-scroll"` / `className="orbi-input-area"` — Task 5 y Task 4 los ponen, Task 7 los busca con `.closest()`. Coinciden.

Sin inconsistencias.
