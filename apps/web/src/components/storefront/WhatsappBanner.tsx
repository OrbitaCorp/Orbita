// Banner de WhatsApp del home, antes del pie — cuatro diseños que el dueño
// elige en Apariencia → "Banner de WhatsApp" (WHATSAPP_LAYOUTS en
// apariencia.mock.ts). Antes había un solo diseño fijo (hoy `clasico`, sin
// cambios visuales) — pedido explícito: variedad para tiendas que no
// quieren un bloque grande y a color, o que prefieren algo más sobrio.
//
// Mismo criterio que SeccionVideos.tsx: switch sobre el layout, un solo
// <style> compartido con las clases de los cuatro diseños. El toggle
// (showWhatsapp) y el gate de tener un número real cargado siguen
// decidiéndose en Inicio.tsx, como con cualquier otra sección — acá adentro
// solo se vuelve a chequear `wpp` por si alguna vez se usa suelto.
//
// `bento` es el único que usa un dato REAL en vez de decorativo: el horario
// de atención de Configuración → Contacto. Sin horario cargado, la tarjeta
// de la derecha queda con el ícono en vez de inventar un texto.

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { openWpp } from '@/lib/storefront/utils'
import type { WhatsappLayout } from '@/lib/storefront/api'

type Props = {
  layout: WhatsappLayout | null | undefined
  wpp: string
  /** Mensaje que viaja ya escrito en el chat (Apariencia → textoWhatsapp). */
  message?: string | null
  /** Horario real del negocio (Configuración → Contacto) — solo lo usa `bento`. */
  scheduleText?: string | null
}

const MENSAJE_DEFAULT = 'Hola! Quería hacer una consulta.'

export function WhatsappBanner({ layout, wpp, message, scheduleText }: Props) {
  if (!wpp) return null
  const msg = message?.trim() || MENSAJE_DEFAULT
  const diseno = layout ?? 'clasico'

  return (
    <section className="sf-w" style={{ paddingBottom: 52 }}>
      <style>{ESTILOS}</style>
      {diseno === 'minimal' ? <Minimal wpp={wpp} msg={msg} />
        : diseno === 'franja' ? <Franja wpp={wpp} msg={msg} />
        : diseno === 'bento' ? <Bento wpp={wpp} msg={msg} scheduleText={scheduleText} />
        : <Clasico wpp={wpp} msg={msg} />}
    </section>
  )
}

// ── Ícono compartido ─────────────────────────────────────────────────────

function WppIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
    </svg>
  )
}

type VariantProps = { wpp: string; msg: string }

// ── Diseños ──────────────────────────────────────────────────────────────

