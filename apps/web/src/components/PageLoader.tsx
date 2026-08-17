type Props = { visible: boolean; message?: string }

export function PageLoader({ visible, message }: Props) {
  return (
    <div
      aria-hidden={!visible}
      style={{
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

      {/* Glow radial de fondo — más visible en dark mode */}
      <div style={{
        position:     'absolute',
        inset:        0,
        background:   'radial-gradient(ellipse 520px 520px at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents:'none',
      }} />

      {/* Spinner */}
      <div style={{ position: 'relative', width: 88, height: 88 }}>

        {/* Anillo pulsante 1 */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       '1.5px solid rgba(59,130,246,0.35)',
          animation:    'pulseRing 2s ease-out infinite',
        }} />

        {/* Anillo pulsante 2 — desfasado */}
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: '50%',
          border:       '1.5px solid rgba(59,130,246,0.2)',
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
          <circle cx="44" cy="12" r="9" fill="rgba(147,197,253,0.2)" />

          {/* Satélite */}
          <circle cx="44" cy="12" r="5.5" fill="#93c5fd" />
        </svg>

        {/* Capa estática: hub central */}
        <svg
          viewBox="0 0 88 88"
          fill="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Halo interior del hub */}
          <circle cx="44" cy="44" r="18" fill="rgba(59,130,246,0.1)" />
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

        <span style={{
          fontSize:      20,
          fontWeight:    700,
          letterSpacing: '-0.02em',
          color:         'var(--color-text)',
        }}>
          Órbita
        </span>

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
