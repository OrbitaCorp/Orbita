// Pantalla final del alta: el negocio ya está "en órbita". Muestra el planeta
// de la marca, el link y su QR (siempre QR, nunca código de barras: regla del
// vertical) y las salidas naturales de cada módulo.
//
//   · Turnos → el panel y la página pública, en la forma que se eligió (sitio
//     web completo o página simple). Los dos muestran lo que se acaba de cargar.
//   · Tienda → la tienda y el panel de DEMOSTRACIÓN (demo.orbita.site): en esta
//     vista previa no se crea ninguna tienda de verdad, y se dice.
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarCheck, Check, Clock, Copy, ExternalLink, Gift, Info, PanelsTopLeft, RotateCcw, Smartphone, Sparkles } from 'lucide-react'
import { QR } from '@/modules/turnos/_shared/components/QR'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { beneficiosTxt } from '@/modules/turnos/demo/negocioDemo'
import { Aviso } from './campos'
import { diasTxt, horarioTxt, slugDe, type DatosAlta } from './modelo'

const TIENDA_DEMO = 'https://demo.orbita.site'

function Planeta() {
  return (
    <div className="tuob-planeta" aria-hidden>
      <svg viewBox="0 0 210 210" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="tuobPlaneta" cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#BFDBFE" />
            <stop offset="38%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </radialGradient>
          <radialGradient id="tuobHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tuobAro" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#BFDBFE" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <circle cx="105" cy="105" r="100" fill="url(#tuobHalo)" />
        <circle cx="105" cy="105" r="96" fill="none" stroke="rgba(147,197,253,0.22)" strokeDasharray="2 7" />
        {/* El anillo va en dos mitades: la de atrás antes del planeta y la de
            adelante después, para que lo abrace en vez de quedar pegado encima. */}
        <g transform="rotate(-20 105 105)">
          <path d="M 35 105 A 70 20 0 0 1 175 105" fill="none" stroke="url(#tuobAro)" strokeWidth="3" opacity="0.55" />
        </g>
        <circle cx="105" cy="105" r="46" fill="url(#tuobPlaneta)" />
        <g transform="rotate(-20 105 105)">
          <path d="M 35 105 A 70 20 0 0 0 175 105" fill="none" stroke="url(#tuobAro)" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <g className="tuob-gira" style={{ transformOrigin: '105px 105px', animation: 'tuoGira 14s linear infinite' }}>
          <circle cx="105" cy="9" r="11" fill="#93C5FD" opacity="0.25" />
          <circle cx="105" cy="9" r="5" fill="#EFF6FF" />
        </g>
      </svg>
    </div>
  )
}

