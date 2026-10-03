// Pagos: Mercado Pago para cobrar señas y turnos online, y cómo se cobra en
// el local (eso no pasa por Órbita, pero se muestra en el sitio para que el
// cliente llegue sabiendo). Conectar/desconectar es visual: no hay OAuth.
import { Wallet, Store, Banknote, ArrowLeftRight, CreditCard, QrCode, Landmark, CircleCheck, Unplug, PlugZap, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { useBorrador, Encabezado, SecCard, FilaSwitch, Campo, Dos, Selector, BarraGuardar, Chip, BotonBorde, Boton, type PropsTab } from './ui'
import { subdominioDe, vozDe } from './datos'
import { fechaNumerica, sumarDias, useReloj } from '@/modules/turnos/reloj'

export default function Pagos({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const t = temaDe(rubro)
  const { fecha: hoy } = useReloj()
  const b = useBorrador(() => ({
    conectado: rubro.sena > 0, plazo: 'inmediato' as 'inmediato' | '10d' | '18d', cobroOnline: 'sena' as 'sena' | 'total' | 'elige',
    efectivo: true, transferencia: true, debito: true, credito: rubro.familia !== 'clases', qr: true,
    alias: `${subdominioDe(t.nombre).slice(0, 14)}.mp`, cbu: '0000003100012345678901', titular: t.nombre, mostrarDatos: true,
  }))
  const v = b.valor
  const [copiado, setCopiado] = useState(false)

  return (
    <div className="panel-page panel-page--form">
      <Encabezado rotulo="Tu negocio" titulo="Pagos" bajada={`Cómo te pagan tus ${voz.clientes}: online al reservar y en el local.`} />
      <div className="tuc-pila">

        <SecCard titulo="Mercado Pago" Icon={Wallet} badge={v.conectado ? <Chip tono="ok"><CircleCheck size={12} aria-hidden />Conectado</Chip> : <Chip tono="aviso">Sin conectar</Chip>}
          bajada="Lo necesitás para cobrar señas o el turno completo al reservar. La plata va directo a tu cuenta.">
          {v.conectado ? (
            <>
              <div className="tuc-renglon" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, flexWrap: 'wrap', marginBottom: 16 }}>
                <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: '#009EE3', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 8px 18px rgba(0,158,227,0.35)' }}><Wallet size={20} /></span>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{t.nombre}</div>
                  <div className="tuo-num" style={{ fontSize: 12, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>hola@{subdominioDe(t.nombre)}.com.ar · conectada el {fechaNumerica(sumarDias(hoy, -24))}</div>
                </div>
                <BotonBorde Icon={Unplug} onClick={() => { b.set('conectado', false); avisar('Mercado Pago desconectado', 'Mientras tanto no se cobran señas online.') }}>Desconectar</BotonBorde>
              </div>
              <Dos>
                <Selector label="Qué se cobra online" valor={v.cobroOnline} onChange={x => b.set('cobroOnline', x)} opciones={[{ id: 'sena', label: 'Solo la seña' }, { id: 'total', label: `El ${voz.turno} completo` }, { id: 'elige', label: `Lo elige el ${voz.cliente}` }]} />
                <Selector label="Cuándo te acredita Mercado Pago" ayuda="Según tu plan en Mercado Pago." valor={v.plazo} onChange={x => b.set('plazo', x)} opciones={[{ id: 'inmediato', label: 'Al instante' }, { id: '10d', label: 'A 10 días' }, { id: '18d', label: 'A 18 días' }]} />
              </Dos>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 14, border: '1.5px dashed var(--color-border-strong)', background: 'var(--color-surface)', flexWrap: 'wrap' }}>
              <span aria-hidden style={{ width: 46, height: 46, borderRadius: 12, background: 'color-mix(in srgb, #009EE3 14%, transparent)', color: '#009EE3', display: 'grid', placeItems: 'center', flexShrink: 0 }}><PlugZap size={22} /></span>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Conectá tu cuenta en 1 minuto</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>Te lleva a Mercado Pago, aceptás y volvés. Sin seña, las ausencias no tienen costo para nadie.</div>
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
                  className="tuc-icono" style={{ width: 30, height: 30 }}>
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

      <BarraGuardar dirty={b.dirty} onDescartar={b.descartar} onGuardar={() => { b.guardar(); avisar('Pagos guardados', 'Es una demo: no se guardó nada de verdad.') }} />
    </div>
  )
}
