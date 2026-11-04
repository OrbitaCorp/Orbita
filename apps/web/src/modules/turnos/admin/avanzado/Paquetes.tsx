// Paquetes y bonos: packs de sesiones que el cliente paga por adelantado y se
// van descontando solos con cada turno. La vista previa muestra el pack en
// venta y, abajo, cómo ve el cliente su pack en curso.
import { useState } from 'react'
import { Plus, Trash2, Package, Wallet, Layers, Eye, BellRing, Users } from 'lucide-react'
import { Barra } from '../piezasPanel'
import { Boton, ShellFuncion, SecCard, CampoLibre, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono } from './ui'
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
        <Dato label="Cobrado por adelantado" valor={ars(cobrado)} nota="Datos de ejemplo" Icon={Wallet} />
        <Dato label="Sesiones por usar" valor="38" nota="En packs vigentes · ejemplo" Icon={Layers} />
      </>}
      preview={<PreviewPaquete p={enPreview} precioSuelto={precioServicio(enPreview.servicio)} {...p} />}
    >
      <SecCard titulo="Tus paquetes" Icon={Package} bajada="Tocá uno para verlo en la vista previa.">
        {paquetes.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Todavía no armaste ningún paquete.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paquetes.map(x => {
            const suelto = precioServicio(x.servicio) * x.sesiones
            const ahorro = suelto > 0 ? Math.round((1 - x.precio / suelto) * 100) : 0
            const sel = verId === x.id
            return (
              <div key={x.id} className="tua-item" data-sel={sel}>
                <button type="button" className="tua-item-txt" aria-pressed={sel} onClick={() => setVerId(x.id)}>
                  <b>{x.sesiones} × {x.servicio}</b>
                  <small>{venceTxt(x.vence)} · {x.vendidos} vendidos</small>
                </button>
                <span className="tua-item-num">
                  <b className="rv-num">{ars(x.precio)}</b>
                  {ahorro > 0 && <small>{ahorro}% menos que suelto</small>}
                </span>
                <BotonIcono Icon={Trash2} peligro label={`Borrar paquete ${x.sesiones} × ${x.servicio}`} onClick={() => { setPaquetes(l => l.filter(y => y.id !== x.id)); if (sel) setVerId('p1'); setEstado(`Se borró el paquete ${x.sesiones} × ${x.servicio}.`) }} />
              </div>
            )
          })}
        </div>
      </SecCard>

      <SecCard titulo="Nuevo paquete" Icon={Plus} bajada="Mientras lo armás, la vista previa te muestra cómo va a quedar.">
        <div className="tua-2">
          <CampoLibre label="Servicio" htmlFor="tua-paq-serv">
            <select id="tua-paq-serv" className="rv-select" value={servicio} onChange={e => { setServicio(e.target.value); tocarBorrador() }}>
              {vendibles.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre} · {ars(s.precio)}</option>)}
            </select>
          </CampoLibre>
          <CampoLibre label="Precio del pack" htmlFor="tua-paq-precio" ayuda={<>Suelto serían {ars(precioServicio(servicio) * sesiones)}. Sugerido: <button type="button" className="tuc-link" onClick={() => { setPrecio(sugerido); tocarBorrador() }}>{ars(sugerido)} (12% menos)</button></>}>
            <span className="rv-con-prefijo"><i>$</i><input id="tua-paq-precio" className="rv-input rv-num" type="number" inputMode="numeric" min={0} step={1000} placeholder={String(sugerido)} value={precio} onChange={e => { setPrecio(e.target.value === '' ? '' : Number(e.target.value)); tocarBorrador() }} /></span>
          </CampoLibre>
        </div>
        <CampoLibre label="Cantidad de sesiones">
          <Segmentado label="Cantidad de sesiones" valor={sesiones} onChange={v => { setSesiones(v); tocarBorrador() }} opciones={[4, 6, 8, 10, 12].map(n => ({ id: n, label: String(n) }))} />
        </CampoLibre>
        <CampoLibre label="Vencimiento" ayuda="Un vencimiento razonable evita sesiones colgadas de hace un año.">
          <Segmentado label="Vencimiento" valor={vence} onChange={v => { setVence(v); tocarBorrador() }} opciones={[{ id: 60, label: '60 días' }, { id: 90, label: '90 días' }, { id: 120, label: '4 meses' }, { id: 180, label: '6 meses' }, { id: 0, label: 'No vence' }]} />
        </CampoLibre>
        <FilaSwitch titulo="Se puede compartir" ayuda="Por ejemplo, entre dos personas de la misma familia." on={compartir} onChange={v => { setCompartir(v); tocarBorrador() }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Boton variant="outline" icon={<Plus size={15} aria-hidden />} onClick={agregar}>Agregar paquete</Boton>
          {verId !== 'borrador' && <Boton variant="ghost" icon={<Eye size={15} aria-hidden />} onClick={tocarBorrador}>Ver borrador</Boton>}
        </div>
        <div role="status" className="tua-estado">{estado}</div>
      </SecCard>

      <SecCard titulo={`${pluralCliente(rubro)} con un pack en curso`} Icon={Users} bajada="Se descuenta una sesión cada vez que asisten. Datos de ejemplo.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {USOS_PAQUETE.map(u => {
            const pk = paquetes.find(x => x.id === u.paquete) ?? paquetesDe(rubro).find(x => x.id === u.paquete)!
            return (
              <div key={u.cliente}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{u.cliente} <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>· {pk.servicio}</span></span>
                  <span style={{ color: 'var(--color-muted)' }}><b className="rv-num" style={{ color: 'var(--color-text)' }}>{u.usadas}/{pk.sesiones}</b> · vence <span className="rv-num">{u.vence}</span></span>
                </div>
                <Barra valor={u.usadas / pk.sesiones} label={`Sesiones usadas por ${u.cliente}: ${u.usadas} de ${pk.sesiones}`} />
              </div>
            )
          })}
        </div>
      </SecCard>

      <SecCard titulo="Avisos automáticos" Icon={BellRing}>
        <FilaSwitch titulo="Avisar cuando quedan 2 sesiones" ayuda="Un WhatsApp con el link para renovar el pack." on={avisoUltimas} onChange={setAvisoUltimas} />
        <FilaSwitch titulo="Avisar 7 días antes de que venza" ayuda="Para que use lo que le queda y no lo pierda." on={avisoVence} onChange={setAvisoVence} />
      </SecCard>
    </ShellFuncion>
  )
}

function PreviewPaquete({ p, precioSuelto, rubro }: { p: Paquete; precioSuelto: number } & PropsFuncion) {
  const suelto = precioSuelto * p.sesiones
  const ahorro = Math.max(0, suelto - p.precio)
  const usadas = Math.min(3, p.sesiones - 1)
  return (
    <VistaCliente rubro={rubro}>
      <div className="tua-eyebrow">Paquetes</div>
      <div className="tua-tarjeta">
        <div className="tua-titulo">Pack de {p.sesiones} sesiones</div>
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

      <div className="tua-eyebrow" style={{ color: 'var(--color-muted)', marginTop: 4 }}>En “Mis turnos”</div>
      <div className="tua-tarjeta" style={{ background: 'transparent' }}>
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
