// Pagos: primero lo que hay que cobrar hoy (las señas que faltan, sacadas de
// la agenda), y después cómo se cobra: Mercado Pago para señas y turnos online,
// y los medios de pago del local (eso no pasa por Órbita, pero se muestra en el
// sitio para que el cliente llegue sabiendo). Conectar/desconectar es visual:
// no hay OAuth.
import { Wallet, Store, Banknote, ArrowLeftRight, CreditCard, QrCode, Landmark, CircleCheck, Unplug, PlugZap, Copy, Check, Coins, CalendarCog } from 'lucide-react'
import { useState } from 'react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { horaTxt, pesos } from '@/modules/turnos/datos'
import { Encabezado, SecCard, FilaSwitch, Campo, Dos, Selector, Chip, BotonBorde, Boton, type PropsTab } from './ui'
import { BarraGuardar, useBorrador } from '@/design-system/reservas/piezas'
import { subdominioDe, vozDe } from './datos'
import { cuandoTxt, type TurnoAgenda } from '../../datos/agenda'

const CSS = `
  .tuc-mp { display: flex; align-items: center; gap: 12px; padding: 14px; flex-wrap: wrap; margin-bottom: 16px; }
  .tuc-mp-ico { width: 40px; height: 40px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; color: var(--color-primary); background: var(--color-primary-bg); }
  .tuc-mp > div { flex: 1 1 180px; min-width: 0; }
  .tuc-mp b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .tuc-mp small { display: block; font-size: 12.5px; color: var(--color-muted); line-height: 1.45; overflow: hidden; text-overflow: ellipsis; }
  .tuc-mp--conectar { border-style: dashed; border-color: var(--color-border-strong); background: var(--color-surface); }
  /* Las señas: una tabla del kit (tarjetas en celular); la fecha abre el turno y "Registrar" la cobra. */
  .tuc-senas { margin: 0 -4px; }
  .tuc-senas td:first-child > .tuc-link { padding: 0; }
  .tuc-senas-cliente { display: block; color: var(--color-text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tuc-senas-serv { display: block; font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 768px) { .tuc-senas .rv-btn { width: 100%; } }
`

interface Props extends PropsTab {
  /** Los turnos que vienen y todavía no pagaron la seña (vacío si el negocio no pide seña). */
  senas: TurnoAgenda[]
  nombreDe: (clienteId: string) => string
  onAbrir: (t: TurnoAgenda) => void
  onRegistrar: (t: TurnoAgenda) => void
  onIr: (vista: string) => void
}

