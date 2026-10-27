// Panel del negocio de Alquileres (demo): el armazón estándar del panel de
// Órbita (LayoutPanel) con todas las secciones en la barra lateral, por modo
// (ver navegacion.ts): lo de hoy, lo que se alquila, las reglas de la
// reserva, los calendarios externos y la configuración del negocio. Cambia
// de pantalla con ?vista= (y ?tab= adentro de Configuración); la reserva o el
// cliente abiertos en un modal viajan en ?reserva= y ?cliente=, así la
// campanita, el buscador e Ingresos los abren desde cualquier parte.
//
// Todo lo que se toca acá vive en el almacén de la demo (datos/negocio.ts):
// una reserva que se confirma en el panel se ve en "Mis reservas", y una que
// se hace desde el sitio aparece acá (y en la campanita). No hay backend.
import { useEffect, useEffectEvent } from 'react'
import { useRouter } from 'next/router'
import { Ban, Building2, CalendarCheck, CalendarDays, Contact, HandCoins, Home, Link2, LogIn, LogOut, MessageSquare, Package, PartyPopper, Settings, ShieldCheck, Sparkles, Sun, Tag, Trophy, Wallet, type LucideIcon } from 'lucide-react'
import LayoutPanel, { type AvisoNav, type ItemBusqueda, type ItemNav } from '@/design-system/reservas/LayoutPanel'
import { useAviso } from '@/design-system/reservas/piezas'
import { DIAS_CORTOS, MESES_CORTOS, diaSemana, fechaCorta, hhmm, partes, rangoTxt } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { AHORA, HOY, TIPOS, clientePorId, cuenta, fechaDeReserva, reservasDelDia, rolDe, rubroPorKey, tituloEvento, unidadPorId, unidadesDe, type Bloqueo, type NegocioAlquiler, type Reserva } from '../datos'
import { deCalendario } from '../datos/negocio'
import { useNegocio } from '../demo/useNegocio'
import { ruta } from '../storefront/Sitio'
import { resolverRuta, seccionesDe, type TabConfiguracion, type Vista } from './navegacion'
import { EstiloPanelAlquileres } from './piezas'
import Reservas from './Reservas'
import Clientes from './Clientes'
import Eventos from './Eventos'
import Ingresos from './Ingresos'
import Negocio from './configuracion/Negocio'
import Horarios from './configuracion/Horarios'
import Equipo from './configuracion/Equipo'
import Reglas from './configuracion/Reglas'
import Canchas from './configuracion/Canchas'
import Extras from './configuracion/Extras'
import Precios from './configuracion/Precios'
import Salon from './configuracion/Salon'
import Paquetes from './configuracion/Paquetes'
import Propiedades from './configuracion/Propiedades'
import Temporadas from './configuracion/Temporadas'
import Bloqueos from './configuracion/Bloqueos'
import Mensajes from './configuracion/Mensajes'
import Pagos from './configuracion/Pagos'
import Calendarios from './configuracion/Calendarios'

const ICONOS: Record<Vista, LucideIcon> = {
  reservas: CalendarDays, clientes: Contact, eventos: PartyPopper, ingresos: HandCoins,
  unidades: Trophy, extras: Sparkles, precios: Tag, salon: Building2, paquetes: Package, propiedades: Home, temporadas: Sun,
  reglas: ShieldCheck, bloqueos: Ban, mensajes: MessageSquare, pagos: Wallet, calendarios: Link2, configuracion: Settings,
}

/** El "hoy" de la demo en el header: "Sáb 14 nov · 10:40". */
const FECHA = `${DIAS_CORTOS[diaSemana(HOY)]} ${partes(HOY).dia} ${MESES_CORTOS[partes(HOY).mes - 1]} · ${hhmm(AHORA)}`