// Clásico: tarjeta grande en degradé, badge, título, stats y un chat
// animado — el diseño de siempre, sin cambios.
function Clasico({ wpp, msg }: VariantProps) {
  return (
    <div className="sf-wpp-clasico">
      <div className="sf-wpp-clasico-glow1" />
      <div className="sf-wpp-clasico-glow2" />
      <div className="sf-wpp-clasico-grid">
        <div>
          <div className="sf-wpp-clasico-badge">
            <WppIcon size={13} color="#34D399" />
            <span>Atención por WhatsApp</span>
          </div>
          <h2 className="sf-wpp-clasico-h2">Respondemos en menos<br />de una hora</h2>
          <p className="sf-wpp-clasico-p">Consultá talles, disponibilidad o coordiná un envío. Te atendemos de lunes a sábado, sin bots.</p>
          <div className="sf-wpp-clasico-fila">
            <button className="sf-wpp-clasico-btn" onClick={() => openWpp(wpp, msg)}>
              <WppIcon size={16} />
              Escribirnos ahora
            </button>
            <div className="sf-wpp-clasico-stats">
              {([['< 1hs', 'respuesta'], ['+1.200', 'consultas']] as [string, string][]).map(([n, l]) => (
                <div key={l} className="sf-wpp-clasico-stat">
                  <span className="sf-wpp-clasico-stat-n">{n}</span>
                  <span className="sf-wpp-clasico-stat-l">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sf-wpp-clasico-chat"><WppChat /></div>
      </div>
    </div>
  )
}

// Sobrio: una línea con ícono, texto y botón. Sin color de fondo propio, sin
// animación — para tiendas con un diseño general más callado.
function Minimal({ wpp, msg }: VariantProps) {
  return (
    <div className="sf-wpp-minimal">
      <span className="sf-wpp-minimal-icon"><WppIcon size={20} /></span>
      <div className="sf-wpp-minimal-copy">
        <h2 className="sf-wpp-minimal-h2">¿Tenés una duda?</h2>
        <p className="sf-wpp-minimal-p">Escribinos por WhatsApp, te respondemos en el momento.</p>
      </div>
      <button className="sf-wpp-minimal-btn" onClick={() => openWpp(wpp, msg)}>
        Escribinos <ArrowRight size={15} />
      </button>
    </div>
  )
}

// Franja: barra angosta a todo el ancho, en verde WhatsApp — ocupa poco
// lugar, pensada para ir apretada contra el pie sin competir con el resto
// del home.
function Franja({ wpp, msg }: VariantProps) {
  return (
    <div className="sf-wpp-franja">
      <span className="sf-wpp-franja-icon"><WppIcon size={16} /></span>
      <p className="sf-wpp-franja-txt">Consultanos por WhatsApp — te respondemos en el momento, sin bots.</p>
      <button className="sf-wpp-franja-btn" onClick={() => openWpp(wpp, msg)}>
        Escribir <ArrowRight size={14} />
      </button>
    </div>
  )
}

// Dos tarjetas: la consulta de un lado y, del otro, el horario de atención
// REAL (Configuración → Contacto) — sin horario cargado, un ícono en vez de
// inventar un dato que la tienda no cargó.
function Bento({ wpp, msg, scheduleText }: VariantProps & { scheduleText?: string | null }) {
  const horario = scheduleText?.trim()
  return (
    <div className="sf-wpp-bento">
      <div className="sf-wpp-bento-cta">
        <span className="sf-wpp-bento-icon"><WppIcon size={20} /></span>
        <h3 className="sf-wpp-bento-h3">Hablemos por WhatsApp</h3>
        <p className="sf-wpp-bento-p">Consultá talles, stock o coordiná tu envío.</p>
        <button className="sf-wpp-bento-btn" onClick={() => openWpp(wpp, msg)}>
          Escribinos ahora <ArrowRight size={15} />
        </button>
      </div>
      <div className="sf-wpp-bento-info">
        {horario ? (
          <>
            <span className="sf-wpp-bento-info-eyebrow">Horario de atención</span>
            <p className="sf-wpp-bento-info-txt">{horario}</p>
          </>
        ) : (
          <span className="sf-wpp-bento-info-deco"><WppIcon size={40} color="var(--color-primary)" /></span>
        )}
      </div>
    </div>
  )
}

// ── Chat WhatsApp animado (solo `clasico`) ────────────────────────────────
// phase: 0=vacío → 1=msg cliente → 2=typing tienda → 3=msg tienda → 4=msg cliente2 → reset

const WPP_DOUBLE_CHECK = (
  <svg width="14" height="9" viewBox="0 0 16 10" fill="none">
    <path d="M1 5L4.5 8.5L11 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 5L8.5 8.5L15 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function WppChat() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const DELAYS: Record<number, number> = { 0: 500, 1: 1000, 2: 1800, 3: 1000, 4: 3000 }
    const next = phase < 4 ? phase + 1 : 0
    const t = setTimeout(() => setPhase(next), DELAYS[phase] ?? 1000)
    return () => clearTimeout(t)
  }, [phase])

  const show1 = phase >= 1
  const typing = phase === 2
  const show2 = phase >= 3
  const show3 = phase >= 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <style>{`
        @keyframes wppBubble { from { opacity:0; transform:translateY(8px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes wppDot { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-4px); opacity:1; } }
      `}</style>
      {show1 && (
        <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '85%', animation: 'wppBubble 280ms ease both' }}>
          <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>Hola! ¿Tienen la campera en talle M?</p>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:41</span>
        </div>
      )}
      {typing && (
        <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '10px 16px', animation: 'wppBubble 200ms ease both', display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 0.18, 0.36].map((d, i) => (
            <span key={i} style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: `wppDot 1s ${d}s ease-in-out infinite` }} />
          ))}
        </div>
      )}
      {show2 && (
        <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', maxWidth: '92%', animation: 'wppBubble 280ms ease both' }}>
          <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Sí! Tenemos en M y L. Te coordinamos el envío hoy mismo 🎉</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>09:42</span>
            {WPP_DOUBLE_CHECK}
          </div>
        </div>
      )}
      {show3 && (
        <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '70%', animation: 'wppBubble 280ms ease both' }}>
          <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Perfecto, muchas gracias! 🙌</p>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:43</span>
        </div>
      )}
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────────

