// Programa de fidelidad: la tarjeta de sellos de papel, pero digital. Cada
// turno atendido suma un sello solo (nadie tiene que acordarse de sellar) y al
// completar la tarjeta se desbloquea el premio.
import { useState } from 'react'
import { Stamp, Star, Heart, Gift, Users, Trophy, Target, Check, type LucideIcon } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, linkSitio, inputStyle } from './ui'
import { ars, serviciosVendibles } from './datosAvanzado'
import type { PropsFuncion } from './tipos'

type IconoSello = 'rubro' | 'estrella' | 'corazon' | 'sello'

export default function Fidelidad(p: PropsFuncion) {
  const { rubro } = p
  const vendibles = serviciosVendibles(rubro)
  const [sellos, setSellos] = useState(8)
  const [premio, setPremio] = useState<'gratis' | 'descuento'>('gratis')
  const [servicio, setServicio] = useState(vendibles[0].nombre)
  const [pct, setPct] = useState(20)
  const [suma, setSuma] = useState<'todos' | 'desde'>('todos')
  const [minimo, setMinimo] = useState(Math.round(vendibles[0].precio * 0.8 / 1000) * 1000)
  const [icono, setIcono] = useState<IconoSello>('rubro')
  const [vencen, setVencen] = useState(12)
  const [bienvenida, setBienvenida] = useState(true)

  const ICONOS: Record<IconoSello, { label: string; Icon: LucideIcon }> = {
    rubro: { label: rubro.label, Icon: rubro.Icon }, estrella: { label: 'Estrella', Icon: Star }, corazon: { label: 'Corazón', Icon: Heart }, sello: { label: 'Sello', Icon: Stamp },
  }
  const textoPremio = premio === 'gratis' ? `${servicio} gratis` : `${pct}% off en tu próximo turno`

  return (
    <ShellFuncion
      {...p}
      bajada="Una tarjeta de sellos digital: cada turno atendido suma un sello automáticamente, y al completarla se desbloquea el premio que elijas."
      textoOn="Tus clientes ven su tarjeta en “Mis turnos” y reciben un aviso cada vez que suman un sello."
      kpis={<>
        <Dato label="Con tarjeta en curso" valor="64" nota="Datos de ejemplo" Icon={Users} />
        <Dato label="Premios canjeados" valor="9" nota="Este mes · ejemplo" Icon={Trophy} acento="var(--color-success)" />
        <Dato label="A un sello del premio" valor="11" nota="Buen momento para escribirles" Icon={Target} acento="var(--color-warning)" />
      </>}
      preview={<PreviewSellos {...p} sellos={sellos} textoPremio={textoPremio} Icon={ICONOS[icono].Icon} bienvenida={bienvenida} vencen={vencen} />}
    >
      <Seccion titulo="La tarjeta">
        <Campo label="Cantidad de sellos para el premio">
          <Segmentado label="Cantidad de sellos" valor={sellos} onChange={setSellos} opciones={[5, 6, 8, 10].map(n => ({ valor: n, label: String(n) }))} />
        </Campo>
        <Campo label="Ícono del sello">
          <div role="group" aria-label="Ícono del sello" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(ICONOS) as IconoSello[]).map(k => {
              const { Icon, label } = ICONOS[k]
              const sel = icono === k
              return (
                <button key={k} type="button" className="tua-opc" aria-pressed={sel} aria-label={label} title={label} onClick={() => setIcono(k)} style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: `1.5px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sel ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: sel ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  <Icon size={18} />
                </button>
              )
            })}
          </div>
        </Campo>
        <FilaSwitch titulo="Sello de bienvenida" desc="La tarjeta arranca con un sello de regalo, así ya se siente empezada." on={bienvenida} onChange={setBienvenida} />
      </Seccion>

      <Seccion titulo="El premio">
        <Campo label="Qué se gana">
          <Segmentado label="Tipo de premio" valor={premio} onChange={setPremio} opciones={[{ valor: 'gratis', label: 'Un turno gratis' }, { valor: 'descuento', label: 'Un descuento' }]} />
        </Campo>
        {premio === 'gratis' ? (
          <Campo label="Servicio de regalo" htmlFor="tua-fid-serv">
            <select id="tua-fid-serv" className="tuc-field" value={servicio} onChange={e => setServicio(e.target.value)} style={inputStyle}>
              {vendibles.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre} · {ars(s.precio)}</option>)}
            </select>
          </Campo>
        ) : (
          <Campo label="Descuento">
            <Segmentado label="Porcentaje de descuento" valor={pct} onChange={setPct} opciones={[10, 15, 20, 30, 50].map(n => ({ valor: n, label: `${n}%` }))} />
          </Campo>
        )}
      </Seccion>

      <Seccion titulo="Reglas">
        <Campo label="Qué turnos suman sello">
          <Segmentado label="Qué turnos suman" valor={suma} onChange={setSuma} opciones={[{ valor: 'todos', label: 'Todos' }, { valor: 'desde', label: 'Desde un monto' }]} />
        </Campo>
        {suma === 'desde' && (
          <Campo label="Monto mínimo del turno" htmlFor="tua-fid-min">
            <input id="tua-fid-min" className="tuc-field" type="number" inputMode="numeric" min={0} step={1000} value={minimo} onChange={e => setMinimo(Number(e.target.value))} style={{ ...inputStyle, maxWidth: 220 }} />
          </Campo>
        )}
        <Campo label="Los sellos vencen" ayuda="Los turnos con ausencia o cancelados no suman nunca." style={{ marginBottom: 0 }}>
          <Segmentado label="Vencimiento de sellos" valor={vencen} onChange={setVencen} opciones={[{ valor: 6, label: 'A los 6 meses' }, { valor: 12, label: 'Al año' }, { valor: 0, label: 'No vencen' }]} />
        </Campo>
      </Seccion>
    </ShellFuncion>
  )
}

function PreviewSellos({ rubro, sellos, textoPremio, Icon, bienvenida, vencen }: PropsFuncion & { sellos: number; textoPremio: string; Icon: LucideIcon; bienvenida: boolean; vencen: number }) {
  // Cliente de ejemplo a dos sellos del premio.
  const tiene = Math.max(bienvenida ? 1 : 0, sellos - 2)
  const faltan = sellos - tiene
  const cols = sellos <= 6 ? sellos === 6 ? 3 : sellos : 5
  return (
    <VistaCliente rubro={rubro}>
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 'var(--tu-r)', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 700 }}>
        <Check size={14} /> ¡Sumaste un sello por tu turno de hoy!
      </div>
      <div style={{ borderRadius: 'var(--tu-r2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Tu tarjeta</div>
        <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, lineHeight: 1.15 }}>
          {faltan === 1 ? 'Te falta 1 sello' : `Te faltan ${faltan} sellos`}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>para {textoPremio.charAt(0).toLowerCase() + textoPremio.slice(1)}</div>
        <div role="img" aria-label={`${tiene} de ${sellos} sellos`} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginTop: 14 }}>
          {Array.from({ length: sellos }).map((_, i) => {
            const lleno = i < tiene
            const ultimo = i === sellos - 1
            return (
              <span key={i} style={{ aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', border: lleno ? 'none' : `1.5px dashed var(--color-border-strong)`, background: lleno ? 'var(--color-primary)' : ultimo ? 'var(--color-primary-bg)' : 'transparent', color: lleno ? 'var(--color-on-primary)' : 'var(--color-primary)', transform: lleno ? `rotate(${(i * 37) % 24 - 12}deg)` : undefined }}>
                {ultimo && !lleno ? <Gift size={16} /> : lleno ? <Icon size={16} /> : null}
              </span>
            )
          })}
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', marginTop: 14, overflow: 'hidden' }}>
          <div style={{ width: `${(tiene / sellos) * 100}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 8 }}>{vencen ? `Tus sellos duran ${vencen === 12 ? 'un año' : `${vencen} meses`}.` : 'Tus sellos no vencen.'}</div>
      </div>
      <BotonVista href={linkSitio(rubro, 'reserva')}>Reservar mi próximo turno</BotonVista>
    </VistaCliente>
  )
}
