# Estándar de interacción — hover / active / focus

Todo elemento interactivo de la app debe dar feedback al mouse. Como el panel se
estila inline (donde `:hover` de CSS no aplica), el estándar vive en clases
globales definidas en `src/styles/globals.css`, pensadas para convivir con
estilos inline sin pisarlos.

## Las tres clases

| Clase | Para qué | Qué hace |
|---|---|---|
| `.ds-hover` | Botones, íconos clickeables, tabs, pills, items de menú, opciones de dropdown, filas clickeables sin patrón propio | "State layer": velo de `currentColor` (6% claro / 9% oscuro) sobre el fondo del elemento, bajo su contenido. `:active` sube la fuerza. Agrega `cursor: pointer` salvo disabled. |
| `.ds-link` | Links de texto (anchors, "Ver todos →", texto clickeable inline) | Subrayado al hover, leve opacidad al active. |
| `.ds-field` | `input`, `select`, `textarea` (o su wrapper con borde) | Borde `--color-border-strong` al hover; borde primario + anillo de foco al focus. |

Las tres respetan `@media (hover: hover)` (nada queda "pegado" en táctil) y
traen `:focus-visible` con outline primario para teclado.

## Reglas de aplicación

1. **Solo elementos interactivos de verdad**: tiene `onClick`, es `<a>`/`<button>`,
   o tiene `role="button"`. Nunca a contenedores estáticos.
2. **`Button`, `Card` e `Input` del design-system ya lo traen** — no volver a
   aplicar clases sobre ellos. `Card` da hover automático cuando tiene `onClick`
   (prop `hoverable` para forzarlo/apagarlo).
3. **Elemento con hover manual existente** (`onMouseEnter` + estado):
   - Si el hover manual solo tinta fondo/opacidad → reemplazarlo por `.ds-hover`
     (menos código, mismo look).
   - Si hace más (transform, sombras, abre menús/tooltips) → dejarlo como está.
   - Nunca duplicar: un elemento no lleva las dos cosas.
4. **Filas de tabla/lista**: si el archivo ya usa el patrón de fondo
   `var(--color-surface-alt)` al hover (como `Table.tsx`), mantener ese patrón.
   Si la fila es clickeable y no tiene nada, usar `.ds-hover`.
5. **Disabled**: la clase ya se desactiva sola con `disabled`,
   `aria-disabled="true"` o `data-disabled`. En elementos no-form deshabilitados,
   poner `aria-disabled` o `data-disabled`.
6. **No aplicar `.ds-hover` a elementos que ya usan `::after`** de otra clase
   CSS (chequear si el elemento tiene alguna clase con pseudo-elementos).
7. El velo hereda `border-radius` del elemento. Si un elemento interactivo no
   tiene radio y el velo quedaría como un rectángulo duro (ej. ícono suelto),
   darle `borderRadius: 6-8` si no rompe el layout.
8. `cursor: pointer` viene con `.ds-hover`; no hace falta agregarlo inline.
9. En JSX el classname se suma al existente:
   `className={existente ? `ds-hover ${existente}` : 'ds-hover'}`.

## Por qué state layer

Un velo de `currentColor` a baja opacidad oscurece elementos claros y aclara
elementos oscuros automáticamente: la misma clase funciona en tema claro y
oscuro, sobre cualquier fondo (inline o no), sin declarar un color de hover por
variante. Es el patrón de Material 3 / Fluent.