const ESTILOS = `
/* Clásico */
.sf-wpp-clasico { position:relative; overflow:hidden; border-radius:20px; background:linear-gradient(135deg,#064E3B 0%,#065F46 50%,#047857 100%); box-shadow:0 20px 60px rgba(6,78,59,0.30); }
.sf-wpp-clasico-glow1 { position:absolute; top:-80px; right:260px; width:320px; height:320px; border-radius:50%; background:rgba(52,211,153,0.10); filter:blur(80px); pointer-events:none; }
.sf-wpp-clasico-glow2 { position:absolute; bottom:-60px; left:-40px; width:240px; height:240px; border-radius:50%; background:rgba(255,255,255,0.04); filter:blur(60px); pointer-events:none; }
.sf-wpp-clasico-grid { position:relative; z-index:1; display:grid; grid-template-columns:1fr 300px; align-items:center; gap:48px; padding:40px 48px; }
.sf-wpp-clasico-badge { display:inline-flex; align-items:center; gap:7px; height:26px; padding:0 12px; border-radius:999px; background:rgba(52,211,153,0.18); border:1px solid rgba(52,211,153,0.35); margin-bottom:16px; }
.sf-wpp-clasico-badge span { font-size:11px; font-weight:700; color:#6EE7B7; letter-spacing:0.05em; text-transform:uppercase; }
.sf-wpp-clasico-h2 { font-size:28px; font-weight:900; color:#fff; letter-spacing:-0.03em; line-height:1.15; margin:0 0 10px; max-width:420px; }
.sf-wpp-clasico-p { font-size:13.5px; color:rgba(255,255,255,0.72); line-height:1.6; margin:0 0 24px; max-width:380px; }
.sf-wpp-clasico-fila { display:flex; align-items:center; gap:28px; flex-wrap:wrap; }
.sf-wpp-clasico-btn { height:46px; padding:0 22px; border-radius:10px; background:#25D366; color:#fff; font-size:14px; font-weight:700; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(37,211,102,0.40); transition:background 150ms, transform 150ms; flex-shrink:0; }
.sf-wpp-clasico-btn:hover { background:#1DAA52; transform:translateY(-1px); }
.sf-wpp-clasico-stats { display:flex; gap:24px; }
.sf-wpp-clasico-stat { display:flex; flex-direction:column; gap:2px; }
.sf-wpp-clasico-stat-n { font-size:15px; font-weight:800; color:#fff; font-family:"Geist Mono",monospace; letter-spacing:-0.02em; }
.sf-wpp-clasico-stat-l { font-size:11px; color:rgba(255,255,255,0.55); font-weight:500; }

/* Sobrio */
.sf-wpp-minimal { display:flex; align-items:center; gap:18px; padding:22px 26px; border-radius:16px; background:var(--color-surface); border:1px solid var(--color-border); }
.sf-wpp-minimal-icon { flex-shrink:0; width:44px; height:44px; border-radius:50%; background:#25D366; display:grid; place-items:center; }
.sf-wpp-minimal-copy { flex:1; min-width:0; }
.sf-wpp-minimal-h2 { font-size:16px; font-weight:700; color:var(--color-text); margin:0 0 3px; letter-spacing:-0.01em; }
.sf-wpp-minimal-p { font-size:13px; color:var(--color-muted); margin:0; line-height:1.5; }
.sf-wpp-minimal-btn { flex-shrink:0; height:44px; padding:0 20px; border-radius:9px; background:#25D366; color:#fff; font-size:13.5px; font-weight:700; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 150ms; }
.sf-wpp-minimal-btn:hover { background:#1DAA52; }

/* Franja */
.sf-wpp-franja { display:flex; align-items:center; gap:14px; padding:14px 24px; border-radius:12px; background:#25D366; }
.sf-wpp-franja-icon { flex-shrink:0; width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.18); display:grid; place-items:center; }
.sf-wpp-franja-txt { flex:1; min-width:0; font-size:13.5px; font-weight:600; color:#fff; margin:0; }
.sf-wpp-franja-btn { flex-shrink:0; height:44px; padding:0 18px; border-radius:8px; background:rgba(255,255,255,0.16); color:#fff; font-size:13px; font-weight:700; border:1px solid rgba(255,255,255,0.30); cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 150ms; }
.sf-wpp-franja-btn:hover { background:rgba(255,255,255,0.28); }

/* Dos tarjetas */
.sf-wpp-bento { display:grid; grid-template-columns:1.4fr 1fr; gap:16px; align-items:stretch; }
.sf-wpp-bento-cta { padding:32px; border-radius:18px; background:linear-gradient(135deg,#075E54 0%,#128C7E 100%); display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
.sf-wpp-bento-icon { width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.16); display:grid; place-items:center; margin-bottom:10px; }
.sf-wpp-bento-h3 { font-size:19px; font-weight:800; color:#fff; margin:0 0 6px; letter-spacing:-0.01em; }
.sf-wpp-bento-p { font-size:13px; color:rgba(255,255,255,0.78); margin:0 0 18px; line-height:1.5; }
.sf-wpp-bento-btn { height:44px; padding:0 20px; border-radius:9px; background:#fff; color:#075E54; font-size:13.5px; font-weight:700; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:transform 150ms; }
.sf-wpp-bento-btn:hover { transform:translateY(-1px); }
.sf-wpp-bento-info { padding:28px; border-radius:18px; background:var(--color-surface); border:1px solid var(--color-border); display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:8px; }
.sf-wpp-bento-info-eyebrow { font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--color-muted); }
.sf-wpp-bento-info-txt { font-size:15px; font-weight:600; color:var(--color-text); margin:0; line-height:1.5; }
.sf-wpp-bento-info-deco { width:100%; display:flex; justify-content:center; opacity:0.5; }

@media (max-width:1024px) {
  .sf-wpp-clasico-grid { grid-template-columns:1fr !important; gap:24px !important; padding:32px 28px !important; }
  .sf-wpp-clasico-chat { display:none !important; }
  .sf-wpp-bento { grid-template-columns:1fr; }
}
@media (max-width:640px) {
  .sf-wpp-clasico-grid { padding:24px 20px !important; }
  .sf-wpp-clasico-h2 { font-size:23px !important; }
  .sf-wpp-clasico-fila { gap:16px !important; }
  .sf-wpp-minimal { flex-wrap:wrap; padding:20px; }
  .sf-wpp-minimal-btn { width:100%; justify-content:center; }
  .sf-wpp-franja { flex-wrap:wrap; padding:16px 18px; }
  .sf-wpp-franja-btn { width:100%; justify-content:center; }
  .sf-wpp-bento-cta, .sf-wpp-bento-info { padding:24px; }
}
`