/** "Cancha 2 · sáb 14 nov 17:00" o "Cabaña Arrayán · 14 al 19 de noviembre": dónde y cuándo, para los avisos y el buscador. */
function cuandoDe(n: NegocioAlquiler, r: Reserva) {
  const u = unidadPorId(n, r.unidadId)?.nombre ?? n.nombre
  return r.entrada && r.salida ? `${u} · ${rangoTxt(r.entrada, r.salida)}` : `${u} · ${fechaCorta(r.fecha ?? HOY)} ${hhmm(r.inicio ?? 0)}`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Panel() {
  const router = useRouter()
  const n = useNegocio()
  const { tipo, negocio, reservas, clientes, hidratado } = n
  const [avisar, aviso] = useAviso()
  // Cada modo arranca con su propio estado de pantalla, y todo se vuelve a
  // montar una vez cuando el navegador lee lo guardado: los formularios
  // siembran su estado con el negocio, y al recargar se quedaban con el de ejemplo.
  const k = `${tipo}:${hidratado ? 'guardado' : 'fabrica'}`
  const secciones = seccionesDe(tipo)
  const r = resolverRuta(router.query, tipo)
  const { vista, tab } = r
  const reservaAbierta = typeof router.query.reserva === 'string' ? router.query.reserva : null
  const clienteAbierto = typeof router.query.cliente === 'string' ? router.query.cliente : null

  // ── Navegación: todo viaja en la URL ──
  const irA = (v: Vista, t?: TabConfiguracion, extra: Record<string, string> = {}) => {
    const { tab: _t, reserva: _r, cliente: _c, ...resto } = router.query
    void _t; void _r; void _c
    void router.replace({ pathname: router.pathname, query: { ...resto, vista: v, ...(t ? { tab: t } : {}), ...extra } }, undefined, { shallow: true })
  }
  const ir = (id: string, t?: string) => irA(id as Vista, t as TabConfiguracion | undefined)
  // Un link viejo (?vista=configuracion&tab=reglas) o una sección de otro modo: la URL se reescribe una vez.
  const corregir = useEffectEvent(() => irA(r.vista, r.tab))
  useEffect(() => { if (r.corregir) corregir() }, [r.corregir, r.vista, r.tab])
  const abrirReserva = (id: string | null) => {
    const { reserva: _r, ...resto } = router.query
    void _r
    void router.replace({ pathname: router.pathname, query: { ...resto, ...(id ? { reserva: id } : {}) } }, undefined, { shallow: true, scroll: false })
  }
  const abrirCliente = (id: string | null) => {
    const { cliente: _c, ...resto } = router.query
    void _c
    void router.replace({ pathname: router.pathname, query: { ...resto, ...(id ? { cliente: id } : {}) } }, undefined, { shallow: true, scroll: false })
  }
  /** Desde cualquier sección: a la agenda con esa reserva abierta. */
  const verReserva = (id: string) => irA('reservas', undefined, { reserva: id })

  // ── La barra lateral ──
  const pendientes = reservas.filter(x => x.estado === 'pendiente' && fechaDeReserva(x) >= HOY).sort((a, b) => fechaDeReserva(a).localeCompare(fechaDeReserva(b)))
  const items: ItemNav[] = secciones.map(s => ({ id: s.id, label: s.label, Icon: ICONOS[s.id], grupo: s.grupo, subs: s.subs, badge: s.id === 'reservas' && pendientes.length ? pendientes.length : undefined }))
  const nombre = (x: Reserva) => clientePorId(x.clienteId, clientes)?.nombre ?? '—'

  // ── La campanita: lo que pide atención hoy ──
  const avisos: AvisoNav[] = []
  // Lo que se reservó en la demo (desde el sitio o a mano) es la novedad de verdad: entra sin leer.
  for (const x of (n.demo.reservas[tipo] ?? []).slice(-3).reverse()) {
    avisos.push({ id: `nueva-${x.id}`, Icon: CalendarCheck, titulo: `Nueva reserva: ${nombre(x)}`, detalle: cuandoDe(negocio, x), cuando: `Hoy ${hhmm(AHORA)}`, nueva: true, onAbrir: () => verReserva(x.id) })
  }
  pendientes.slice(0, 3).forEach((x, i) => {
    avisos.push({ id: `sena-${x.id}`, Icon: Wallet, tono: 'aviso', titulo: `Seña pendiente: ${tipo === 'bloque' ? tituloEvento(x.evento) : nombre(x)}`, detalle: `${pesos(x.sena)} · ${cuandoDe(negocio, x)}`, cuando: `Reservada el ${fechaCorta(x.creada)}`, nueva: i === 0, onAbrir: () => verReserva(x.id) })
  })
  if (tipo === 'estadia') {
    const horaDe = (x: Reserva, entrada: boolean) => { const p = negocio.propiedades.find(y => y.id === x.unidadId); return hhmm(entrada ? p?.checkIn ?? 15 * 60 : p?.checkOut ?? 10 * 60) }
    for (const x of reservas.filter(x => x.estado !== 'cancelada' && x.entrada === HOY)) avisos.push({ id: `llega-${x.id}`, Icon: LogIn, tono: 'ok', titulo: `Llega hoy: ${nombre(x)}`, detalle: `${cuandoDe(negocio, x)} · ${cuenta(x.huespedes ?? 1, 'huésped', 'huéspedes')}`, cuando: `Desde las ${horaDe(x, true)}`, nueva: true, onAbrir: () => verReserva(x.id) })
    for (const x of reservas.filter(x => x.estado !== 'cancelada' && x.salida === HOY)) avisos.push({ id: `sale-${x.id}`, Icon: LogOut, titulo: `Sale hoy: ${nombre(x)}`, detalle: cuandoDe(negocio, x), cuando: `Hasta las ${horaDe(x, false)}`, onAbrir: () => verReserva(x.id) })
  } else {
    const hoy = reservasDelDia(reservas, HOY).filter(x => (x.fin ?? 0) > AHORA)
    if (hoy.length) {
      avisos.push(tipo === 'bloque'
        ? { id: 'hoy', Icon: PartyPopper, titulo: `Hoy: ${tituloEvento(hoy[0].evento)}`, detalle: `${cuenta(hoy[0].evento?.invitados ?? 0, 'invitado', 'invitados')} · a las ${hhmm(hoy[0].inicio ?? 0)}`, cuando: 'Hoy', onAbrir: () => verReserva(hoy[0].id) }
        : { id: 'hoy', Icon: CalendarDays, titulo: `Hoy quedan ${cuenta(hoy.length, 'reserva', 'reservas')}`, detalle: `La próxima a las ${hhmm(hoy[0].inicio ?? 0)} en ${unidadPorId(negocio, hoy[0].unidadId)?.nombre ?? ''}`, cuando: 'Hoy', onAbrir: () => irA('reservas') })
    }
  }
  for (const c of negocio.calendariosExternos) {
    const suyos = negocio.bloqueos.filter(b => b.origen === 'ical' && deCalendario(b, c.id)).length
    avisos.push({ id: `cal-${c.id}`, Icon: Link2, titulo: `${c.nombre}: sincronizado`, detalle: `${cuenta(suyos, 'fecha bloqueada', 'fechas bloqueadas')} en ${unidadPorId(negocio, c.unidadId)?.nombre ?? ''}`, cuando: `Hoy ${hhmm(AHORA)}`, onAbrir: () => irA('calendarios') })
  }

  // ── El buscador (Ctrl K): secciones, gente, lo de hoy y lo que se alquila ──
  const busqueda: ItemBusqueda[] = secciones.flatMap<ItemBusqueda>(s => s.subs
    ? s.subs.map(sub => ({ id: `ir-${s.id}-${sub.id}`, grupo: 'Ir a', titulo: `${s.label} › ${sub.label}`, Icon: ICONOS[s.id], onElegir: () => irA(s.id, sub.id) }))
    : [{ id: `ir-${s.id}`, grupo: 'Ir a', titulo: s.label, detalle: s.grupo, Icon: ICONOS[s.id], onElegir: () => irA(s.id) }])
  if (tipo !== 'bloque') {
    const conReserva = new Set(reservas.map(x => x.clienteId))
    for (const c of clientes.filter(c => conReserva.has(c.id))) busqueda.push({ id: `cl-${c.id}`, grupo: capital(TIPOS[tipo].clientes), titulo: c.nombre, detalle: c.telefono, Icon: Contact, onElegir: () => irA('clientes', undefined, { cliente: c.id }) })
  }
  const deHoy = tipo === 'estadia'
    ? reservas.filter(x => x.estado !== 'cancelada' && x.entrada && x.salida && x.entrada <= HOY && HOY <= x.salida)
    : tipo === 'bloque'
      ? reservas.filter(x => (x.estado === 'pendiente' || x.estado === 'confirmada') && (x.fecha ?? '') >= HOY).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '')).slice(0, 30)
      : reservasDelDia(reservas, HOY)
  for (const x of deHoy) busqueda.push({ id: `r-${x.id}`, grupo: tipo === 'estadia' ? 'En casa hoy' : tipo === 'bloque' ? 'Próximos eventos' : 'Reservas de hoy', titulo: tipo === 'bloque' ? tituloEvento(x.evento) : nombre(x), detalle: tipo === 'bloque' ? `${nombre(x)} · ${cuandoDe(negocio, x)}` : cuandoDe(negocio, x), Icon: CalendarCheck, onElegir: () => verReserva(x.id) })
  const vistaUnidades: Vista = tipo === 'cancha' ? 'unidades' : tipo === 'bloque' ? 'salon' : 'propiedades'
  for (const u of unidadesDe(negocio)) busqueda.push({ id: `u-${u.id}`, grupo: capital(TIPOS[tipo].unidades), titulo: u.nombre, detalle: u.detalle, Icon: ICONOS[vistaUnidades], onElegir: () => irA(vistaUnidades) })

  // ── Quién usa el panel: el dueño del negocio de la demo ──
  const dueno = negocio.equipo[0]
  const usuario = dueno ? { id: dueno.id, nombre: dueno.nombre, rol: rolDe(dueno), color: '#2563EB' } : undefined

  // ── Lo que escriben las secciones ──
  const onGuardar = (cambio: Partial<NegocioAlquiler>, texto?: string, detalle?: string) => { n.configurar(tipo, cambio); avisar(texto ?? 'Cambios guardados', detalle) }
  const cambiar = (id: string, cambio: Partial<Reserva>, texto?: string) => { n.cambiarReserva(id, cambio); if (texto) avisar(texto) }
  const bloquear = (b: Bloqueo) => { n.agregarBloqueo(tipo, b); avisar(tipo === 'estadia' ? 'Fechas bloqueadas' : 'Día bloqueado', tipo === 'estadia' ? 'No se van a poder reservar.' : 'No se va a poder reservar.') }
  const quitarBloqueo = (id: string) => { n.quitarBloqueo(tipo, id); avisar('Bloqueo quitado') }

  return (
    <LayoutPanel producto="Alquileres" negocio={negocio.nombre} rubro={rubroPorKey(negocio.rubro).label} fecha={FECHA} items={items} activo={vista} tab={tab} onIr={ir} sitio={ruta('inicio', tipo)}
      avisos={avisos} busqueda={busqueda} buscar="Buscar clientes, reservas o secciones" usuario={usuario}>
      <EstiloPanelAlquileres />
      {vista === 'reservas' && <Reservas key={k} negocio={negocio} reservas={reservas} clientes={clientes} reservaAbierta={reservaAbierta} onAbrirReserva={abrirReserva} onCambiar={cambiar} onReservar={(x, c) => { n.reservar(tipo, x, c); avisar('Reserva agendada', 'Ya figura en la agenda y en Mis reservas.') }} onBloqueo={bloquear} onQuitarBloqueo={quitarBloqueo} />}
      {vista === 'eventos' && <Eventos key={k} negocio={negocio} reservas={reservas} clientes={clientes} abierta={reservaAbierta} onAbrir={abrirReserva} onCambiar={cambiar} />}
      {vista === 'clientes' && <Clientes key={k} negocio={negocio} reservas={reservas} clientes={clientes} abierto={clienteAbierto} onAbrir={abrirCliente} />}
      {vista === 'ingresos' && <Ingresos key={k} negocio={negocio} reservas={reservas} clientes={clientes} onAbrirReserva={verReserva} />}
      {vista === 'unidades' && <Canchas key={k} negocio={negocio} reservas={reservas} onGuardar={onGuardar} />}
      {vista === 'extras' && <Extras key={k} negocio={negocio} reservas={reservas} onGuardar={onGuardar} />}
      {vista === 'precios' && <Precios key={k} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'salon' && <Salon key={k} negocio={negocio} onGuardar={onGuardar} onIr={irA} />}
      {vista === 'paquetes' && <Paquetes key={k} negocio={negocio} reservas={reservas} onGuardar={onGuardar} />}
      {vista === 'propiedades' && <Propiedades key={k} negocio={negocio} onGuardar={onGuardar} onIr={irA} />}
      {vista === 'temporadas' && <Temporadas key={k} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'reglas' && <Reglas key={k} negocio={negocio} onGuardar={onGuardar} onIr={irA} />}
      {vista === 'bloqueos' && <Bloqueos key={k} negocio={negocio} reservas={reservas} onBloqueo={bloquear} onQuitarBloqueo={quitarBloqueo} onIr={irA} />}
      {vista === 'mensajes' && <Mensajes key={k} negocio={negocio} reservas={reservas} clientes={clientes} onGuardar={onGuardar} onAviso={avisar} />}
      {vista === 'pagos' && <Pagos key={k} negocio={negocio} onGuardar={onGuardar} onIr={irA} />}
      {vista === 'calendarios' && <Calendarios key={k} negocio={negocio} reservas={reservas} onCalendario={(c, b) => { n.agregarCalendario(tipo, c, b); avisar('Calendario conectado', `${b.length} ${b.length === 1 ? 'fecha bloqueada' : 'fechas bloqueadas'}. Demo: sincronización simulada.`) }} onQuitarCalendario={id => { n.quitarCalendario(tipo, id); avisar('Calendario desconectado') }} />}
      {vista === 'configuracion' && tab === 'negocio' && <Negocio key={k} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'configuracion' && tab === 'horarios' && <Horarios key={k} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'configuracion' && tab === 'equipo' && <Equipo key={k} negocio={negocio} onGuardar={onGuardar} />}
      {aviso}
    </LayoutPanel>
  )
}