export default function Pagos({ rubro, avisar, senas, nombreDe, onAbrir, onRegistrar, onIr }: Props) {
  const voz = vozDe(rubro)
  const t = temaDe(rubro)
  const b = useBorrador(() => ({
    conectado: rubro.sena > 0, plazo: 'inmediato' as 'inmediato' | '10d' | '18d', cobroOnline: 'sena' as 'sena' | 'total' | 'elige',
    efectivo: true, transferencia: true, debito: true, credito: rubro.familia !== 'clases', qr: true,
    alias: `${subdominioDe(t.nombre).slice(0, 14)}.mp`, cbu: '0000003100012345678901', titular: t.nombre, mostrarDatos: true,
  }))
  const v = b.v
  const [copiado, setCopiado] = useState(false)
  const senaDe = (x: TurnoAgenda) => Math.round(x.precio * rubro.sena / 100)
  const totalSenas = senas.reduce((s, x) => s + senaDe(x), 0)

  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado
        rotulo="Reservas" titulo="Pagos" bajada={`Lo que falta cobrar y cómo te pagan tus ${voz.clientes}: online al reservar y en el local.`}
        acciones={rubro.sena > 0 ? <span className="rv-chip rv-chip--aviso" role="status"><Coins size={13} aria-hidden /> <b className="rv-num">{senas.length}</b> seña{senas.length === 1 ? '' : 's'} por cobrar</span> : undefined}
      />
      <div className="rv-pila">

        {rubro.sena > 0 ? (
          <SecCard titulo="Señas por cobrar" Icon={Coins} badge={totalSenas > 0 ? <Chip tono="aviso"><span className="rv-num">{pesos(totalSenas)}</span></Chip> : <Chip tono="ok"><CircleCheck size={12} aria-hidden />Al día</Chip>}
            bajada={`Los ${voz.turnos} de las próximas dos semanas que todavía no pagaron la seña del ${rubro.sena}%. Cuando te la pagan en el local o por transferencia, la registrás acá.`}>
            {senas.length === 0 ? (
              <p className="rv-ayuda" style={{ margin: 0 }}>Todas las señas de los próximos {voz.turnos} están pagas.</p>
            ) : (
              <div className="tuc-senas">
                <table className="rv-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Cuándo</th>
                      <th scope="col">{rubro.cliente}</th>
                      <th scope="col">Seña</th>
                      <th scope="col"><span className="rv-sr">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {senas.map(x => (
                      <tr key={x.id}>
                        {/* data-label vacío: sin él, en celular la celda cae a la derecha (regla del kit para las celdas de acciones). */}
                        <td data-label=""><button type="button" className="tuc-link rv-num" onClick={() => onAbrir(x)} aria-label={`Ver el turno de ${nombreDe(x.clienteId)}, ${cuandoTxt(x.dia ?? 0).toLowerCase()} a las ${horaTxt(x.inicio)}`}>{cuandoTxt(x.dia ?? 0)} · {horaTxt(x.inicio)}</button></td>
                        <td data-label={rubro.cliente}><span style={{ minWidth: 0 }}><span className="tuc-senas-cliente">{nombreDe(x.clienteId)}</span><span className="tuc-senas-serv">{x.servicio}</span></span></td>
                        <td data-label="Seña"><span className="rv-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{pesos(senaDe(x))}</span></td>
                        <td><button type="button" className="rv-btn rv-btn--sm" onClick={() => onRegistrar(x)}><Check size={14} aria-hidden /> Registrar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecCard>
        ) : (
          <SecCard titulo="Señas" Icon={Coins} badge={<Chip>No pedís seña</Chip>} bajada={`Hoy tus ${voz.clientes} reservan sin pagar nada por adelantado. Con seña, las ausencias bajan mucho.`}>
            <BotonBorde Icon={CalendarCog} onClick={() => onIr('reglas')}>Pedir seña desde Reglas de reserva</BotonBorde>
          </SecCard>
        )}

        <SecCard titulo="Mercado Pago" Icon={Wallet} badge={v.conectado ? <Chip tono="ok"><CircleCheck size={12} aria-hidden />Conectado</Chip> : <Chip tono="aviso">Sin conectar</Chip>}
          bajada="Lo necesitás para cobrar señas o el turno completo al reservar. La plata va directo a tu cuenta.">
          {v.conectado ? (
            <>
              <div className="tuc-renglon tuc-mp">
                <span aria-hidden className="tuc-mp-ico"><Wallet size={18} /></span>
                <div>
                  <b>{t.nombre}</b>
                  <small className="rv-num">hola@{subdominioDe(t.nombre)}.com.ar · conectada el 02/09/2026</small>
                </div>
                <BotonBorde Icon={Unplug} onClick={() => { b.set('conectado', false); avisar('Mercado Pago desconectado', 'Mientras tanto no se cobran señas online.') }}>Desconectar</BotonBorde>
              </div>
              <Dos>
                <Selector label="Qué se cobra online" valor={v.cobroOnline} onChange={x => b.set('cobroOnline', x)} opciones={[{ id: 'sena', label: 'Solo la seña' }, { id: 'total', label: `El ${voz.turno} completo` }, { id: 'elige', label: `Lo elige el ${voz.cliente}` }]} />
                <Selector label="Cuándo te acredita Mercado Pago" ayuda="Según tu plan en Mercado Pago." valor={v.plazo} onChange={x => b.set('plazo', x)} opciones={[{ id: 'inmediato', label: 'Al instante' }, { id: '10d', label: 'A 10 días' }, { id: '18d', label: 'A 18 días' }]} />
              </Dos>
            </>
          ) : (
            <div className="tuc-renglon tuc-mp tuc-mp--conectar" style={{ marginBottom: 0 }}>
              <span aria-hidden className="tuc-mp-ico"><PlugZap size={20} /></span>
              <div>
                <b>Conectá tu cuenta en 1 minuto</b>
                <small>Te lleva a Mercado Pago, aceptás y volvés. Sin seña, las ausencias no tienen costo para nadie.</small>
              </div>
              <Boton variant="primary" icon={<PlugZap size={15} aria-hidden />} onClick={() => { b.set('conectado', true); avisar('Mercado Pago conectado', 'Demo: no se conectó ninguna cuenta real.') }}>Conectar Mercado Pago</Boton>
            </div>
          )}
        </SecCard>

        <SecCard titulo="Medios de pago en el local" Icon={Store} bajada="Se muestran en tu sitio y en la confirmación, para que lleguen sabiendo cómo pagar.">
          <FilaSwitch Icon={Banknote} titulo="Efectivo" on={v.efectivo} onChange={x => b.set('efectivo', x)} />
          <FilaSwitch Icon={ArrowLeftRight} titulo="Transferencia" on={v.transferencia} onChange={x => b.set('transferencia', x)} />
          <FilaSwitch Icon={CreditCard} titulo="Tarjeta de débito" on={v.debito} onChange={x => b.set('debito', x)} />
          <FilaSwitch Icon={CreditCard} titulo="Tarjeta de crédito" on={v.credito} onChange={x => b.set('credito', x)} />
          <FilaSwitch Icon={QrCode} titulo="QR de Mercado Pago" on={v.qr} onChange={x => b.set('qr', x)} />
        </SecCard>

        {v.transferencia && (
          <SecCard titulo="Datos para transferir" Icon={Landmark} bajada="Lo que se le muestra a quien elige pagar por transferencia.">
            <Dos>
              <Campo label="Alias" value={v.alias} onChange={x => b.set('alias', x)} mono sufijo={
                <button type="button" aria-label="Copiar alias" onClick={() => { void navigator.clipboard?.writeText(v.alias).catch(() => undefined); setCopiado(true); setTimeout(() => setCopiado(false), 1600) }}
                  className="tuc-icono">
                  {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                </button>
              } />
              <Campo label="Titular" value={v.titular} onChange={x => b.set('titular', x)} />
            </Dos>
            <Campo label="CBU o CVU" value={v.cbu} onChange={x => b.set('cbu', x.replace(/\D/g, '').slice(0, 22))} mono ayuda={v.cbu.length === 22 ? undefined : `Tiene que tener 22 números (van ${v.cbu.length}).`} />
            <FilaSwitch titulo="Mandar estos datos en la confirmación" ayuda={`Así el ${voz.cliente} puede transferir la seña o el total antes de venir.`} on={v.mostrarDatos} onChange={x => b.set('mostrarDatos', x)} />
          </SecCard>
        )}
      </div>

      <BarraGuardar cambiado={b.cambiado} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Pagos guardados', 'Es una demo: no se guardó nada de verdad.') }} />
    </div>
  )
}
