// Pestañas "livianas" de Configuración de Turnos: Dominio, Suscripción y
// Equipo y permisos. Mismo look que las de Tienda (Dominios.tsx,
// Suscripcion.tsx, Equipo.tsx) pero sin la lógica real de cada una: acá
// alcanza con que se entienda qué hay y cómo se ve.
//
// Equipo y permisos no tiene datos propios: muestra las personas y los roles
// del panel (los mismos de la pantalla Equipo), así lo que se ajusta acá vale
// en todos lados.
import { useEffect, useRef, useState } from 'react'
import { Globe, Link2, Copy, Check, Server, Crown, CreditCard, Receipt, ShieldCheck, Users, Eye, CalendarDays, X, CircleCheck } from 'lucide-react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { Sigla } from '@/modules/turnos/_shared/orbita/piezas'
import RolesPermisos from '../Roles'
import { CADA_TXT, pagoTxt, type EquipoConfig } from '../equipoDemo'
import { useBorrador, Encabezado, SecCard, Campo, Dos, Chip, BotonBorde, BarraGuardar, Boton, Dialogo, type PropsTab } from './ui'
import { subdominioDe, vozDe, cap } from './datos'
import { fechaDePartes, fechaNumerica, moverMes, partesDe, useReloj } from '@/modules/turnos/reloj'

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
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu sitio" titulo="Dominio" bajada="La dirección de tu sitio de reservas." />
      <div className="tuc-pila">
        <SecCard titulo="Dirección de Órbita" Icon={Link2} badge={<Chip tono="ok">Activa</Chip>} bajada="Gratis e incluida en tu plan. Si la cambiás, la vieja deja de funcionar.">
          <Campo label="Tu dirección" value={b.valor.sub} onChange={x => b.set('sub', x.toLowerCase().replace(/[^a-z0-9-]/g, ''))} sufijo=".orbita.site" mono maxLength={30}
            ayuda={subOk ? 'Solo letras, números y guiones.' : <span style={{ color: 'var(--color-error)' }}>Tiene que tener al menos 3 caracteres.</span>} />
        </SecCard>

        <SecCard titulo="Dominio propio" Icon={Globe} bajada="Si ya tenés uno (por ejemplo, en NIC Argentina), apuntalo a tu sitio de reservas.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Campo label="Tu dominio" value={b.valor.propio} onChange={x => b.set('propio', x.toLowerCase().trim())} placeholder={`www.${subdominioDe(t.nombre)}.com.ar`} mono style={{ flex: '1 1 240px', marginBottom: 0 }} />
            <Boton variant="primary" disabled={!/\.[a-z]{2,}$/.test(b.valor.propio)} onClick={conectar} style={{ height: 42 }}>Conectar</Boton>
          </div>
          {conectando && (
            <div className="tuc-fila-hijos" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <Server size={15} aria-hidden style={{ color: 'var(--color-muted)' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{conectando}</span>
                <span aria-live="polite">{estado === 'activo' ? <Chip tono="ok"><CircleCheck size={12} aria-hidden />Conectado</Chip> : <Chip tono="aviso">{estado === 'verificando' ? 'Verificando…' : 'Esperando DNS'}</Chip>}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>{estado === 'activo'
                ? 'Listo: tu sitio de reservas ya se abre desde tu dominio. Dejá estos registros cargados para que siga funcionando.'
                : 'Cargá estos registros donde compraste el dominio. Puede tardar de minutos a unas horas; te avisamos por mail cuando quede.'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {registros.map(([tipo, nombre, valor]) => (
                  <div key={tipo} className="tuc-renglon" style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '8px 10px' }}>
                    <Chip tono="primario">{tipo}</Chip>
                    <div style={{ minWidth: 0, fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>
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

export function Suscripcion({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  // El plan se cobra el 2 de cada mes: la próxima renovación y los tres cobros anteriores.
  const { fecha: hoy } = useReloj()
  const partes = partesDe(hoy)
  const esteMes = fechaDePartes(partes.anio, partes.mes, 2)
  const renueva = esteMes > hoy ? esteMes : moverMes(esteMes, 1)
  const cobros = [1, 2, 3].map(n => fechaNumerica(moverMes(renueva, -n)))
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
    [rubro.modo === 'profesional' ? `Agendas de ${voz.recurso}` : rubro.modo === 'cancha' ? 'Canchas' : 'Salas y espacios', 3, 5],
    ['Mensajes de WhatsApp este mes', 412, 1000],
    [`${cap(voz.turnos)} este mes`, 286, null],
  ]
  return (
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Cuenta" titulo="Suscripción" bajada="Tu plan de Órbita Turnos, lo que usás y tus pagos." />
      <div className="tuc-pila">
        <SecCard titulo="Plan actual" Icon={Crown} badge={<Chip tono="ok">Activo</Chip>}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Plan {actual.nombre}</div>
              <div className="tuo-num" style={{ fontSize: 34, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>{$(actual.precio)}<span style={{ fontSize: 14, color: 'var(--color-muted)', fontWeight: 500 }}>/mes</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-body)', marginTop: 6 }}><CalendarDays size={13} aria-hidden /> Se renueva el {fechaNumerica(renueva)}</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            {usos.map(([l, n, max]) => (
              <div key={l}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-body)' }}>{l}</span>
                  <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 600 }}>{n.toLocaleString('es-AR')}{max ? ` / ${max.toLocaleString('es-AR')}` : ' · sin límite'}</span>
                </div>
                <div role="progressbar" aria-label={l} aria-valuenow={n} aria-valuemin={0} aria-valuemax={max ?? n} style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                  <div className="tuc-barra-uso" style={{ width: `${max ? Math.min(100, n / max * 100) : 100}%`, background: max && n / max > 0.8 ? 'var(--color-warning)' : 'var(--tuo-grad)', opacity: max ? 1 : 0.35 }} />
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
                  {p.id === 'anual' && <span style={{ position: 'absolute', top: -10, right: 10 }}><Chip tono="ok">Conviene</Chip></span>}
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: a ? 'var(--color-primary)' : 'var(--color-text)' }}>{p.nombre}</div>
                  <div className="tuo-num" style={{ fontSize: 21, fontWeight: 600, color: 'var(--color-text)', marginTop: 4 }}>{$(p.precio)}<span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>/mes</span></div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.4 }}>{p.nota}</div>
                </button>
              )
            })}
          </div>
        </SecCard>

        <SecCard titulo="Pagos" Icon={CreditCard} bajada="Tus últimos cobros de Órbita.">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cobros.map(f => [f, 16500] as const).map(([f, m], i) => (
              <div key={String(f)} className="tuc-linea" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', margin: '0 -8px', borderTop: i ? '1px solid var(--color-border)' : 'none', fontSize: 13.5 }}>
                <span className="tuo-num" style={{ flex: 1, color: 'var(--color-body)' }}>{f}</span>
                <Chip tono="ok">Pagado</Chip>
                <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{$(Number(m))}</span>
              </div>
            ))}
          </div>
        </SecCard>
      </div>

      {nueva && (
        <Dialogo titulo="Cambiar la tarjeta" onCerrar={() => setNueva(null)}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span className="tuo-h2" style={{ flex: 1 }}>Cambiar la tarjeta</span>
            <button type="button" aria-label="Cerrar" autoFocus onClick={() => setNueva(null)} className="tuc-icono"><X size={17} aria-hidden /></button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>Es una demo: probá con números inventados, no con tu tarjeta.</p>
          <Campo label="Número de la tarjeta" value={nueva.numero} mono placeholder="4509 9535 6623 3704"
            onChange={x => setNueva({ ...nueva, numero: x.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })} />
          <Dos>
            <Campo label="Vencimiento" value={nueva.vence} mono placeholder="MM/AA"
              onChange={x => { const d = x.replace(/\D/g, '').slice(0, 4); setNueva({ ...nueva, vence: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }) }} />
            <Campo label="Titular" value={nueva.titular} onChange={x => setNueva({ ...nueva, titular: x })} placeholder="Como figura en la tarjeta" />
          </Dos>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Boton variant="ghost" onClick={() => setNueva(null)}>Cancelar</Boton>
            <Boton variant="primary" disabled={!nuevaOk} onClick={guardarTarjeta}>Guardar tarjeta</Boton>
          </div>
        </Dialogo>
      )}
    </div>
  )
}

