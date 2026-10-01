// Paquetes y bonos: packs de sesiones que el cliente paga por adelantado y se
// van descontando solos con cada turno. La vista previa muestra el pack en
// venta y, abajo, cómo ve el cliente su pack en curso.
import { useState } from 'react'
import { Plus, Trash2, Package, Wallet, Layers, Eye } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono, inputStyle } from './ui'
import { ars, paquetesDe, serviciosVendibles, redondear, USOS_PAQUETE, type Paquete } from './datosAvanzado'
import type { PropsFuncion } from './tipos'
import { pluralCliente } from '../Clientes'

const venceTxt = (d: number) => d === 0 ? 'No vence' : `Vence a los ${d} días`

export default function Paquetes(p: PropsFuncion) {
  const { rubro } = p
  const vendibles = serviciosVendibles(rubro)
  const [paquetes, setPaquetes] = useState<Paquete[]>(() => paquetesDe(rubro))
  const [verId, setVerId] = useState<string>('p1')
  const [siguiente, setSiguiente] = useState(1)

  // Borrador del formulario "Nuevo paquete".
  const [servicio, setServicio] = useState(vendibles[0].nombre)
  const [sesiones, setSesiones] = useState(8)
  const [precio, setPrecio] = useState<number | ''>('')
  const [vence, setVence] = useState(90)
  const [compartir, setCompartir] = useState(false)
  const [avisoUltimas, setAvisoUltimas] = useState(true)
  const [avisoVence, setAvisoVence] = useState(true)
  const [estado, setEstado] = useState('')

  const precioServicio = (nombre: string) => vendibles.find(s => s.nombre === nombre)?.precio ?? vendibles[0].precio
  const sugerido = redondear(precioServicio(servicio) * sesiones * 0.88)
  const borrador: Paquete = { id: 'borrador', servicio, sesiones, precio: precio === '' ? sugerido : precio, vence, vendidos: 0 }
  const enPreview = verId === 'borrador' ? borrador : paquetes.find(x => x.id === verId) ?? paquetes[0] ?? borrador

  const agregar = () => {
    const nuevo = { ...borrador, id: `n${siguiente}` }
    setSiguiente(n => n + 1)
    setPaquetes(l => [...l, nuevo])
    setVerId(nuevo.id)
    setPrecio('')
    setEstado(`Listo: ${nuevo.sesiones} × ${nuevo.servicio} a ${ars(nuevo.precio)} ya está en “Tus paquetes”.`)
  }
  const tocarBorrador = () => setVerId('borrador')

  const cobrado = paquetes.reduce((s, x) => s + x.precio * x.vendidos, 0)

  return (
    <ShellFuncion
      {...p}
      bajada={`Armá packs de sesiones con descuento (por ejemplo, ${vendibles[0].nombre.toLowerCase()} x10). Se paga una vez, y cada turno que reserva se descuenta solo del pack.`}
      textoOn="Los paquetes aparecen en tu sitio junto a los servicios, y al reservar se ofrece usar una sesión del pack."
      kpis={<>
        <Dato label="Packs vendidos" valor={String(paquetes.reduce((s, x) => s + x.vendidos, 0))} nota="Datos de ejemplo" Icon={Package} />
        <Dato label="Cobrado por adelantado" valor={ars(cobrado)} nota="Datos de ejemplo" Icon={Wallet} acento="var(--color-success)" />
        <Dato label="Sesiones por usar" valor="38" nota="En packs vigentes · ejemplo" Icon={Layers} acento="#8B5CF6" />
      </>}
      preview={<PreviewPaquete p={enPreview} precioSuelto={precioServicio(enPreview.servicio)} {...p} />}
    >
      <Seccion titulo="Tus paquetes" desc="Tocá uno para verlo en la vista previa.">
        {paquetes.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '6px 0' }}>Todavía no armaste ningún paquete.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paquetes.map(x => {
            const suelto = precioServicio(x.servicio) * x.sesiones
            const ahorro = suelto > 0 ? Math.round((1 - x.precio / suelto) * 100) : 0
            const sel = verId === x.id
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sel ? 'var(--color-primary-bg)' : 'var(--color-bg)', flexWrap: 'wrap' }}>
                <button type="button" className="tua-opc" aria-pressed={sel} onClick={() => setVerId(x.id)} style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{x.sesiones} × {x.servicio}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{venceTxt(x.vence)} · {x.vendidos} vendidos</div>
                </button>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{ars(x.precio)}</div>
                  {ahorro > 0 && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-success)' }}>{ahorro}% menos que suelto</div>}
                </div>
                <BotonIcono Icon={Trash2} peligro label={`Borrar paquete ${x.sesiones} × ${x.servicio}`} onClick={() => { setPaquetes(l => l.filter(y => y.id !== x.id)); if (sel) setVerId('p1'); setEstado(`Se borró el paquete ${x.sesiones} × ${x.servicio}.`) }} />
              </div>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Nuevo paquete" desc="Mientras lo armás, la vista previa te muestra cómo va a quedar.">
        <div className="tua-2">
          <Campo label="Servicio" htmlFor="tua-paq-serv">
            <select id="tua-paq-serv" className="tuc-field" value={servicio} onChange={e => { setServicio(e.target.value); tocarBorrador() }} style={inputStyle}>
              {vendibles.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre} · {ars(s.precio)}</option>)}
            </select>
          </Campo>
          <Campo label="Precio del pack" htmlFor="tua-paq-precio" ayuda={<>Suelto serían {ars(precioServicio(servicio) * sesiones)}. Sugerido: <button type="button" className="ds-link tua-btn-txt" onClick={() => { setPrecio(sugerido); tocarBorrador() }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}>{ars(sugerido)} (12% menos)</button></>}>
            <input id="tua-paq-precio" className="tuc-field" type="number" inputMode="numeric" min={0} step={1000} placeholder={String(sugerido)} value={precio} onChange={e => { setPrecio(e.target.value === '' ? '' : Number(e.target.value)); tocarBorrador() }} style={inputStyle} />
          </Campo>
        </div>
        <Campo label="Cantidad de sesiones">
          <Segmentado label="Cantidad de sesiones" valor={sesiones} onChange={v => { setSesiones(v); tocarBorrador() }} opciones={[4, 6, 8, 10, 12].map(n => ({ valor: n, label: String(n) }))} />
        </Campo>
        <Campo label="Vencimiento" ayuda="Un vencimiento razonable evita sesiones colgadas de hace un año.">
          <Segmentado label="Vencimiento" valor={vence} onChange={v => { setVence(v); tocarBorrador() }} opciones={[{ valor: 60, label: '60 días' }, { valor: 90, label: '90 días' }, { valor: 120, label: '4 meses' }, { valor: 180, label: '6 meses' }, { valor: 0, label: 'No vence' }]} />
        </Campo>
        <FilaSwitch titulo="Se puede compartir" desc="Por ejemplo, entre dos personas de la misma familia." on={compartir} onChange={v => { setCompartir(v); tocarBorrador() }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" icon={<Plus size={15} />} onClick={agregar}>Agregar paquete</Button>
          {verId !== 'borrador' && <Button variant="ghost" icon={<Eye size={15} />} onClick={tocarBorrador}>Ver borrador</Button>}
        </div>
        <div role="status" className="tua-estado" style={{ marginTop: 8 }}>{estado}</div>
      </Seccion>

      <Seccion titulo={`${pluralCliente(rubro)} con un pack en curso`} desc="Se descuenta una sesión cada vez que asisten. Datos de ejemplo.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {USOS_PAQUETE.map(u => {
            const pk = paquetes.find(x => x.id === u.paquete) ?? paquetesDe(rubro).find(x => x.id === u.paquete)!
            const pct = Math.round((u.usadas / pk.sesiones) * 100)
            return (
              <div key={u.cliente}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{u.cliente} <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>· {pk.servicio}</span></span>
                  <span style={{ color: 'var(--color-muted)' }}><b style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{u.usadas}/{pk.sesiones}</b> · vence {u.vence}</span>
                </div>
                <div role="progressbar" aria-valuenow={u.usadas} aria-valuemin={0} aria-valuemax={pk.sesiones} aria-label={`Sesiones usadas por ${u.cliente}`} style={{ height: 7, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: pct >= 80 ? 'var(--color-warning)' : 'var(--color-primary)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Avisos automáticos">
        <FilaSwitch titulo="Avisar cuando quedan 2 sesiones" desc="Un WhatsApp con el link para renovar el pack." on={avisoUltimas} onChange={setAvisoUltimas} />
        <FilaSwitch titulo="Avisar 7 días antes de que venza" desc="Para que use lo que le queda y no lo pierda." on={avisoVence} onChange={setAvisoVence} />
      </Seccion>
    </ShellFuncion>
  )
}

function PreviewPaquete({ p, precioSuelto, rubro }: { p: Paquete; precioSuelto: number } & PropsFuncion) {
  const suelto = precioSuelto * p.sesiones
  const ahorro = Math.max(0, suelto - p.precio)
  const usadas = Math.min(3, p.sesiones - 1)
  return (
    <VistaCliente rubro={rubro}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Paquetes</div>
      <div style={{ borderRadius: 'var(--tu-r2)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 16 }}>
        <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 22, lineHeight: 1.1, color: 'var(--color-text)', fontWeight: 700 }}>Pack de {p.sesiones} sesiones</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>{p.servicio}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)' }}>{ars(p.precio)}</span>
          {ahorro > 0 && <span style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'line-through' }}>{ars(suelto)}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-body)', marginTop: 2 }}>{ars(p.precio / p.sesiones)} por sesión</div>
        {ahorro > 0 && <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 10px', borderRadius: 999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>Ahorrás {ars(ahorro)}</div>}
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 10 }}>{venceTxt(p.vence)} desde la compra</div>
        <BotonVista style={{ marginTop: 14 }} aviso={`Demo: acá se paga el pack (${ars(p.precio)}) y las ${p.sesiones} sesiones quedan en “Mis turnos”.`}>Comprar pack</BotonVista>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginTop: 4 }}>En “Mis turnos”</div>
      <div style={{ borderRadius: 'var(--tu-r2)', border: '1px solid var(--color-border)', padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>
          <span>Tu pack</span><span>{p.sesiones - usadas} de {p.sesiones} disponibles</span>
        </div>
        <div aria-hidden style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(p.sesiones, 12)}, 1fr)`, gap: 4, marginTop: 10 }}>
          {Array.from({ length: p.sesiones }).map((_, i) => (
            <span key={i} style={{ height: 8, borderRadius: 4, background: i < usadas ? 'var(--color-border)' : 'var(--color-primary)' }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>Al reservar, elegís “Usar una sesión del pack”.</div>
      </div>
    </VistaCliente>
  )
}
