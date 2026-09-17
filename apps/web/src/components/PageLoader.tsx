import type { CSSProperties } from 'react'
import type { Tema } from '@/modules/ventas/panel/avanzado/plantillas/tipos'

// `title`: la marca que se muestra debajo del spinner. Por default "Órbita"
// (panel y checkout de la plataforma) — pero en el storefront de un negocio
// (subdominio/dominio propio) el visitante no tiene por qué saber qué es
// "Órbita": pasar el nombre real de la tienda ahí. `null` explícito (no
// omitir el prop) oculta el texto de marca por completo en vez de caer a
// "Órbita" — para el instante, muy raro, en que el nombre de la tienda
// todavía no se resolvió (ver _app.tsx).
//
// `tema`: el de la plantilla de Home activa, resuelto en el server
// (`__temaPlantilla`, ver forceSSR.ts). El loader se dibuja en _app.tsx, o
// sea AFUERA de `StorefrontChrome` — que es quien aplica la paleta de la
// plantilla al resto de la tienda. Sin esto, una tienda con plantilla
// arrancaba con el fondo de Apariencia y recién al hidratar saltaba al de la
// plantilla: un flash de otro color en cada carga. Se aplican solo los
// colores, no la tipografía: la fuente de la plantilla la baja
// `cargarFuentes()` en el chrome, así que durante el loader todavía no está
// y el texto de marca saltaría de fuente a mitad de la transición.
type Props = { visible: boolean; message?: string; title?: string | null; tema?: Tema | null }

export function PageLoader({ visible, message, title = 'Órbita', tema = null }: Props) {
  // El satélite es el punto que gira: tiene que despegarse del fondo, así que
  // va más oscuro que el primario en una paleta clara y más claro en una
  // oscura. `--color-primary-h` (el hover del primario) ya es exactamente ese
  // par —#2563EB en claro, #93C5FD en oscuro, que es el celeste que este
  // archivo tenía clavado— así que se reusa en vez de inventar otro tono. Con
  // plantilla no hay clase `.dark` de la que colgarse: el `oscuro` del tema
  // dice para qué lado mezclar.
  const vars = (tema
    ? {
        '--color-bg':        tema.bg,
        '--color-text':      tema.text,
        '--color-muted':     tema.muted,
        '--color-primary':   tema.primary,
        '--color-primary-h': `color-mix(in srgb, ${tema.primary} ${tema.oscuro ? '70%, white' : '80%, black'})`,
      }
    : {}) as CSSProperties

  return (
    <div
      aria-hidden={!visible}
      style={{
        ...vars,
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            28,
        background:     'var(--color-bg)',
        transition:     'opacity 300ms ease',
        opacity:        visible ? 1 : 0,
        pointerEvents:  visible ? 'auto' : 'none',
      }}
    >

      {/* Glow radial de fondo — más visible en dark mode. Sale del primario
          (antes era un azul clavado, que sobre una plantilla de otro color
          dejaba un halo azulado que no pertenecía a la paleta). */}
      <div style={{
        position:     'absolute',
        inset:        0,
        background:   'radial-gradient(ellipse 520px 520px at 50% 50%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 70%)',
        pointerEvents:'none',
      }} />

      {/* Spinner */}
      <div style={{ position: 'relative', width: 88, height: 88 }}>

        {/* Anillo pulsante 1 */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       '1.5px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
          animation:    'pulseRing 2s ease-out infinite',
        }} />

        {/* Anillo pulsante 2 — desfasado */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       '1.5px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
          animation:    'pulseRing 2s ease-out infinite 0.75s',
        }} />

        {/* Capa giratoria: arco orbital + satélite */}
        <svg
          viewBox="0 0 88 88"
          fill="none"
          className="animate-spin"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Arco — 75% del círculo, arranca en 12 en punto */}
          <circle
            cx="44" cy="44" r="32"
            strokeWidth="3"
            strokeDasharray="151 50"
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{ stroke: 'var(--color-primary)' }}
          />

          {/* Halo suave del satélite */}
          <circle cx="44" cy="12" r="9" style={{ fill: 'color-mix(in srgb, var(--color-primary-h) 22%, transparent)' }} />

          {/* Satélite — ver el comentario de `--color-primary-h` arriba */}
          <circle cx="44" cy="12" r="5.5" style={{ fill: 'var(--color-primary-h)' }} />
        </svg>

        {/* Capa estática: hub central */}
        <svg
          viewBox="0 0 88 88"
          fill="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Halo interior del hub */}
          <circle cx="44" cy="44" r="18" style={{ fill: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }} />
          {/* Hub */}
          <circle cx="44" cy="44" r="10" style={{ fill: 'var(--color-text)' }} />
        </svg>

      </div>

      {/* Texto — entra con fadeUp */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            10,
        animation:      'fadeUp 0.5s ease forwards',
      }}>

        {title && (
          <span style={{
            fontSize:      20,
            fontWeight:    700,
            letterSpacing: '-0.02em',
            color:         'var(--color-text)',
          }}>
            {title}
          </span>
        )}

        {/* Mensaje opcional (ej. "Redirigiendo a Mercado Pago…") — sin esto,
            un salto a un sitio externo (no una navegación de Next.js) se
            veía como una pantalla en blanco sin explicación. */}
        {message && (
          <span style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
            {message}
          </span>
        )}

        {/* Tres puntos pulsantes con stagger */}
        <div style={{ display: 'flex', gap: 5 }}>
          {([0, 0.2, 0.4] as const).map((delay, i) => (
            <span
              key={i}
              style={{
                display:      'block',
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   'var(--color-muted)',
                animation:    `blink 1.4s ease-in-out infinite ${delay}s`,
              }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
