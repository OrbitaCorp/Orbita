// Banner angosto debajo del header. `text`/`visible` vienen de Apariencia
// (StorefrontConfig.shippingText/showAnnouncementBar) — los defaults acá
// abajo son solo para páginas que todavía no pasan esos props.
import { useEffect, useState } from 'react'

const DEFAULT_TEXT = 'Envíos gratis en compras mayores a $30.000 · Cambios en 30 días'

// El banner puede tener varios ítems (ej. "Showroom" y "Envíos" por separado).
// Se guardan en el MISMO campo de siempre (shippingText) uno por línea, así no
// hizo falta tocar la API ni la base: un texto de un solo renglón, como los que
// ya cargaron los negocios, sigue siendo un banner de un solo ítem.
export function mensajesAnuncio(text?: string | null): string[] {
  return (text ?? '').split('\n').map(t => t.trim()).filter(Boolean)
}

// Cada cuánto cambia de ítem el banner fijo cuando tiene más de uno.
const ROTACION_MS = 4000

// Cuántas veces se repite el mensaje en el modo cartelera — tiene que
// alcanzar para llenar la pantalla más ancha realista (~2560px) sin que se
// vea un hueco en blanco entre el final de una vuelta y el arranque de la
// siguiente, sea cual sea el largo del texto que cargue el dueño. 6 copias
// de un mensaje corto ("3X1 + ENVÍO GRATIS", la referencia que mandó el
// dueño) ya sobran de largo; para uno más largo, sobran igual porque el
// bucle de abajo solo recorre EXACTAMENTE la mitad del ancho total
// (ver keyframes) — de más nunca se corta, de menos sí se notaría el hueco.
const REPETICIONES = 6

export function AnnouncementBar({ text, visible = true, scroll = false, dark = false }: { text?: string | null; visible?: boolean; scroll?: boolean; dark?: boolean }) {
  const parsed = mensajesAnuncio(text)
  const mensajes = parsed.length > 0 ? parsed : [DEFAULT_TEXT]
  const multiple = mensajes.length > 1

  // Modo fijo con varios ítems: se muestran de a uno, rotando. Todos juntos en
  // una línea no entran en un celular (el banner mide 40px y no envuelve).
  // Con "menos movimiento" activado no rota: queda el primero, fijo.
  const [activo, setActivo] = useState(0)
  useEffect(() => {
    if (scroll || !multiple) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setActivo(a => (a + 1) % mensajes.length), ROTACION_MS)
    return () => window.clearInterval(id)
  }, [scroll, multiple, mensajes.length])

  if (!visible) return null

  // padding solo en el modo cartelera — es el "aire" ENTRE una repetición y
  // la siguiente. En el modo fijo de siempre no debe tocar nada: ese
  // espaciado ya lo da el padding del contenedor de más abajo.
  // Los ✦ decorativos van en su propio <span class="orb-anuncio-deco"> (no
  // sueltos como texto) para poder esconderlos por CSS en un celular angosto
  // — ver el media query de abajo: es lo primero que sobra cuando no entra
  // el mensaje entero, antes de tocar la letra del mensaje en sí.
  const item = (key: number | string, contenido: string, conAire: boolean) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap', padding: conAire ? '0 28px' : 0 }}>
      <span className="orb-anuncio-deco">✦&nbsp;&nbsp;</span>{contenido}<span className="orb-anuncio-deco">&nbsp;&nbsp;✦</span>
    </span>
  )

  return (
    <div className={scroll ? undefined : 'orb-anuncio-fijo'} style={{
      height: 40, display: 'flex', alignItems: 'center',
      // Antes hardcodeado a un azul fijo (#1D4ED8/#3B82F6) — nunca reflejaba
      // el color primario que el dueño configura en Apariencia (bug
      // reportado: el preview del panel, StorePreview.tsx, SÍ lo calculaba
      // bien con `prim`, pero es una implementación aparte — esta era la
      // única pieza de la tienda real que había quedado sin migrar). Mismas
      // variables que ya inyecta _app.tsx para toda la tienda real.
      // Vidriera pide el cartel en negro/tema oscuro (Marquee del mock, ver
      // piezas.tsx) en vez del degradé del color primario del negocio.
      background: dark ? 'var(--color-text)' : 'linear-gradient(90deg, var(--color-primary-h), var(--color-primary), var(--color-primary-h))',
      backgroundSize: dark ? undefined : '200% 100%',
      color: dark ? 'var(--color-bg)' : '#fff', fontSize: 13, fontWeight: dark ? 700 : 500, letterSpacing: dark ? '0.06em' : '0.02em',
      overflow: 'hidden',
      justifyContent: scroll ? 'flex-start' : 'center',
      textAlign: 'center',
      padding: scroll ? 0 : '0 16px',
    }}>
      {/* Modo fijo en un celular angosto — el mensaje (con nowrap arriba,
          necesario para que el modo cartelera no lo corte al revés) no
          entraba en una sola línea a 13px y se veía centrado y RECORTADO en
          seco de los dos lados (bug reportado con captura: arrancaba a
          mitad de palabra — "Envíos" se veía "os...", leía como texto roto
          o duplicado). Se achica la letra y se sacan los ✦ decorativos (lo
          primero que sobra, no el mensaje en sí): con eso el mensaje por
          default ya entra entero en un iPhone SE (320px) para arriba.
          (Se probó además desvanecer el borde con mask-image para el caso
          límite de un mensaje más largo del dueño que igual no entrara —
          pedido explícito de sacarlo: contra el fondo blanco de la página
          se veía como una sombra blanca rara a los costados de la barra,
          peor que el recorte que se supone tenía que disimular.) */}
      {!scroll && (
        <style>{`
          @media (max-width: 480px) {
            .orb-anuncio-fijo { font-size: 11px !important; letter-spacing: 0.01em !important; padding: 0 10px !important; }
            .orb-anuncio-fijo .orb-anuncio-deco { display: none; }
          }
        `}</style>
      )}
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
            .orb-anuncio-cartelera { animation: orbAnuncioCartelera ${22 * mensajes.length}s linear infinite; }
            /* Respeta "menos movimiento" del sistema operativo — se
               congela en vez de animar; el mensaje se sigue leyendo (solo
               deja de correr), no desaparece. */
            @media (prefers-reduced-motion: reduce) {
              .orb-anuncio-cartelera { animation: none; }
            }
          `}</style>
          <div className="orb-anuncio-cartelera" style={{ display: 'flex', width: 'max-content' }}>
            {Array.from({ length: REPETICIONES * 2 }).map((_, tanda) => mensajes.map((m, i) => item(`${tanda}-${i}`, m, true)))}
          </div>
        </>
      ) : multiple ? (
        // key = activo: re-monta el ítem en cada cambio y dispara el fade de entrada.
        <>
          <style>{`
            @keyframes orbAnuncioEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
            .orb-anuncio-rota { animation: orbAnuncioEntra 350ms ease-out; }
            @media (prefers-reduced-motion: reduce) { .orb-anuncio-rota { animation: none; } }
          `}</style>
          <span key={activo} className="orb-anuncio-rota">{item(activo, mensajes[activo], false)}</span>
        </>
      ) : (
        item(0, mensajes[0], false)
      )}
    </div>
  )
}
