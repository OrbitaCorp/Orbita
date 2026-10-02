// Reglas de reserva: la pantalla más propia de Turnos. Todo lo que decide
// cuándo y cómo puede reservar un cliente (anticipación, grilla, seña,
// cancelación, lista de espera). A la derecha, "Así lo ve tu cliente" traduce
// cada elección a lo que va a leer el que reserva: es la mejor forma de que el
// dueño entienda qué está configurando sin leer ayudas.
//
// Casi todo acá es una demo (se "guarda" en memoria). Las excepciones son la
// cuenta de clientes con sus beneficios y la política de cancelación y
// llegadas tarde: eso vive en el negocio de la demo (demo/negocioDemo.ts) y el
// sitio, la reserva, "Mis turnos" y los Términos lo leen de ahí, así que al
// guardar se ve de verdad del otro lado.
import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarClock, BadgeCheck, Wallet, RotateCcw, Repeat, Users, Hourglass, IdCard, UserX, CalendarRange,
  Timer, ShieldCheck, Eye, Clock, CircleCheck, Gift, UserRound, UserRoundCheck, BellRing, AlarmClock, ScrollText, Copy,
} from 'lucide-react'
import { esSalud, pesos, duracionTxt, horaTxt } from '@/modules/turnos/datos'
import { beneficiosTxt, plazoTxt, politicaTxt, useNegocioDemo, type BeneficiosCuenta, type PoliticaReserva } from '@/modules/turnos/demo/negocioDemo'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { useBorrador, Encabezado, SecCard, Segmentado, Selector, Campo, Dos, FilaSwitch, Divisor, BarraGuardar, BotonBorde, Rotulo, OpcionTarjeta, type PropsTab } from './ui'
import { vozDe, cap } from './datos'

const ANT_MIN = [{ id: 0, label: 'Sin mínimo' }, { id: 60, label: '1 hora' }, { id: 120, label: '2 horas' }, { id: 240, label: '4 horas' }, { id: 720, label: '12 horas' }, { id: 1440, label: '1 día' }]
const ANT_MAX = [{ id: 7, label: '1 semana' }, { id: 14, label: '2 semanas' }, { id: 30, label: '30 días' }, { id: 60, label: '2 meses' }, { id: 90, label: '3 meses' }]
const CANCEL_H = [{ id: 2, label: '2 horas antes' }, { id: 6, label: '6 horas antes' }, { id: 12, label: '12 horas antes' }, { id: 24, label: '24 horas antes' }, { id: 48, label: '48 horas antes' }]
// Hasta cuándo se cancela sin cargo, en horas antes del turno (0 = hasta último momento).
const PLAZOS = [0, 2, 6, 12, 24, 48, 72].map(h => ({ id: h, label: h === 0 ? 'Hasta último momento' : h < 48 ? `${h} horas antes` : `${h / 24} días antes` }))
const FUERA: { id: PoliticaReserva['senaFueraDePlazo']; label: string }[] = [{ id: 'se-pierde', label: 'No se devuelve' }, { id: 'queda-a-favor', label: 'Queda a favor para otro turno' }]
const TOLERANCIAS = [0, 5, 10, 15, 20, 30].map(m => ({ id: m, label: m ? `${m} min` : 'Sin tolerancia' }))
const LIMITE = [{ id: 0, label: 'Sin límite' }, { id: 1, label: '1 a la vez' }, { id: 2, label: '2 a la vez' }, { id: 3, label: '3 a la vez' }, { id: 5, label: '5 a la vez' }]
const BIENVENIDA = [0, 5, 10, 15, 20].map(p => ({ id: p, label: p ? `${p}% de descuento` : 'No ofrecer' }))
const SELLOS = [0, 5, 6, 8, 10].map(n => ({ id: n, label: n ? `Premio a los ${n} sellos` : 'No ofrecer' }))

