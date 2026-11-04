// Qué hay libre: la pantalla para responder al toque cuando alguien pregunta
// "¿tenés algo el sábado?". En canchas, los horarios libres de cada cancha
// del día elegido; en salones, los bloques libres de cada salón del día, y si
// no hay, el próximo día con lugar; en alojamiento, qué propiedad está libre
// para unas fechas (por noche) o desde cuándo se puede entrar por tantos
// meses (por mes). Todo lo libre se toca y abre "Agendar a mano" con eso ya
// elegido (NuevaReserva, el mismo modal de la agenda). Lo ocupado abre la
// reserva que lo ocupa.
import { useState } from 'react'
import { CalendarCheck, CalendarSearch, Plus, Sun } from 'lucide-react'
import { diaSemana, fechaCorta, fechaLarga, fechaRelativa, hhmm, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { franjasDelDia } from '@/lib/reservas/disponibilidad'
import { pesos } from '@/lib/reservas/precio'
import { chocaRango, motivoNoReservable, primeraEntradaLibre, salidaDeMeses, salidaMaxima } from '@/lib/reservas/estadia'
import { AHORA, HOY, aperturaDe, bloqueoEn, bloquesDe, bloquesLibresEn, clientePorId, cuenta, esMensual, mesesTxt, nochesTxt, ocupadoDelDia, palabrasDe, rangosOcupados, type Cliente, type NegocioAlquiler, type Propiedad, type Reserva, type Salon } from '../datos'
import { Campo, Chip, Encabezado, Kpi, Selector, Vacio } from '@/design-system/reservas/piezas'
import { CSS_TIRA, Detalle, NuevaReserva, TiraDias } from './Reservas'

interface P {
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  onReservar: (r: Reserva, c: Cliente) => void
  onCambiar: (id: string, cambio: Partial<Reserva>, aviso?: string) => void
}

const CSS = `
  .ald-unidades { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .ald-unidad { display: flex; flex-direction: column; gap: 10px; }
  .ald-unidad-cab { display: flex; align-items: center; gap: 12px; }
  .ald-unidad-cab img { width: 52px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--color-surface-alt); }
  .ald-unidad-cab > div { flex: 1; min-width: 0; }
  .ald-unidad-cab b { display: block; font-size: 15px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ald-unidad-cab small { display: block; font-size: 12.5px; color: var(--color-muted); }
  .ald-libres { display: flex; flex-wrap: wrap; gap: 6px; }
  .ald-libre { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 0 11px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font: inherit; font-family: var(--rv-mono); font-size: 13px; cursor: pointer; }
  .ald-libre:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  @media (hover: hover) { .ald-libre:hover { border-color: var(--color-primary); color: var(--chip-primary-fg); } }
  .ald-fechas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; max-width: 640px; }
  .ald-estado { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--color-border); }
  .ald-estado > span:first-child { flex: 1; min-width: 160px; font-size: 13.5px; color: var(--color-body); }
  @media (max-width: 768px) { .ald-libre { min-height: 44px; } .ald-fechas { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
  @media (max-width: 480px) { .ald-fechas { grid-template-columns: minmax(0, 1fr); } .ald-unidades { grid-template-columns: minmax(0, 1fr); } }
`

export default function Disponibilidad(p: P) {
  const [nueva, setNueva] = useState<Partial<Reserva> | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const tipo = p.negocio.tipo
  const palabras = palabrasDe(p.negocio)
  const reserva = abierta ? p.reservas.find(r => r.id === abierta) ?? null : null
  return (
    <div className="rv-pagina">
      {/* Un solo texto: con dos hijos, el servidor mete un separador adentro del <style> y la hidratación falla. */}
      <style>{CSS_TIRA + CSS}</style>
      <Encabezado rotulo={fechaLarga(HOY)} titulo="Qué hay libre" bajada={`Para responder al toque cuando preguntan si hay lugar. Tocá ${tipo === 'estadia' ? 'una propiedad libre' : 'un horario libre'} y queda agendado a mano.`} />
      {tipo === 'cancha' && <LibrePorHora {...p} palabras={palabras} onNueva={setNueva} onAbrir={setAbierta} />}
      {tipo === 'bloque' && <LibrePorBloque {...p} palabras={palabras} onNueva={setNueva} onAbrir={setAbierta} />}
      {tipo === 'estadia' && <LibrePorPeriodo {...p} palabras={palabras} onNueva={setNueva} onAbrir={setAbierta} />}
      {nueva && <NuevaReserva negocio={p.negocio} reservas={p.reservas} clientes={p.clientes} pre={nueva} onCerrar={() => setNueva(null)} onReservar={(r, c) => { p.onReservar(r, c); setNueva(null) }} />}
      {reserva && <Detalle negocio={p.negocio} reserva={reserva} cliente={clientePorId(reserva.clienteId, p.clientes)} onCerrar={() => setAbierta(null)} onCambiar={p.onCambiar} />}
    </div>
  )
}

type Sub = P & { palabras: ReturnType<typeof palabrasDe>; onNueva: (pre: Partial<Reserva>) => void; onAbrir: (id: string) => void }

// ─── Por hora ────────────────────────────────────────────────────────────────

function LibrePorHora({ negocio, reservas, palabras, onNueva }: Sub) {
  const [dia, setDia] = useState<ISO>(HOY)
  // Los horarios libres de una cancha en un día (los de hoy, solo los que todavía no pasaron).
  const libresDe = (unidadId: string, f: ISO) => franjasDelDia(aperturaDe(negocio, f), ocupadoDelDia(negocio, reservas, unidadId, f), { paso: negocio.pasoMin, duracion: negocio.duracionMin, desde: f === HOY ? AHORA : undefined }).filter(x => x.libre)
  const hoy = negocio.unidades.reduce((s, u) => s + libresDe(u.id, HOY).length, 0)
  const manana = negocio.unidades.reduce((s, u) => s + libresDe(u.id, sumarDias(HOY, 1)).length, 0)
  // Libres ahora mismo: las canchas que tienen un horario que arranca en la próxima hora.
  const ahora = negocio.unidades.filter(u => libresDe(u.id, HOY).some(f => f.inicio >= AHORA && f.inicio < AHORA + 60)).length
  const cerrado = !aperturaDe(negocio, dia).length
  return (
    <>
      <div className="rv-kpis rv-kpis--3" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Libres hoy" Icon={Sun} valor={hoy} nota={`${cuenta(negocio.unidades.length, palabras.unidad, palabras.unidades)} · lo que queda del día`} />
        <Kpi i={1} label="Ahora mismo" Icon={CalendarCheck} tono={ahora ? 'ok' : 'aviso'} valor={`${ahora} de ${negocio.unidades.length}`} nota={`${palabras.unidades} con lugar en la próxima hora`} />
        <Kpi i={2} label="Mañana" Icon={CalendarSearch} valor={manana} nota="horarios libres" />
      </div>
      <TiraDias dia={dia} onDia={setDia} />
      {cerrado ? <Vacio titulo="Cerrado" texto={`${fechaLarga(dia)}: no se abre.`} /> : (
        <div className="ald-unidades">
          {negocio.unidades.map(u => {
            const b = bloqueoEn(negocio, u.id, dia)
            const libres = b ? [] : libresDe(u.id, dia)
            return (
              <section key={u.id} className="rv-card rv-card--pad ald-unidad" aria-label={u.nombre}>
                <div className="ald-unidad-cab">
                  <img src={u.foto} alt="" loading="lazy" />
                  <div><b>{u.nombre}</b><small>{u.detalle} · {pesos(u.tarifaHora)} la hora</small></div>
                  <Chip tono={b ? 'error' : libres.length ? 'ok' : 'gris'}>{b ? 'Bloqueada' : libres.length ? cuenta(libres.length, 'libre', 'libres') : 'Completa'}</Chip>
                </div>
                {b ? <p className="rv-ayuda" style={{ margin: 0 }}>No disponible: {b.motivo}.</p> : libres.length === 0 ? <p className="rv-ayuda" style={{ margin: 0 }}>{proximoDiaTxt(f => libresDe(u.id, f).length > 0, dia)}</p> : (
                  <div className="ald-libres" role="group" aria-label={`Horarios libres de ${u.nombre}`}>
                    {libres.map(f => <button key={f.inicio} type="button" className="ald-libre" onClick={() => onNueva({ unidadId: u.id, fecha: dia, inicio: f.inicio })} aria-label={`Agendar ${u.nombre} el ${fechaCorta(dia)} a las ${hhmm(f.inicio)}`}><Plus size={13} aria-hidden /> {hhmm(f.inicio)}</button>)}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

/** "Recién el jueves 19 de noviembre." o "Nada libre en los próximos 30 días.": el próximo día que cumple. */
function proximoDiaTxt(libre: (f: ISO) => boolean, desde: ISO): string {
  for (let i = 1; i <= 30; i++) {
    const f = sumarDias(desde, i)
    if (libre(f)) return `Sin lugar este día. Recién el ${fechaLarga(f).toLowerCase()}.`
  }
  return 'Nada libre en los próximos 30 días.'
}

// ─── Por bloque ──────────────────────────────────────────────────────────────

function LibrePorBloque({ negocio, reservas, palabras, onNueva }: Sub) {
  const [dia, setDia] = useState<ISO>(HOY)
  const libresDe = (s: Salon, f: ISO) => (f === HOY ? bloquesLibresEn(negocio, reservas, s, f).filter(b => b.inicio >= AHORA) : bloquesLibresEn(negocio, reservas, s, f))
  const abre = (f: ISO) => negocio.apertura.dias.includes(diaSemana(f))
  const hoy = negocio.salones.reduce((n, s) => n + libresDe(s, HOY).length, 0)
  // El fin de semana que viene (o el que está pasando): sábado y domingo.
  const sabado = sumarDias(HOY, (5 - diaSemana(HOY) + 7) % 7)
  const finde = [sabado, sumarDias(sabado, 1)].filter(abre).reduce((n, f) => n + negocio.salones.reduce((m, s) => m + libresDe(s, f).length, 0), 0)
  const proximo = (() => { for (let i = 0; i <= 60; i++) { const f = sumarDias(HOY, i); if (abre(f) && negocio.salones.some(s => libresDe(s, f).length)) return f } return null })()
  return (
    <>
      <div className="rv-kpis rv-kpis--3" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Bloques libres hoy" Icon={Sun} valor={hoy} nota={abre(HOY) ? `en ${cuenta(negocio.salones.length, palabras.unidad, palabras.unidades)}` : 'hoy no se abre'} />
        <Kpi i={1} label="Este fin de semana" Icon={CalendarCheck} tono={finde ? 'ok' : 'aviso'} valor={finde} nota={`bloques libres el ${fechaCorta(sabado)} y el ${fechaCorta(sumarDias(sabado, 1))}`} />
        <Kpi i={2} label="Próximo día con lugar" Icon={CalendarSearch} valor={proximo ? fechaRelativa(proximo, HOY) : '—'} nota={proximo ? fechaLarga(proximo) : 'nada en 60 días'} />
      </div>
      <TiraDias dia={dia} onDia={setDia} />
      {!abre(dia) ? <Vacio titulo="Cerrado" texto={`${fechaLarga(dia)}: no se abre.`} /> : (
        <div className="ald-unidades">
          {negocio.salones.map(s => {
            const b = bloqueoEn(negocio, s.id, dia)
            const libres = b ? [] : libresDe(s, dia)
            const total = bloquesDe(negocio, s).length
            return (
              <section key={s.id} className="rv-card rv-card--pad ald-unidad" aria-label={s.nombre}>
                <div className="ald-unidad-cab">
                  <img src={s.fotos[0] ?? negocio.fotoPortada} alt="" loading="lazy" />
                  <div><b>{s.nombre}</b><small>{s.detalle || `Hasta ${s.capacidad} personas`} · desde {pesos(Math.min(...s.paquetes.map(x => x.precio)))}</small></div>
                  <Chip tono={b ? 'error' : libres.length ? 'ok' : 'gris'}>{b ? 'Bloqueado' : libres.length ? `${libres.length} de ${total} libres` : 'Completo'}</Chip>
                </div>
                {b ? <p className="rv-ayuda" style={{ margin: 0 }}>No disponible: {b.motivo}.</p> : libres.length === 0 ? <p className="rv-ayuda" style={{ margin: 0 }}>{proximoDiaTxt(f => abre(f) && libresDe(s, f).length > 0, dia)}</p> : (
                  <div className="ald-libres" role="group" aria-label={`Bloques libres de ${s.nombre}`}>
                    {libres.map(bl => <button key={bl.id} type="button" className="ald-libre" onClick={() => onNueva({ unidadId: s.id, fecha: dia, bloqueId: bl.id })} aria-label={`Agendar ${s.nombre} el ${fechaCorta(dia)}, ${bl.nombre.toLowerCase()}`}><Plus size={13} aria-hidden /> {bl.nombre} {hhmm(bl.inicio)}–{hhmm(bl.fin)}</button>)}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Por noche y por mes ─────────────────────────────────────────────────────

function LibrePorPeriodo({ negocio, reservas, clientes, palabras, onNueva, onAbrir }: Sub) {
  const [entrada, setEntrada] = useState<ISO>(HOY)
  const [noches, setNoches] = useState(2)
  const [meses, setMeses] = useState(3)
  const salida = sumarDias(entrada, noches)
  const ocupadasDe = (p: Propiedad) => rangosOcupados(negocio, reservas, p.id)
  const porNoche = negocio.propiedades.filter(p => !esMensual(p))
  const porMes = negocio.propiedades.filter(p => esMensual(p))
  // Cuántas propiedades por noche están libres para esas fechas, y cuántas esta noche.
  const libresFechas = porNoche.filter(p => !motivoNoReservable(entrada, salida, p.tarifa, ocupadasDe(p))).length
  const libresHoy = porNoche.filter(p => !chocaRango(HOY, sumarDias(HOY, 1), ocupadasDe(p))).length
  const libresMes = porMes.filter(p => !chocaRango(entrada, salidaDeMeses(entrada, meses), ocupadasDe(p))).length
  const quien = (id: string) => clientePorId(id, clientes)?.nombre ?? '—'
  return (
    <>
      <div className="rv-kpis rv-kpis--3" style={{ marginBottom: 16 }}>
        <Kpi i={0} label="Libres esta noche" Icon={Sun} tono={libresHoy ? 'ok' : 'aviso'} valor={`${libresHoy} de ${porNoche.length}`} nota={porNoche.length ? `${palabras.unidades} por noche` : 'nada por noche'} />
        <Kpi i={1} label="Para esas fechas" Icon={CalendarCheck} valor={`${libresFechas} de ${porNoche.length}`} nota={`${rangoTxt(entrada, salida)} · ${nochesTxt(noches)}`} />
        <Kpi i={2} label="Por mes" Icon={CalendarSearch} valor={porMes.length ? `${libresMes} de ${porMes.length}` : '—'} nota={porMes.length ? `libres ${mesesTxt(meses)} desde el ${fechaCorta(entrada)}` : 'nada se alquila por mes'} />
      </div>
      <div className="ald-fechas">
        <Campo label="Entrada" type="date" value={entrada} onChange={v => { if (v) setEntrada(v) }} min={HOY} />
        {porNoche.length > 0 && <Selector label="Noches" valor={noches} onChange={setNoches} opciones={[1, 2, 3, 4, 5, 7, 10, 14].map(n => ({ id: n, label: nochesTxt(n) }))} />}
        {porMes.length > 0 && <Selector label="Meses (por mes)" valor={meses} onChange={setMeses} opciones={[1, 2, 3, 6, 12].map(n => ({ id: n, label: mesesTxt(n) }))} />}
      </div>
      <div className="ald-unidades">
        {negocio.propiedades.map(p => {
          const ocupadas = ocupadasDe(p)
          const mensual = esMensual(p) && p.mensual
          const hasta = mensual ? salidaDeMeses(entrada, meses) : salida
          const choque = chocaRango(entrada, hasta, ocupadas)
          const motivo = mensual ? (meses < p.mensual!.minMeses ? `Mínimo ${mesesTxt(p.mensual!.minMeses)}.` : null) : motivoNoReservable(entrada, salida, p.tarifa, ocupadas)
          const libre = !choque && !motivo
          // Si está ocupada: quién, hasta cuándo, y desde cuándo vuelve a estar libre para ese largo.
          const ocupante = choque?.tipo === 'reserva' ? reservas.find(r => r.id === choque.id) : undefined
          const desdeLibre = choque ? (mensual ? primeraEntradaLibre(choque.salida, meses, ocupadas, 365) : (() => { const d = choque.salida; const max = salidaMaxima(d, ocupadas); return max && sumarDias(d, noches) <= max ? d : primeraNocheLibre(d, noches, ocupadas) })()) : null
          const limite = !choque && !mensual ? salidaMaxima(entrada, ocupadas) : null
          const precio = mensual ? `${pesos(p.mensual!.precioMes)} el mes` : `${pesos(p.tarifa.precioNoche)} la noche`
          return (
            <section key={p.id} className="rv-card rv-card--pad ald-unidad" aria-label={p.nombre}>
              <div className="ald-unidad-cab">
                <img src={p.fotos[0]} alt="" loading="lazy" />
                <div><b>{p.nombre}</b><small>{p.tipo} · {mensual ? 'por mes' : cuenta(p.huespedes, 'huésped', 'huéspedes')} · {precio}</small></div>
                <Chip tono={libre ? 'ok' : choque ? (choque.tipo === 'bloqueo' ? 'gris' : 'aviso') : 'gris'}>{libre ? 'Libre' : choque ? (choque.tipo === 'bloqueo' ? 'Bloqueada' : mensual ? 'Alquilada' : 'Reservada') : 'No entra'}</Chip>
              </div>
              <div className="ald-estado">
                <span>
                  {libre
                    ? (mensual ? `Libre ${mesesTxt(meses)} desde el ${fechaCorta(entrada)}, hasta el ${fechaCorta(hasta)}.` : `Libre del ${rangoTxt(entrada, salida)}${limite && limite > salida ? `: se puede quedar hasta el ${fechaCorta(limite)}` : ''}.`)
                    : motivo && !choque ? motivo
                      : choque ? `${choque.tipo === 'bloqueo' ? 'Bloqueada' : `${mensual ? 'Alquilada por' : 'Reservada por'} ${ocupante ? quien(ocupante.clienteId) : '—'}`} hasta el ${fechaCorta(choque.salida)}${desdeLibre ? ` · libre ${mensual ? mesesTxt(meses) : nochesTxt(noches)} desde el ${fechaCorta(desdeLibre)}` : ''}.` : ''}
                </span>
                {libre && <button type="button" className="rv-btn rv-btn--sm rv-btn--primario" onClick={() => onNueva(mensual ? { unidadId: p.id, entrada, meses } : { unidadId: p.id, entrada, salida })}><Plus size={14} aria-hidden /> Agendar</button>}
                {!libre && ocupante && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onAbrir(ocupante.id)}>Ver reserva</button>}
                {!libre && desdeLibre && !ocupante && <button type="button" className="rv-btn rv-btn--sm" onClick={() => onNueva(mensual ? { unidadId: p.id, entrada: desdeLibre, meses } : { unidadId: p.id, entrada: desdeLibre, salida: sumarDias(desdeLibre, noches) })}><Plus size={14} aria-hidden /> Agendar desde el {fechaCorta(desdeLibre)}</button>}
              </div>
            </section>
          )
        })}
        {negocio.propiedades.length === 0 && <Vacio titulo={`Sin ${palabras.unidades}`} texto="Cargá la primera en Configuración." />}
      </div>
    </>
  )
}

/** La primera entrada desde `desde` en la que entran `noches` noches seguidas sin pisar nada (hasta un año). */
function primeraNocheLibre(desde: ISO, noches: number, ocupadas: ReturnType<typeof rangosOcupados>): ISO | null {
  for (let i = 0; i <= 365; i++) {
    const f = sumarDias(desde, i)
    if (!chocaRango(f, sumarDias(f, noches), ocupadas)) return f
  }
  return null
}
