// Sub-secciones "livianas" de Configuración de Turnos: Dominio y Suscripción.
// Mismo look que las de Tienda (Dominios.tsx, Suscripcion.tsx) pero sin la
// lógica real de cada una: acá alcanza con que se entienda qué hay y cómo se ve.
import { useEffect, useRef, useState } from 'react'
import { Globe, Link2, Copy, Check, Server, Crown, CreditCard, Receipt, CalendarDays, CircleCheck } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { Modal } from '../piezasPanel'
import { useBorrador, Encabezado, SecCard, Campo, Dos, Chip, BotonBorde, BarraGuardar, Boton, type PropsTab } from './ui'
import { subdominioDe, vozDe, cap } from './datos'

// ─── Dominio ─────────────────────────────────────────────────────────────────

export function Dominio({ rubro, avisar }: PropsTab) {
  const t = temaDe(rubro)
  const b = useBorrador(() => ({ sub: subdominioDe(t.nombre), propio: '' }))
  const [conectando, setConectando] = useState<string | null>(null)
  // La verificación es simulada: espera un momento y da el dominio por conectado.
  const [estado, setEstado] = useState<'espera' | 'verificando' | 'activo'>('espera')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const conectar = () => { setConectando(b.valor.propio); setEstado('espera') }
  const soltar = () => { if (timer.current) clearTimeout(timer.current); setConectando(null); setEstado('espera') }
  const verificar = () => {
    setEstado('verificando')
    timer.current = setTimeout(() => {
      setEstado('activo')
      avisar('Dominio conectado', 'Demo: no se tocó ningún dominio real.')
    }, 1600)
  }
  const [copiado, setCopiado] = useState('')
  const subOk = /^[a-z0-9-]{3,30}$/.test(b.valor.sub)
  const copiar = (s: string) => { void navigator.clipboard?.writeText(s).catch(() => undefined); setCopiado(s); setTimeout(() => setCopiado(''), 1500) }
  const registros: [string, string, string][] = conectando
    ? [['CNAME', conectando.startsWith('www.') ? 'www' : '@', 'turnos.orbita.site'], ['TXT', '_orbita', `verif-${subdominioDe(t.nombre).slice(0, 8)}-7f3a`]]
    : []

  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado titulo="Dominio" bajada="La dirección de tu sitio de reservas." />
      <div className="rv-pila">
        <SecCard titulo="Dirección de Órbita" Icon={Link2} badge={<Chip tono="ok">Activa</Chip>} bajada="Gratis e incluida en tu plan. Si la cambiás, la vieja deja de funcionar.">
          <Campo label="Tu dirección" value={b.valor.sub} onChange={x => b.set('sub', x.toLowerCase().replace(/[^a-z0-9-]/g, ''))} sufijo=".orbita.site" mono maxLength={30}
            ayuda={subOk ? 'Solo letras, números y guiones.' : <span style={{ color: 'var(--color-error)' }}>Tiene que tener al menos 3 caracteres.</span>} />
        </SecCard>

        <SecCard titulo="Dominio propio" Icon={Globe} bajada="Si ya tenés uno (por ejemplo, en NIC Argentina), apuntalo a tu sitio de reservas.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Campo label="Tu dominio" value={b.valor.propio} onChange={x => b.set('propio', x.toLowerCase().trim())} placeholder={`www.${subdominioDe(t.nombre)}.com.ar`} mono style={{ flex: '1 1 240px', marginBottom: 0 }} />
            <Boton variant="primary" className="tuc-alto-campo" disabled={!/\.[a-z]{2,}$/.test(b.valor.propio)} onClick={conectar}>Conectar</Boton>
          </div>
          {conectando && (
            <div className="tuc-fila-hijos" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <Server size={15} aria-hidden style={{ color: 'var(--color-muted)' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{conectando}</span>
                <span aria-live="polite">{estado === 'activo' ? <Chip tono="ok"><CircleCheck size={12} aria-hidden />Conectado</Chip> : <Chip tono="aviso">{estado === 'verificando' ? 'Verificando…' : 'Esperando DNS'}</Chip>}</span>
              </div>
              <p className="tuc-ayuda" style={{ margin: '0 0 12px' }}>{estado === 'activo'
                ? 'Listo: tu sitio de reservas ya se abre desde tu dominio. Dejá estos registros cargados para que siga funcionando.'
                : 'Cargá estos registros donde compraste el dominio. Puede tardar de minutos a unas horas; te avisamos por mail cuando quede.'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {registros.map(([tipo, nombre, valor]) => (
                  <div key={tipo} className="tuc-renglon" style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '8px 10px' }}>
                    <Chip tono="primario">{tipo}</Chip>
                    <div className="rv-num" style={{ minWidth: 0, fontSize: 12.5 }}>
                      <div style={{ color: 'var(--color-muted)' }}>{nombre}</div>
                      <div style={{ color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{valor}</div>
                    </div>
                    <BotonBorde Icon={copiado === valor ? Check : Copy} label={`Copiar valor ${tipo}`} onClick={() => copiar(valor)} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {estado !== 'activo' && <Boton variant="secondary" size="sm" disabled={estado === 'verificando'} onClick={verificar}>{estado === 'verificando' ? 'Verificando…' : 'Verificar ahora'}</Boton>}
                <Boton variant="ghost" size="sm" onClick={() => { const era = estado === 'activo'; soltar(); if (era) avisar('Dominio desconectado', `Tu sitio sigue en ${b.valor.sub}.orbita.site.`) }}>{estado === 'activo' ? 'Desconectar' : 'Cancelar'}</Boton>
              </div>
            </div>
          )}
        </SecCard>
      </div>
      <BarraGuardar dirty={b.dirty && subOk} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Dirección actualizada', `Demo: ${b.valor.sub}.orbita.site no existe de verdad.`) }} />
    </div>
  )
}

// ─── Suscripción ─────────────────────────────────────────────────────────────

const PLANES = [
  { id: 'mensual', nombre: 'Mensual', precio: 16500, nota: 'Sin compromiso' },
  { id: 'semestral', nombre: 'Semestral', precio: 14667, nota: '$88.000 cada 6 meses' },
  { id: 'anual', nombre: 'Anual', precio: 13000, nota: '$156.000 por año · 2 meses gratis' },
]
const $ = (n: number) => `$${n.toLocaleString('es-AR')}`

const CSS_SUSCRIPCION = `
  .tuc-planes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .tuc-plan-conviene { position: absolute; top: -10px; right: 10px; }
  .tuc-uso { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
  .tuc-uso-cab { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin-bottom: 6px; }
  .tuc-cobro { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--color-border); font-size: 13.5px; }
  .tuc-cobro:first-child { border-top: none; padding-top: 0; }
  @media (max-width: 560px) { .tuc-planes { grid-template-columns: minmax(0, 1fr); } }
`

export function Suscripcion({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const [plan, setPlan] = useState('mensual')
  const actual = PLANES.find(p => p.id === plan) ?? PLANES[0]
  const [tarjeta, setTarjeta] = useState({ marca: 'Visa', final: '4242', vence: '08/28' })
  const [nueva, setNueva] = useState<{ numero: string; vence: string; titular: string } | null>(null)
  const digitos = nueva?.numero.replace(/\D/g, '') ?? ''
  const nuevaOk = !!nueva && digitos.length >= 15 && /^(0[1-9]|1[0-2])\/\d{2}$/.test(nueva.vence) && nueva.titular.trim().length > 2
  const guardarTarjeta = () => {
    if (!nueva || !nuevaOk) return
    const marca = digitos[0] === '4' ? 'Visa' : digitos[0] === '5' ? 'Mastercard' : digitos[0] === '3' ? 'American Express' : 'Tarjeta'
    setTarjeta({ marca, final: digitos.slice(-4), vence: nueva.vence })
    setNueva(null)
    avisar('Tarjeta actualizada', 'Demo: no se guardó ni se cobró nada.')
  }
  const usos: [string, number, number | null][] = [
    [rubro.modo === 'profesional' ? `Agendas de ${voz.recurso}` : 'Salas y espacios', 3, 5],
    ['Mensajes de WhatsApp este mes', 412, 1000],
    [`${cap(voz.turnos)} este mes`, 286, null],
  ]
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS_SUSCRIPCION}</style>
      <Encabezado titulo="Suscripción" bajada="Tu plan de Órbita Turnos, lo que usás y tus pagos." />
      <div className="rv-pila">
        <SecCard titulo="Plan actual" Icon={Crown} badge={<Chip tono="ok">Activo</Chip>}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Plan {actual.nombre}</div>
              <div className="rv-num" style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 700, color: 'var(--color-text)' }}>{$(actual.precio)}<span style={{ fontSize: 14, color: 'var(--color-muted)', fontWeight: 500 }}>/mes</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-body)', marginTop: 6 }}><CalendarDays size={13} aria-hidden /> Se renueva el 02/10/2026</div>
            </div>
            <div className="tuc-renglon" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
              <CreditCard size={18} aria-hidden style={{ color: 'var(--color-muted)' }} />
              <div style={{ fontSize: 12.5 }}>
                <div style={{ color: 'var(--color-text)', fontWeight: 600 }}>{tarjeta.marca} ···· {tarjeta.final}</div>
                <div style={{ color: 'var(--color-muted)' }}>Vence {tarjeta.vence}</div>
              </div>
              <button type="button" className="tuc-link" aria-label="Cambiar la tarjeta" onClick={() => setNueva({ numero: '', vence: '', titular: '' })}>Cambiar</button>
            </div>
          </div>
          <div className="tuc-uso">
            {usos.map(([l, n, max]) => (
              <div key={l}>
                <div className="tuc-uso-cab">
                  <span style={{ color: 'var(--color-body)' }}>{l}</span>
                  <span className="rv-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{n.toLocaleString('es-AR')}{max ? ` / ${max.toLocaleString('es-AR')}` : ' · sin límite'}</span>
                </div>
                <div role="progressbar" aria-label={l} aria-valuenow={n} aria-valuemin={0} aria-valuemax={max ?? n} className="tu-barra">
                  <i style={{ width: `${max ? Math.min(100, n / max * 100) : 100}%`, background: max && n / max > 0.8 ? 'var(--color-warning)' : 'var(--color-primary)', opacity: max ? 1 : 0.35 }} />
                </div>
              </div>
            ))}
          </div>
        </SecCard>

        <SecCard titulo="Cambiar de plan" Icon={Receipt} bajada="Mismas funciones en todos: cambia cada cuánto pagás.">
          <div role="radiogroup" aria-label="Plan" className="tuc-planes">
            {PLANES.map(p => {
              const a = p.id === plan
              return (
                <button key={p.id} type="button" role="radio" aria-checked={a} onClick={() => { setPlan(p.id); if (!a) avisar(`Pasás al plan ${p.nombre}`, 'Demo: no se cobra nada.') }} className="tuc-opcion" style={{ overflow: 'visible' }}>
                  {p.id === 'anual' && <span className="tuc-plan-conviene"><Chip tono="ok">Conviene</Chip></span>}
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: a ? 'var(--chip-primary-fg)' : 'var(--color-text)' }}>{p.nombre}</div>
                  <div className="rv-num" style={{ fontSize: 21, fontWeight: 600, color: 'var(--color-text)', marginTop: 4 }}>{$(p.precio)}<span style={{ fontSize: 12, color: 'var(--color-body)', fontWeight: 500 }}>/mes</span></div>
                  <div style={{ fontSize: 12, color: 'var(--color-body)', marginTop: 4, lineHeight: 1.4 }}>{p.nota}</div>
                </button>
              )
            })}
          </div>
        </SecCard>

        <SecCard titulo="Pagos" Icon={CreditCard} bajada="Tus últimos cobros de Órbita.">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[['02/09/2026', 16500], ['02/08/2026', 16500], ['02/07/2026', 16500]].map(([f, m]) => (
              <div key={String(f)} className="tuc-cobro">
                <span className="rv-num" style={{ flex: 1, color: 'var(--color-body)' }}>{f}</span>
                <Chip tono="ok">Pagado</Chip>
                <span className="rv-num" style={{ color: 'var(--color-text)', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{$(Number(m))}</span>
              </div>
            ))}
          </div>
        </SecCard>
      </div>

      {nueva && (
        <Modal titulo="Cambiar la tarjeta" rotulo="Suscripción" bajada="Es una demo: probá con números inventados, no con tu tarjeta." ancho={440} onCerrar={() => setNueva(null)} onEnviar={guardarTarjeta}
          pie={<><Boton variant="ghost" onClick={() => setNueva(null)}>Cancelar</Boton><Boton type="submit" variant="primary" disabled={!nuevaOk}>Guardar tarjeta</Boton></>}>
          <Campo label="Número de la tarjeta" value={nueva.numero} mono placeholder="4509 9535 6623 3704"
            onChange={x => setNueva({ ...nueva, numero: x.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })} />
          <Dos>
            <Campo label="Vencimiento" value={nueva.vence} mono placeholder="MM/AA"
              onChange={x => { const d = x.replace(/\D/g, '').slice(0, 4); setNueva({ ...nueva, vence: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }) }} />
            <Campo label="Titular" value={nueva.titular} onChange={x => setNueva({ ...nueva, titular: x })} placeholder="Como figura en la tarjeta" />
          </Dos>
        </Modal>
      )}
    </div>
  )
}