interface Reglas {
  minAnt: number; maxAnt: number; buffer: number; grilla: number; confirmacion: 'auto' | 'manual'; elegirRecurso: boolean; cualquiera: boolean
  sena: boolean; senaTipo: 'pct' | 'fijo'; senaPct: number; senaFijo: string
  reprogramar: boolean; reproHoras: number; reproMax: number; limite: number; espera: boolean; esperaMin: number; ausentes: boolean
  cupoDef: string; abrirDias: number; minAnotados: string; obraSocial: boolean; dni: boolean; motivo: boolean
}

export default function Reservas({ rubro, avisar }: PropsTab) {
  const voz = vozDe(rubro)
  const cupo = rubro.modo === 'cupo'
  const salud = esSalud(rubro)
  const b = useBorrador<Reglas>(() => ({
    minAnt: salud ? 240 : 120, maxAnt: cupo ? 14 : 30, buffer: rubro.familia === 'belleza' ? 5 : 0, grilla: rubro.modo === 'cancha' ? 60 : 30,
    confirmacion: (rubro.sena > 0 ? 'auto' : salud ? 'manual' : 'auto') as 'auto' | 'manual',
    elegirRecurso: true, cualquiera: true,
    sena: rubro.sena > 0, senaTipo: 'pct' as 'pct' | 'fijo', senaPct: rubro.sena || 30, senaFijo: '5000',
    reprogramar: true, reproHoras: 12, reproMax: 2,
    limite: cupo ? 0 : 2, espera: cupo || rubro.modo === 'cancha', esperaMin: 30, ausentes: true,
    cupoDef: '15', abrirDias: 7, minAnotados: '3',
    obraSocial: salud, dni: salud, motivo: salud && rubro.key !== 'psico',
  }))
  const v = b.valor
  const ejemplo = rubro.servicios.find(s => s.precio > 0) ?? rubro.servicios[0]
  const senaMonto = v.senaTipo === 'pct' ? Math.round(ejemplo.precio * v.senaPct / 100 / 100) * 100 : Number(v.senaFijo) || 0
  const grillas = rubro.modo === 'cancha' ? [30, 60, 90] : [15, 30, 60]

  // La cuenta de clientes. null = sin tocar: vale lo guardado en el negocio de la
  // demo (que llega del navegador recién después de hidratar, por eso no se copia
  // a un estado al montar).
  const { demo, guardar: guardarDemo } = useNegocioDemo()
  const [cuentasBorrador, setCuentasBorrador] = useState<BeneficiosCuenta | null>(null)
  const cuentas = cuentasBorrador ?? demo.cuentas
  const cuentasDirty = cuentasBorrador !== null && JSON.stringify(cuentasBorrador) !== JSON.stringify(demo.cuentas)
  const ponerCuenta = (cambio: Partial<BeneficiosCuenta>) => setCuentasBorrador({ ...cuentas, ...cambio })

  // La política de cancelación y llegadas tarde: mismo patrón que la cuenta.
  const [politicaBorrador, setPoliticaBorrador] = useState<PoliticaReserva | null>(null)
  const politica = politicaBorrador ?? demo.politica
  const politicaDirty = politicaBorrador !== null && JSON.stringify(politicaBorrador) !== JSON.stringify(demo.politica)
  const ponerPolitica = (cambio: Partial<PoliticaReserva>) => setPoliticaBorrador({ ...politica, ...cambio })
  const textos = politicaTxt(politica)
  const copiarPolitica = () => {
    const texto = `Cambios y cancelaciones\n${textos.cambios}\n\nLlegadas tarde\n${textos.tarde}`
    navigator.clipboard?.writeText(texto).then(() => avisar('Política copiada', 'Pegala donde quieras: WhatsApp, Instagram o un cartel.'), () => avisar('No se pudo copiar', 'Seleccioná el texto y copialo a mano.'))
  }

  const seAplica = cuentasDirty || politicaDirty
  const guardar = () => {
    b.guardar()
    if (seAplica) guardarDemo({ cuentas, politica })
    setCuentasBorrador(null); setPoliticaBorrador(null)
    avisar('Reglas guardadas', seAplica ? 'Lo que cambiaste de la política y de la cuenta ya se ve en tu página. El resto es una demo.' : `Es una demo: tus ${voz.clientes} no ven ningún cambio.`)
  }
  const descartar = () => { b.descartar(); setCuentasBorrador(null); setPoliticaBorrador(null) }

  return (
    <div className="panel-page">
      <Encabezado rotulo="Tu negocio" titulo="Reglas de reserva" bajada={`Cuándo y cómo pueden reservar tus ${voz.clientes}. A la derecha ves cómo les queda.`} />

      <div className="tuc-res-split">
        <div className="tuc-pila">

          <SecCard titulo="Cuándo se puede reservar" Icon={CalendarClock} bajada="La ventana en la que tu agenda acepta reservas.">
            <Dos>
              <Selector label="Anticipación mínima" ayuda={`Evita ${voz.turnos} de último momento.`} valor={v.minAnt} opciones={ANT_MIN} onChange={x => b.set('minAnt', x)} />
              <Selector label="Hasta cuánto antes" ayuda="Qué tan lejos se ve la agenda." valor={v.maxAnt} opciones={ANT_MAX} onChange={x => b.set('maxAnt', x)} />
            </Dos>
            {!cupo && <>
              <Rotulo ayuda={`Cada cuánto arrancan los ${voz.turnos}: 9:00, 9:${v.grilla === 15 ? '15' : '30'}…`}>Horarios disponibles cada</Rotulo>
              <Segmentado label="Horarios disponibles cada" valor={v.grilla} onChange={x => b.set('grilla', x)} opciones={grillas.map(g => ({ id: g, label: duracionTxt(g) }))} />
              <div style={{ height: 16 }} />
              <Rotulo ayuda={`Tiempo libre entre un ${voz.turno} y el siguiente para limpiar, ordenar o respirar.`}>Margen entre {voz.turnos}</Rotulo>
              <Segmentado label={`Margen entre ${voz.turnos}`} valor={v.buffer} onChange={x => b.set('buffer', x)} opciones={[0, 5, 10, 15].map(m => ({ id: m, label: m ? `${m} min` : 'Sin margen' }))} />
            </>}
          </SecCard>

          {cupo && (
            <SecCard titulo="Clases con cupo" Icon={CalendarRange} bajada="Valores por defecto para cada clase nueva de la grilla. Cada clase se puede ajustar.">
              <Dos>
                <Campo label="Cupo por clase" value={v.cupoDef} onChange={x => b.set('cupoDef', x.replace(/\D/g, ''))} sufijo="lugares" />
                <Selector label="Se abre la reserva" valor={v.abrirDias} onChange={x => b.set('abrirDias', x)} opciones={[1, 2, 3, 7, 14].map(d => ({ id: d, label: d === 1 ? '1 día antes' : `${d} días antes` }))} />
              </Dos>
              <Campo label="Suspender si hay menos de" value={v.minAnotados} onChange={x => b.set('minAnotados', x.replace(/\D/g, ''))} sufijo="anotados, 2 h antes" ayuda="Les avisamos a los anotados por WhatsApp y se libera el crédito." />
            </SecCard>
          )}

          <SecCard titulo="Confirmación" Icon={BadgeCheck} bajada="Qué pasa apenas alguien reserva.">
            <div role="radiogroup" aria-label="Confirmación" className="tuc-grid-2">
              <OpcionTarjeta activa={v.confirmacion === 'auto'} onClick={() => b.set('confirmacion', 'auto')} Icon={CircleCheck} titulo="Automática" ayuda={`El ${voz.turno} queda confirmado al instante. Lo más cómodo para ${voz.clientes === 'pacientes' ? 'el paciente' : 'todos'}.`} />
              <OpcionTarjeta activa={v.confirmacion === 'manual'} onClick={() => b.set('confirmacion', 'manual')} Icon={Eye} titulo="La reviso yo" ayuda="Queda pendiente hasta que lo aceptás desde la agenda." />
            </div>
          </SecCard>

          <SecCard titulo={`Cuenta de ${voz.clientes} y beneficios`} Icon={Gift} bajada="Para reservar nunca hace falta registrarse. La cuenta es opcional y sirve para premiar a quien vuelve.">
            <div className="tuc-sinreg">
              <UserRoundCheck size={18} strokeWidth={1.8} aria-hidden />
              <div>
                <strong>Se reserva sin registrarse</strong>
                <span>Alcanza con el nombre y el celular. Nadie tiene que crear una cuenta ni acordarse de una contraseña.</span>
              </div>
            </div>
            <FilaSwitch Icon={UserRound} titulo="Ofrecer una cuenta opcional" ayuda="Quien quiera la crea al reservar: entra con su celular, sin contraseña, y vos le reconocés que vuelve." on={cuentas.activo} onChange={x => ponerCuenta({ activo: x })}>
              <Dos>
                <Selector label="Descuento de bienvenida" ayuda={`En ${cupo || rubro.modo === 'cancha' ? 'la primera' : 'el primer'} ${voz.turno} con cuenta.`} valor={cuentas.bienvenida} opciones={BIENVENIDA} onChange={x => ponerCuenta({ bienvenida: x })} />
                <Selector label="Tarjeta de sellos" ayuda={`Un sello por ${voz.turno}; al completarla, un premio.`} valor={cuentas.sellos} opciones={SELLOS} onChange={x => ponerCuenta({ sellos: x })} />
              </Dos>
              <FilaSwitch Icon={BellRing} titulo="Promos por WhatsApp" ayuda="Les avisás primero cuando hay una promo o se libera un horario." on={cuentas.promos} onChange={x => ponerCuenta({ promos: x })} />
            </FilaSwitch>
          </SecCard>

          {rubro.modo !== 'cupo' && (
            <SecCard titulo={rubro.modo === 'profesional' ? `Elegir ${voz.recurso}` : rubro.modo === 'cancha' ? 'Elegir cancha' : 'Asignación de espacios'} Icon={Users}>
              {rubro.modo === 'recurso' ? (
                <FilaSwitch titulo={`Asignar ${voz.recurso} automáticamente`} ayuda="Toma el primer espacio libre para ese horario. Tu cliente no lo elige." on={v.elegirRecurso} onChange={x => b.set('elegirRecurso', x)} />
              ) : <>
                <FilaSwitch titulo={rubro.modo === 'cancha' ? 'Dejar elegir la cancha' : `Dejar elegir con quién atenderse`} ayuda={rubro.modo === 'cancha' ? 'Si está apagado, se asigna la primera cancha libre.' : `Tus ${voz.clientes} ven fotos y especialidad de cada ${voz.recurso}.`} on={v.elegirRecurso} onChange={x => b.set('elegirRecurso', x)}>
                  <FilaSwitch titulo="Mostrar la opción “Cualquiera”" ayuda="Muestra todos los horarios libres, sin importar quién atiende. Llena más la agenda." on={v.cualquiera} onChange={x => b.set('cualquiera', x)} />
                </FilaSwitch>
              </>}
            </SecCard>
          )}

          <SecCard titulo="Seña" Icon={Wallet} bajada={`Con seña, las ausencias bajan mucho. Se paga con Mercado Pago al reservar${rubro.sena ? ` (en ${rubro.label.toLowerCase()} lo típico es ${rubro.sena}%)` : ''}.`}>
            <FilaSwitch titulo="Pedir seña para reservar" on={v.sena} onChange={x => b.set('sena', x)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <Rotulo>Tipo</Rotulo>
                  <Segmentado label="Tipo de seña" valor={v.senaTipo} onChange={x => b.set('senaTipo', x)} opciones={[{ id: 'pct', label: 'Porcentaje' }, { id: 'fijo', label: 'Monto fijo' }]} />
                </div>
                {v.senaTipo === 'pct' ? (
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Rotulo htmlFor="tuc-sena">Porcentaje del precio: <span className="tuo-num" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{v.senaPct}%</span></Rotulo>
                    <input id="tuc-sena" type="range" min={10} max={100} step={5} value={v.senaPct} onChange={e => b.set('senaPct', Number(e.target.value))} className="tuc-rango" />
                  </div>
                ) : (
                  <Campo label="Monto" value={v.senaFijo} onChange={x => b.set('senaFijo', x.replace(/\D/g, ''))} prefijo="$" style={{ flex: '1 1 160px', marginBottom: 0 }} />
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 10 }}>Ejemplo: en “{ejemplo.nombre}” (<span className="tuo-num">{pesos(ejemplo.precio)}</span>) la seña es <b className="tuo-num" style={{ color: 'var(--color-text)' }}>{pesos(senaMonto)}</b>.</div>
            </FilaSwitch>
            <Divisor />
            <FilaSwitch Icon={UserX} titulo="Pedir seña a quien faltó sin avisar" ayuda="Aunque no pidas seña en general, quien tiene una ausencia la paga en su próximo turno." on={v.ausentes} onChange={x => b.set('ausentes', x)} />
          </SecCard>

          <SecCard titulo="Cancelaciones y cambios" Icon={RotateCcw} bajada="Hasta cuándo se puede cancelar o mover, y qué pasa con la seña.">
            <Dos>
              <Selector label="Se cancela sin cargo" ayuda="A tiempo, la seña se devuelve al mismo medio de pago." valor={politica.cancelaHasta} opciones={PLAZOS} onChange={x => ponerPolitica({ cancelaHasta: x })} />
              <Selector label={politica.cancelaHasta > 0 ? 'Fuera de plazo o si falta, la seña…' : 'Si falta, la seña…'} ayuda="Lo lee antes de pagar y en los Términos." valor={politica.senaFueraDePlazo} opciones={FUERA} onChange={x => ponerPolitica({ senaFueraDePlazo: x })} />
            </Dos>
            <FilaSwitch Icon={Repeat} titulo="Permitir reprogramar" ayuda={`Desde el link del recordatorio, sin escribirte. La seña pasa al nuevo ${voz.turno}.`} on={v.reprogramar} onChange={x => b.set('reprogramar', x)}>
              <Dos>
                <Selector label="Hasta" valor={v.reproHoras} opciones={CANCEL_H} onChange={x => b.set('reproHoras', x)} />
                <Selector label="Cuántas veces" valor={v.reproMax} opciones={[1, 2, 3].map(n => ({ id: n, label: n === 1 ? '1 vez' : `${n} veces` }))} onChange={x => b.set('reproMax', x)} />
              </Dos>
            </FilaSwitch>
          </SecCard>

          <SecCard titulo="Llegadas tarde" Icon={AlarmClock} bajada={`Cuánto esperás a quien se demora antes de dar el ${voz.turno} por perdido.`}>
            <Rotulo ayuda={politica.tolerancia > 0 ? `Pasados ${politica.tolerancia} minutos podés marcarlo como ausente y liberar el horario.` : `El ${voz.turno} empieza a la hora reservada.`}>Tolerancia</Rotulo>
            <Segmentado label="Tolerancia" valor={politica.tolerancia} onChange={x => ponerPolitica({ tolerancia: x })} opciones={TOLERANCIAS} />
          </SecCard>

          <SecCard titulo="Tu política, en palabras" Icon={ScrollText} bajada={`Se arma sola con lo que elegís arriba. Es lo que tus ${voz.clientes} leen en los Términos de tu página.`}>
            <div className="tuc-politica">
              <h3>Cambios y cancelaciones</h3>
              <p>{textos.cambios}</p>
              <h3>Llegadas tarde</h3>
              <p>{textos.tarde}</p>
            </div>
            <BotonBorde Icon={Copy} style={{ marginTop: 12 }} onClick={copiarPolitica}>Copiar el texto</BotonBorde>
          </SecCard>

          <SecCard titulo="Límites y lista de espera" Icon={ShieldCheck} bajada="Para repartir mejor los horarios más pedidos.">
            <Selector label={`${cap(voz.turnos)} activos por ${voz.cliente}`} ayuda="Para que nadie acapare los mejores horarios." valor={v.limite} opciones={LIMITE} onChange={x => b.set('limite', x)} />
            <FilaSwitch Icon={Hourglass} titulo="Lista de espera" ayuda={`Si un horario está lleno, se anotan. Cuando alguien cancela, le ofrecemos el lugar al primero por WhatsApp.`} on={v.espera} onChange={x => b.set('espera', x)}>
              <Rotulo>Tiempo para aceptar el lugar</Rotulo>
              <Segmentado label="Tiempo para aceptar el lugar" valor={v.esperaMin} onChange={x => b.set('esperaMin', x)} opciones={[15, 30, 60].map(m => ({ id: m, label: duracionTxt(m) }))} />
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>Si no responde a tiempo, pasa al siguiente de la lista.</div>
            </FilaSwitch>
          </SecCard>

          {salud && (
            <SecCard titulo="Datos del paciente" Icon={IdCard} bajada="Qué se pide al reservar. Se guarda en la ficha del paciente, solo la ven vos y tu equipo.">
              <FilaSwitch titulo="Obra social o prepaga" ayuda="Con número de afiliado. Podés marcar cuáles atendés." on={v.obraSocial} onChange={x => b.set('obraSocial', x)} />
              <FilaSwitch titulo="DNI" on={v.dni} onChange={x => b.set('dni', x)} />
              <FilaSwitch titulo="Motivo de la consulta" ayuda="Campo opcional, texto libre." on={v.motivo} onChange={x => b.set('motivo', x)} />
            </SecCard>
          )}
        </div>

        <aside className="tuc-res-resumen" aria-label="Así lo ve tu cliente">
          <Resumen v={v} rubro={rubro} senaMonto={senaMonto} cuentas={cuentas} politica={politica} />
        </aside>
      </div>

      <BarraGuardar dirty={b.dirty || seAplica} onDescartar={descartar} onGuardar={guardar} />
    </div>
  )
}

const AHORA = 10 * 60 // la demo "está" a las 10:00

// Tarjeta que imita el paso de elegir horario del sitio público, con los
// textos que genera cada regla. Pinta con los colores del sitio del negocio
// (tema.ts) para que se sienta "del otro lado del mostrador".
function Resumen({ v, rubro, senaMonto, cuentas, politica }: { v: Reglas; rubro: PropsTab['rubro']; senaMonto: number; cuentas: BeneficiosCuenta; politica: PoliticaReserva }) {
  const voz = vozDe(rubro)
  const t = temaDe(rubro)
  const cupo = rubro.modo === 'cupo'
  const ejemplo = rubro.servicios.find(s => s.precio > 0) ?? rubro.servicios[0]
  const paso = v.grilla
  const slots = Array.from({ length: 12 }, (_, i) => 9 * 60 + i * paso).filter(m => m <= 19 * 60).slice(0, 9)
  const primero = AHORA + v.minAnt
  const antTxt = v.minAnt === 0 ? 'hasta último momento' : `con al menos ${v.minAnt >= 1440 ? '1 día' : `${v.minAnt / 60} h`} de anticipación`
  const maxTxt = ANT_MAX.find(x => x.id === v.maxAnt)?.label ?? `${v.maxAnt} días`
  const fuera = politica.senaFueraDePlazo === 'se-pierde' ? 'la seña no se devuelve' : 'la seña te queda a favor'
  const dias = ['Hoy', 'Mañana', 'Lun 28', 'Mar 29', 'Mié 30']
  const beneficios = beneficiosTxt(cuentas, rubro)

  const lineas: [LucideIcon, ReactNode][] = [
    [UserRoundCheck, <>Reservás <b>sin registrarte</b>: solo tu nombre y tu celular.</>],
    [CalendarClock, <>Reservás {antTxt} y hasta <b>{maxTxt}</b> antes.</>],
    [v.confirmacion === 'auto' ? CircleCheck : Clock, v.confirmacion === 'auto' ? <>Tu {voz.turno} queda <b>confirmado al instante</b>.</> : <>El negocio <b>confirma tu {voz.turno}</b> por WhatsApp.</>],
  ]
  if (v.sena) lineas.push([Wallet, <>Para reservar pagás una <b>seña de {pesos(senaMonto)}</b> con Mercado Pago.</>])
  lineas.push([RotateCcw, <>Cancelás sin cargo <b>{plazoTxt(politica.cancelaHasta)}</b>{v.sena ? <>; {politica.cancelaHasta > 0 ? 'después' : 'si faltás'}, {fuera}</> : ''}.</>])
  if (politica.tolerancia > 0) lineas.push([AlarmClock, <>Te esperamos <b>{politica.tolerancia} minutos</b>.</>])
  if (v.reprogramar) lineas.push([Repeat, <>Podés cambiar el horario hasta {v.reproMax === 1 ? '1 vez' : `${v.reproMax} veces`}.</>])
  if (!cupo && rubro.modo !== 'recurso' && v.elegirRecurso) lineas.push([Users, <>Elegís {rubro.modo === 'cancha' ? 'la cancha' : `con quién atenderte`}{v.cualquiera ? <> o “Cualquiera”</> : ''}.</>])
  if (v.espera) lineas.push([Hourglass, <>Si está lleno, te anotás en la lista de espera y tenés <b>{duracionTxt(v.esperaMin)}</b> para aceptar el lugar.</>])
  if (v.limite) lineas.push([Timer, <>Hasta {v.limite} {v.limite === 1 ? voz.turno : voz.turnos} activos a la vez.</>])
  if (v.dni || v.obraSocial) lineas.push([IdCard, <>Te pedimos {[v.dni && 'DNI', v.obraSocial && 'obra social'].filter(Boolean).join(' y ')}.</>])
  if (beneficios.length) lineas.push([Gift, <>Si querés, creás tu cuenta y sumás <b>{beneficios.map(x => x.titulo.toLowerCase()).join(', ')}</b>.</>])

  return (
    <div className="tuo-card tuo-card--luz tuc-resumen">
      <div className="tuc-resumen-cab">
        <Eye size={14} aria-hidden style={{ color: 'var(--color-primary)' }} />
        <span className="tuo-rotulo" style={{ flex: 1 }}>Así lo ve tu {voz.cliente}</span>
        <span className="tuo-chip tuo-chip--ok" style={{ height: 22, fontSize: 11 }}><span aria-hidden className="tuo-late" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />En vivo</span>
      </div>
      <div style={{ background: t.c.bg, color: t.c.body, padding: 18, fontFamily: t.fb }}>
        <div style={{ fontFamily: t.fh, fontSize: 20, fontWeight: 700, color: t.c.text, textTransform: t.mayus ? 'uppercase' : 'none', lineHeight: 1.1 }}>{cupo ? 'Elegí tu clase' : 'Elegí día y horario'}</div>
        <div style={{ fontSize: 12.5, color: t.c.muted, marginTop: 4 }}>{ejemplo.nombre} · {duracionTxt(ejemplo.duracion)}</div>
        <div aria-hidden style={{ display: 'flex', gap: 6, marginTop: 14, overflow: 'hidden' }}>
          {dias.map((d, i) => {
            const fuera = i === 0 && primero > 19 * 60
            return <span key={d} style={{ flex: '0 0 auto', padding: '7px 10px', borderRadius: t.radio, fontSize: 12, fontWeight: 600, background: i === 0 ? t.c.primary : t.c.surfaceAlt, color: i === 0 ? t.c.onPrimary : t.c.body, opacity: fuera ? 0.4 : 1 }}>{d}</span>
          })}
        </div>
        {cupo ? (
          <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {[[18 * 60, 12], [19 * 60 + 15, 15], [20 * 60 + 30, 6]].map(([h, anot], i) => {
              const lleno = anot >= (Number(v.cupoDef) || 15)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: t.radio, background: t.c.surface, border: `1px solid ${t.c.border}` }}>
                  <span style={{ fontWeight: 700, color: t.c.text, fontSize: 13, fontFamily: '"Geist Mono", monospace' }}>{horaTxt(h)}</span>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{rubro.servicios[i % rubro.servicios.length].nombre}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: lleno ? t.c.muted : t.c.primary }}>{lleno ? (v.espera ? 'Lista de espera' : 'Lleno') : `${(Number(v.cupoDef) || 15) - anot} lugares`}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 12 }}>
            {slots.map(m => {
              const no = m < primero
              return <span key={m} style={{ textAlign: 'center', padding: '8px 0', borderRadius: t.radio, fontSize: 12.5, fontWeight: 600, fontFamily: '"Geist Mono", monospace', border: `1px solid ${t.c.border}`, color: no ? t.c.muted : t.c.text, background: no ? 'transparent' : t.c.surface, textDecoration: no ? 'line-through' : 'none', opacity: no ? 0.55 : 1 }}>{horaTxt(m)}</span>
            })}
          </div>
        )}
        {!cupo && (v.buffer > 0 || v.minAnt > 0) && (
          <div style={{ fontSize: 11.5, color: t.c.muted, marginTop: 8 }}>
            {v.minAnt > 0 && <>Hoy, desde las {horaTxt(Math.min(primero, 23 * 60))}. </>}
            {v.buffer > 0 && <>Con {v.buffer} min entre {voz.turnos}.</>}
          </div>
        )}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lineas.map(([I, txt], i) => (
          <li key={i} className="tuc-resumen-linea">
            <span aria-hidden className="tuc-resumen-ico"><I size={14} strokeWidth={1.8} /></span>
            <span>{txt}</span>
          </li>
        ))}
      </ul>
      <div style={{ padding: '0 16px 16px' }}>
        <span aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: t.radio, background: t.c.primary, color: t.c.onPrimary, fontFamily: t.fb, fontWeight: 700, fontSize: 14 }}>
          {v.sena ? `Pagar seña y ${cupo ? 'reservar' : 'confirmar'}` : `Confirmar ${voz.turno}`}
        </span>
      </div>
    </div>
  )
}

