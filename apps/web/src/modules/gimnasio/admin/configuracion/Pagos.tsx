// Pagos: cómo cobra el negocio. En el mostrador (efectivo, transferencia con
// sus datos) y, con Mercado Pago conectado, online desde el sitio al reservar.
// También qué pasa con las membresías: quién registra la renovación, cuántos
// días de gracia hay y qué pasa con las reservas de quien venció. Conectar y
// desconectar es visual: no hay OAuth ni backend.
import { ArrowRight, CircleCheck, PlugZap, Unplug, Wallet } from 'lucide-react'
import { HOY, estadoPlanDe, rubroPorKey, type Socio } from '../../datos'
import { Campo, Chip, Encabezado, FilaSwitch, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { BarraGuardar, useBorrador, type PropsConfig } from '../piezas'

const CSS = `
  .gpg-mp { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 16px; border-radius: 12px; border: 1px dashed var(--color-border-strong); background: var(--color-surface); }
  .gpg-mp[data-conectado='true'] { border-style: solid; border-color: var(--color-border); background: var(--color-bg); }
  .gpg-mp-ico { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
  .gpg-mp > div { flex: 1 1 200px; min-width: 0; }
  .gpg-mp b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .gpg-mp small { display: block; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 640px) { .gpg-mp > .rv-btn { width: 100%; } }
`

export default function Pagos({ negocio, socios, onGuardar, onIrMensajes }: PropsConfig & { socios: Socio[]; onIrMensajes: () => void }) {
  const r = rubroPorKey(negocio.rubro)
  const b = useBorrador(negocio.pagos)
  const v = b.v
  const mp = v.mercadoPago
  // Conectar y desconectar se guardan al toque (no quedan en el borrador): un "Conectado" sin guardar confundía.
  const conectar = () => {
    const nuevo = { ...v, mercadoPago: { conectado: true, email: `pagos@${negocio.slug}.com.ar`, desde: HOY }, cobroOnline: true }
    b.setV(nuevo); onGuardar({ pagos: nuevo }, 'Mercado Pago conectado', 'Demo: no se conectó ninguna cuenta real.')
  }
  const desconectar = () => {
    const nuevo = { ...v, mercadoPago: { conectado: false, email: '', desde: null }, cobroOnline: false, renovacion: 'manual' as const }
    b.setV(nuevo); onGuardar({ pagos: nuevo }, 'Mercado Pago desconectado', 'Mientras tanto se cobra solo en el mostrador.')
  }
  const vencen = socios.filter(s => estadoPlanDe(s) === 'por-vencer').length
  const diasAviso = negocio.mensajes.plantillas.vence.cuando
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Reservas" titulo="Pagos" bajada={`Cómo te pagan tus ${r.socios.toLowerCase()}: en el mostrador y, con Mercado Pago, online al reservar. Los cobros del mostrador se registran a mano en cada ficha.`} />
      <div className="rv-pila">
        <Seccion titulo="Mercado Pago" bajada="Para cobrar planes y clases sueltas desde el sitio. La plata va directo a tu cuenta." acciones={mp.conectado ? <Chip tono="ok"><CircleCheck size={12} aria-hidden /> Conectado</Chip> : <Chip tono="aviso">Sin conectar</Chip>}>
          <div className="gpg-mp" data-conectado={mp.conectado}>
            <span className="gpg-mp-ico" aria-hidden>{mp.conectado ? <Wallet size={20} /> : <PlugZap size={20} />}</span>
            {mp.conectado
              ? <div><b>{negocio.nombre}</b><small>{mp.email} · conectada el {mp.desde}</small></div>
              : <div><b>Conectá tu cuenta en un minuto</b><small>Te lleva a Mercado Pago, aceptás y volvés. Sin esto, todo se paga en el mostrador.</small></div>}
            {mp.conectado
              ? <button type="button" className="rv-btn" onClick={desconectar}><Unplug size={15} aria-hidden /> Desconectar</button>
              : <button type="button" className="rv-btn rv-btn--primario" onClick={conectar}><PlugZap size={15} aria-hidden /> Conectar Mercado Pago</button>}
          </div>
          {mp.conectado && (
            <div style={{ marginTop: 10 }}>
              <FilaSwitch titulo="Cobrar online al reservar" ayuda="Planes y clases sueltas se pagan desde el sitio antes de confirmar el lugar. Apagado, se paga al llegar." on={v.cobroOnline} onChange={x => b.set('cobroOnline', x)} />
            </div>
          )}
        </Seccion>

        <Seccion titulo="En el mostrador" bajada="Se muestran en el sitio y en la confirmación, para que lleguen sabiendo cómo pagar.">
          <div className="rv-lista">
            <FilaSwitch titulo="Efectivo" on={v.efectivo} onChange={x => b.set('efectivo', x)} />
            <FilaSwitch titulo="Transferencia" ayuda="Con el alias y el CBU de abajo en la confirmación." on={v.transferencia} onChange={x => b.set('transferencia', x)} />
          </div>
          {v.transferencia && (
            <div className="rv-pila" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
              <div className="rv-dos">
                <Campo label="Alias" value={v.alias} onChange={x => b.set('alias', x)} />
                <Campo label="Titular" value={v.titular} onChange={x => b.set('titular', x)} />
              </div>
              <Campo label="CBU o CVU" value={v.cbu} onChange={x => b.set('cbu', x.replace(/\D/g, '').slice(0, 22))} inputMode="numeric" error={v.cbu.length === 22 ? undefined : `Tiene que tener 22 números (van ${v.cbu.length}).`} />
            </div>
          )}
          {!v.efectivo && !v.transferencia && !mp.conectado && <div style={{ marginTop: 12 }}><Nota tono="aviso">Sin ninguna forma de pago, nadie sabe cómo pagarte: dejá al menos una.</Nota></div>}
        </Seccion>

        <Seccion titulo="Membresías y vencimientos" bajada="Qué pasa cuando un plan llega a su fecha.">
          <div className="rv-pila">
            <div className="rv-grid rv-grid--3">
              <Selector label="Renovación" valor={v.renovacion} onChange={x => b.set('renovacion', x)} opciones={[{ id: 'manual' as const, label: 'La registrás vos' }, ...(mp.conectado ? [{ id: 'automatica' as const, label: 'Mercado Pago la cobra sola' }] : [])]} ayuda={mp.conectado ? 'Sola: se cobra al vencer con la tarjeta guardada.' : 'Para cobrarla sola hace falta Mercado Pago.'} />
              <Selector label="Días de gracia" valor={v.graciaDias} onChange={x => b.set('graciaDias', x)} opciones={[0, 3, 7].map(d => ({ id: d, label: d ? `${d} días` : 'Ninguno' }))} ayuda="Después de vencer, todavía puede reservar esos días." />
              <Selector label="Reservas al vencer" valor={v.alVencer} onChange={x => b.set('alVencer', x)} opciones={[{ id: 'mantener' as const, label: 'Se mantienen' }, { id: 'liberar' as const, label: 'Se liberan' }]} ayuda="Las clases que ya tenía reservadas quien venció." />
            </div>
            <Nota tono="info">
              <span style={{ flex: 1, minWidth: 0 }}>{vencen ? `Esta semana vencen ${vencen} ${vencen === 1 ? 'plan' : 'planes'}. ` : 'Esta semana no vence ningún plan. '}El aviso de vencimiento sale por WhatsApp {diasAviso === 1 ? 'el día anterior' : `${diasAviso} días antes`}{negocio.mensajes.plantillas.vence.on ? '' : ' (está apagado)'}.</span>
              <button type="button" className="rv-btn rv-btn--sm" onClick={onIrMensajes}>Ver mensaje <ArrowRight size={14} aria-hidden /></button>
            </Nota>
          </div>
        </Seccion>
      </div>
      <BarraGuardar cambiado={b.cambiado} motivo={v.transferencia && v.cbu.length !== 22 ? 'El CBU tiene que tener 22 números.' : undefined} onGuardar={() => onGuardar({ pagos: { ...v, alias: v.alias.trim(), titular: v.titular.trim() } }, 'Pagos guardados')} onDescartar={b.descartar} />
    </div>
  )
}
