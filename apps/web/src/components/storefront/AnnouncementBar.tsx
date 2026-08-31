// Banner angosto debajo del header. `text`/`visible` vienen de Apariencia
// (StorefrontConfig.shippingText/showAnnouncementBar) — los defaults acá
// abajo son solo para páginas que todavía no pasan esos props.
const DEFAULT_TEXT = 'Envíos gratis en compras mayores a $30.000 · Cambios en 30 días'

// Cuántas veces se repite el mensaje en el modo cartelera — tiene que
// alcanzar para llenar la pantalla más ancha realista (~2560px) sin que se
// vea un hueco en blanco entre el final de una vuelta y el arranque de la
// siguiente, sea cual sea el largo del texto que cargue el dueño. 6 copias
// de un mensaje corto ("3X1 + ENVÍO GRATIS", la referencia que mandó el
// dueño) ya sobran de largo; para uno más largo, sobran igual porque el
// bucle de abajo solo recorre EXACTAMENTE la mitad del ancho total
// (ver keyframes) — de más nunca se corta, de menos sí se notaría el hueco.
const REPETICIONES = 6

export function AnnouncementBar({ text, visible = true, scroll = false }: { text?: string | null; visible?: boolean; scroll?: boolean }) {
  const contenido = text?.trim() || DEFAULT_TEXT
  if (!visible) return null

  // padding solo en el modo cartelera — es el "aire" ENTRE una repetición y
  // la siguiente. En el modo fijo de siempre no debe tocar nada: ese
  // espaciado ya lo da el padding del contenedor de más abajo.
  const item = (key: number, conAire: boolean) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, padding: conAire ? '0 28px' : 0 }}>
      ✦&nbsp;&nbsp;{contenido}&nbsp;&nbsp;✦
    </span>
  )

  return (
    <div style={{
      height: 40, display: 'flex', alignItems: 'center',
      // Antes hardcodeado a un azul fijo (#1D4ED8/#3B82F6) — nunca reflejaba
      // el color primario que el dueño configura en Apariencia (bug
      // reportado: el preview del panel, StorePreview.tsx, SÍ lo calculaba
      // bien con `prim`, pero es una implementación aparte — esta era la
      // única pieza de la tienda real que había quedado sin migrar). Mismas
      // variables que ya inyecta _app.tsx para toda la tienda real.
      background: 'linear-gradient(90deg, var(--color-primary-h), var(--color-primary), var(--color-primary-h))',
      backgroundSize: '200% 100%',
      color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
      overflow: 'hidden',
      justifyContent: scroll ? 'flex-start' : 'center',
      textAlign: 'center',
      padding: scroll ? 0 : '0 16px',
    }}>
      {scroll ? (
        // Modo "cartelera" — pedido explícito del dueño, con una tienda de
        // referencia (mensaje corriendo en loop de derecha a izquierda) que
        // mandó como ejemplo. Técnica: el contenido se duplica UNA vez (dos
        // tandas de REPETICIONES) en una fila que no envuelve, animada de
        // 0% a -50% de SU PROPIO ancho — como la segunda tanda es idéntica a
        // la primera, en -50% se ve exactamente lo mismo que en 0%, así el
        // loop no tiene costura (nunca se nota dónde "empieza de nuevo").
        // Se anima con CSS puro (no RAF/JS): más liviano para algo que corre
        // sin parar mientras la página esté abierta.
        <>
          <style>{`
            @keyframes orbAnuncioCartelera { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            .orb-anuncio-cartelera { animation: orbAnuncioCartelera 22s linear infinite; }
            /* Respeta "menos movimiento" del sistema operativo — se
               congela en vez de animar; el mensaje se sigue leyendo (solo
               deja de correr), no desaparece. */
            @media (prefers-reduced-motion: reduce) {
              .orb-anuncio-cartelera { animation: none; }
            }
          `}</style>
          <div className="orb-anuncio-cartelera" style={{ display: 'flex', width: 'max-content' }}>
            {Array.from({ length: REPETICIONES * 2 }).map((_, i) => item(i, true))}
          </div>
        </>
      ) : (
        item(0, false)
      )}
    </div>
  )
}