export const CSS_RESERVAS = `
  .tuc-politica { padding: 16px 18px; border-radius: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-left: 3px solid var(--color-primary); }
  .tuc-politica h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-text); }
  .tuc-politica p { margin: 4px 0 0; font-size: 13.5px; line-height: 1.6; color: var(--color-body); text-wrap: pretty; }
  .tuc-politica p + h3 { margin-top: 14px; }
  .tuc-sinreg { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; margin-bottom: 4px; border-radius: 12px; background: var(--color-success-bg); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent); }
  .tuc-sinreg > svg { flex-shrink: 0; margin-top: 2px; color: var(--color-success); }
  .tuc-sinreg strong { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tuc-sinreg span { display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.5; color: var(--color-body); }
  .tuc-resumen { overflow: hidden; box-shadow: 0 24px 60px -30px rgba(15,23,42,0.4), var(--shadow-card); }
  .tuc-resumen-cab { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
  .tuc-resumen-linea { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--color-body); line-height: 1.45; padding: 6px 8px; margin: 0 -8px; border-radius: 10px; transition: background 150ms ease; animation: tucAbre 260ms var(--tuo-ease, ease) both; }
  .tuc-resumen-ico { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; color: var(--color-primary); background: var(--color-primary-bg); }
  @media (hover: hover) { .tuc-resumen-linea:hover { background: var(--color-surface); } }
  @media (prefers-reduced-motion: reduce) { .tuc-resumen-linea { animation: none; } }
  .tuc-res-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 24px; align-items: start; max-width: 1180px; }
  .tuc-res-resumen { position: sticky; top: 16px; }
  @media (max-width: 1024px) {
    .tuc-res-split { grid-template-columns: minmax(0, 1fr); }
    .tuc-res-resumen { position: static; }
  }
`
