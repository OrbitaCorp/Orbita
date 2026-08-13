type Props = {
  visible: boolean
  // Puede no estar: si el branding real todavía no se resolvió, se muestra un
  // loader NEUTRO (solo el spinner). Antes acá caía el nombre de la tienda de
  // mentira del mock ("Rama Indumentaria" + su inicial "R"), así que mientras
  // cargaba cualquier tienda se veía la marca de otra — peor que no mostrar
  // nada. Ver _app.tsx.
  nombre?: string | null
  color?:  string
  logo?:   string | null
}

export function StorefrontLoader({ visible, nombre, color = '#2563EB', logo }: Props) {
  const initial = nombre?.trim() ? nombre.trim().charAt(0).toUpperCase() : null

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
        gap:            16,
        background:     'var(--color-bg)',
        opacity:        visible ? 1 : 0,
        pointerEvents:  visible ? 'auto' : 'none',
        transition:     'opacity 300ms ease',
      }}
    >
      <style>{`
        @keyframes sfLoaderSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes sfLoaderFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Logo / inicial de la tienda — sin branding resuelto no se dibuja
          ninguno de los dos: mejor un loader neutro que la marca equivocada. */}
      {logo ? (
        <img
          src={logo}
          alt={nombre ?? ''}
          style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
        />
      ) : initial ? (
        <div style={{
          width: 56, height: 56, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${color}, ${color}bb)`,
          color: '#fff', fontSize: 22, fontWeight: 800,
          display: 'grid', placeItems: 'center',
          boxShadow: `0 4px 16px ${color}40`,
          animation: 'sfLoaderFade 400ms ease both',
        }}>
          {initial}
        </div>
      ) : null}

      {/* Nombre de la tienda */}
      {nombre && (
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: 'var(--color-text)', letterSpacing: '-0.01em',
          animation: 'sfLoaderFade 400ms 60ms ease both',
        }}>
          {nombre}
        </span>
      )}

      {/* Spinner simple */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2.5px solid var(--color-border)',
        borderTopColor: color,
        animation: 'sfLoaderSpin 0.75s linear infinite',
      }} />

      {/* Texto */}
      <span style={{
        fontSize: 12, color: 'var(--color-muted)', fontWeight: 500,
        animation: 'sfLoaderFade 400ms 120ms ease both',
      }}>
        Cargando...
      </span>
    </div>
  )
}