// ─── Equipo y permisos ───────────────────────────────────────────────────────

export function EquipoPermisos({ rubro, equipo }: PropsTab & { equipo?: EquipoConfig }) {
  if (!equipo) return null
  const { roles, personas } = equipo
  const rolDe = (id: string) => roles.find(r => r.id === id)

  return (
    <div className="panel-page">
      <Encabezado rotulo="Cuenta" titulo="Equipo y permisos"
        bajada={`Quién entra al panel y qué puede ver cada uno. Los roles vienen armados para ${rubro.label.toLowerCase()}: ajustalos permiso por permiso o creá los tuyos.`}
        acciones={<Boton variant="primary" icon={<Users size={15} />} onClick={equipo.onIrEquipo}>Gestionar el equipo</Boton>} />
      <div className="tuc-pila">
        <SecCard titulo={`Personas (${personas.length})`} Icon={ShieldCheck} bajada="Cada persona entra con su cuenta y ve el panel que le da su rol. Se suman y se editan desde Equipo.">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {personas.map((p, i) => {
              const rol = rolDe(p.rolId)
              return (
                <div key={p.id} className="tuc-miembro tuc-linea" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', margin: '0 -8px', borderTop: i ? '1px solid var(--color-border)' : 'none', flexWrap: 'wrap' }}>
                  <Sigla nombre={p.nombre} color={p.color} size={38} />
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{p.nombre}</span>
                      {p.pendiente && <Chip tono="aviso">Invitación pendiente</Chip>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email || pagoTxt(p.pago, rubro)}{p.email && p.pago ? ` · ${pagoTxt(p.pago, rubro)} ${CADA_TXT[p.pago.cada]}` : ''}</div>
                  </div>
                  {rol?.fijo ? <Chip tono="primario"><Crown size={11} aria-hidden />{rol.nombre}</Chip> : <Chip>{rol?.nombre ?? 'Sin rol'}</Chip>}
                  {!rol?.fijo && <BotonBorde Icon={Eye} onClick={() => equipo.onVerComo({ rolId: p.rolId, personaId: p.id })} label={`Ver el panel como ${p.nombre}`}>Ver su panel</BotonBorde>}
                </div>
              )
            })}
          </div>
        </SecCard>

        <section aria-label="Roles">
          <div style={{ margin: '6px 0 14px' }}>
            <h2 className="tuo-h2">Roles</h2>
            <p className="tuc-card-bajada">Qué ve y qué puede hacer cada rol. Lo que cambies vale para todos los que lo tengan.</p>
          </div>
          <RolesPermisos rubro={rubro} roles={roles} personas={personas} onGuardar={equipo.onGuardarRol} onBorrar={equipo.onBorrarRol} onVerComo={equipo.onVerComo} />
        </section>
      </div>
    </div>
  )
}

export const CSS_CUENTA = `
  .tuc-planes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .tuc-barra-uso { height: 100%; border-radius: 99px; transition: width 600ms var(--tuo-ease, ease); }
  @media (prefers-reduced-motion: reduce) { .tuc-barra-uso { transition: none; } }
  @media (max-width: 560px) {
    .tuc-planes { grid-template-columns: minmax(0, 1fr) !important; }
  }
`