export function Listo({ d, rubro, cantServicios, onReiniciar }: { d: DatosAlta; rubro: RubroTurnos | null; cantServicios: number; onReiniciar: () => void }) {
  const [copia, setCopia] = useState<'ok' | 'a-mano' | null>(null)
  const texto = useRef<HTMLElement>(null)
  const link = `${slugDe(d)}.orbita.site`
  const negocio = d.negocio.trim() || 'Tu negocio'
  const copiado = copia === 'ok'
  const turnos = d.modulo === 'turnos' && rubro !== null
  const simple = d.forma === 'simple'
  const beneficios = turnos ? beneficiosTxt(d.cuentas, rubro) : []

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`)
      setCopia('ok')
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): se deja el link
      // seleccionado y se avisa, para que el botón nunca quede sin hacer nada.
      if (texto.current) window.getSelection()?.selectAllChildren(texto.current)
      setCopia('a-mano')
    }
    window.setTimeout(() => setCopia(null), 2600)
  }

  // Lo que quedó armado, en una línea cada cosa.
  const armado = turnos
    ? [
      { Icon: CalendarCheck, txt: `${cantServicios} servicio${cantServicios === 1 ? '' : 's'} para reservar` },
      { Icon: Clock, txt: `${diasTxt(d.dias)} · ${horarioTxt(d)}` },
      { Icon: simple ? Smartphone : PanelsTopLeft, txt: simple ? 'Página simple' : 'Sitio web completo' },
      { Icon: Gift, txt: beneficios.length ? `Cuenta opcional con ${beneficios.length} beneficio${beneficios.length === 1 ? '' : 's'}` : 'Reservas sin registro' },
    ]
    : []

  return (
    <div className="tuob-ancho tuob-ancho--form tuob-listo">
      <Planeta />
      <div className="tuo-eyebrow" style={{ marginTop: 14 }}>Alta terminada</div>
      <h1 className="tuob-h1" tabIndex={-1} data-titulo style={{ marginTop: 12 }}>¡Listo! <em>{negocio}</em> ya está en órbita.</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-body)', margin: '12px 0 0', maxWidth: 520 }}>
        {turnos
          ? `Tu agenda de ${rubro.label.toLowerCase()} quedó armada. Compartí el link o el QR y tus clientes ya pueden reservar, sin registrarse.`
          : 'Tu tienda quedó creada. Compartí el link o el QR y empezá a cargar tus productos desde el panel.'}
      </p>

      {armado.length > 0 && (
        <ul className="tuob-armado" aria-label="Lo que quedó armado">
          {armado.map(a => <li key={a.txt}><a.Icon size={15} strokeWidth={1.9} aria-hidden /> {a.txt}</li>)}
        </ul>
      )}

      <div className="tuob-pase">
        <div className="tuob-qr"><QR texto={`https://${link}`} size={140} titulo={`Código QR del link de ${negocio}`} /></div>
        <div style={{ minWidth: 0 }}>
          <span className="tuo-rotulo">{turnos ? 'Tu link de reservas' : 'El link de tu tienda'}</span>
          <div className="tuob-link">
            <code ref={texto}>{link}</code>
            <button type="button" className="tuo-btn tuo-btn--sm" onClick={copiar} aria-label="Copiar el link" style={{ minWidth: 96 }}>
              {copiado ? <><Check size={14} aria-hidden /> Copiado</> : <><Copy size={14} aria-hidden /> Copiar</>}
            </button>
          </div>
          <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{copiado ? 'Link copiado' : copia === 'a-mano' ? 'No se pudo copiar solo: el link quedó seleccionado' : ''}</span>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: copia === 'a-mano' ? 'var(--color-warning)' : 'var(--color-muted)' }}>
            {copia === 'a-mano'
              ? 'No pudimos copiarlo solo. Te lo dejamos seleccionado: copialo con Ctrl + C o manteniéndolo apretado.'
              : 'Pegalo en tu Instagram o en tu WhatsApp, o imprimí el QR para el mostrador.'}
          </p>
        </div>
      </div>

      {turnos ? (
        <div className="tuob-listo-acciones">
          <Link href={{ pathname: '/turnos-demo/panel', query: { rubro: rubro.key } }} className="tuo-btn tuo-btn--primario tuo-btn--lg">
            Ir a mi panel <ArrowRight size={17} className="tuob-flecha" aria-hidden />
          </Link>
          <Link href={{ pathname: simple ? '/turnos-demo/simple' : '/turnos-demo/negocio', query: { rubro: rubro.key } }} className="tuo-btn tuo-btn--lg">
            {simple ? <Smartphone size={16} aria-hidden /> : <PanelsTopLeft size={16} aria-hidden />} {simple ? 'Ver mi página' : 'Ver mi sitio web'}
          </Link>
          <button type="button" className="tuo-btn tuo-btn--fantasma tuo-btn--lg" onClick={onReiniciar}>
            <RotateCcw size={16} aria-hidden /> Empezar de nuevo
          </button>
        </div>
      ) : (
        <>
          <div className="tuob-listo-acciones">
            <a href={`${TIENDA_DEMO}/admin`} target="_blank" rel="noopener noreferrer" className="tuo-btn tuo-btn--primario tuo-btn--lg" aria-label="Ver el panel de demostración (se abre en otra pestaña)">
              <Sparkles size={16} aria-hidden /> Ver el panel de demostración <ExternalLink size={15} aria-hidden />
            </a>
            <a href={TIENDA_DEMO} target="_blank" rel="noopener noreferrer" className="tuo-btn tuo-btn--lg" aria-label="Ver la tienda de demostración (se abre en otra pestaña)">
              Ver la tienda de demostración <ExternalLink size={15} aria-hidden />
            </a>
            <button type="button" className="tuo-btn tuo-btn--fantasma tuo-btn--lg" onClick={onReiniciar}>
              <RotateCcw size={16} aria-hidden /> Empezar de nuevo
            </button>
          </div>
          <div style={{ width: '100%', maxWidth: 620, marginTop: 18, textAlign: 'left' }}>
            <Aviso Icon={Info}>
              En esta vista previa no se crea tu tienda de verdad: los botones abren la <strong>tienda de demostración</strong> de Órbita, con su panel, para que veas cómo queda una ya cargada.
            </Aviso>
          </div>
        </>
      )}
    </div>
  )
}
