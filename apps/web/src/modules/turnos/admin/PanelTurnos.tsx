// Panel del negocio de Turnos (demo): arma el menú según el rubro y cambia de
// pantalla con ?vista=, igual que las sub-vistas del panel de Tienda.
//
// Acá vive todo lo que se puede tocar en la demo (turnos, clientes, servicios,
// equipo, roles, pagos, clases): son copias en memoria de los datos de ejemplo,
// así lo que se agrega en una pantalla aparece en las otras. No hay backend: al
// recargar, o al cambiar de rubro, vuelve todo a como estaba.
//
// El horario es uno solo para todo el panel: el del negocio (semanaDe) y,
// adentro, los días y las horas de cada agenda. De ahí salen la grilla de la
// agenda, los horarios libres, los huecos y la ocupación.
//
// "Ver el panel como…" muestra este mismo panel con los ojos de alguien del
// equipo: el menú, la agenda, los clientes y las ganancias se recortan a lo que
// su rol le permite. Es la forma de ver, sin cuentas de verdad, que cada
// persona tiene su propio panel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { LayoutDashboard, CalendarDays, CalendarRange, Users, Contact, Settings, Sparkles, BellRing, UserX, Ban, CalendarClock, HandCoins, LayoutGrid, Eye } from 'lucide-react'
import { Toast } from '@/design-system/components/Toast'
import { temaDe } from '@/modules/turnos/storefront/tema'
import LayoutTurnos, { type ItemNav, type AvisoNav, type ItemBusqueda } from '@/modules/turnos/layout/LayoutTurnos'
import { useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import { ESTADO_TURNO, recursosDe, clientesDe, clasesDe, semanaDe, tramosDeRecurso, esSalud, horaTxt, duracionTxt, pesos, type EstadoTurno, type Turno, type Cliente, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO, HOY_SEMANA, extremos, tramosDelDia, type Tramo } from '@/modules/turnos/horario'
import ResumenDia from './KPIs'
import Agenda from './Agenda'
import DetalleTurno from './Turnos'
import Servicios from './Servicios'
import Equipo, { CSS_EQUIPO } from './Equipo'
import Espacios, { CSS_ESPACIOS, espaciosTxt } from './Espacios'
import Ganancias, { CSS_GANANCIAS } from './Ganancias'
import { CSS_ROLES } from './Roles'
import { CSS_PAGO } from './PagoPersona'
import Clientes, { pluralCliente } from './Clientes'
import Clases from './Clases'
import NuevoTurno from './NuevoTurno'
import ConfiguracionTurnos from './configuracion/ConfiguracionTurnos'
import AvanzadoTurnos from './avanzado/AvanzadoTurnos'
import { CSS_UI_CONFIG } from './configuracion/ui'
import { subdominioDe } from './configuracion/datos'
import { CSS_PIEZAS_PANEL, MensajeWhatsApp } from './piezasPanel'
import { cuandoTxt, fechaLarga, indiceDia, libresPorTramo, tieneTelefono, turnosDelDia, type ClasePanel, type MensajeWA, type NuevoTurnoPre, type ServicioPanel, type TurnoAgenda } from './agendaDemo'
import { clientesDeLaAgenda, pagadoHastaInicial, personasDe, plata, puedeDe, rolesDe, taparTelefono, type Pago, type Persona, type Rol, type VerComo } from './equipoDemo'

const CSS_PANEL = CSS_UI_CONFIG + CSS_PIEZAS_PANEL + CSS_ESPACIOS + CSS_EQUIPO + CSS_ROLES + CSS_PAGO + CSS_GANANCIAS + `
  .tu-toast { position: fixed; right: 16px; bottom: 16px; left: auto; z-index: 400; max-width: calc(100vw - 32px); animation: tuToastIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes tuToastIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
  @media (max-width: 768px) { .tu-toast { left: 16px; } }
  /* Con un modal abierto el aviso sube: abajo taparía los botones del modal. */
  .tu-shell:has(.tuo-modal) .tu-toast { top: calc(var(--tuo-tope, 0px) + 14px); bottom: auto; }
  /* La franja de "estás viendo el panel de otra persona". */
  .tu-como { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0; padding: 8px 16px; font-size: 13px; line-height: 1.4; color: var(--chip-primary-fg); background: var(--color-primary-bg); border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 26%, transparent); animation: tuoEntra 320ms var(--tuo-ease, ease) both; }
  .tu-como > svg { flex-shrink: 0; }
  .tu-como > span { flex: 1; min-width: 200px; }
  .tu-como b { font-weight: 600; }
  @media (max-width: 768px) { .tu-como .tuo-btn { height: 40px; } }
  @media (prefers-reduced-motion: reduce) { .tu-toast, .tu-como { animation: none; } }
`

type Agenda = { atiende: number[]; horario: string; dias: string }

export default function PanelTurnos() {
  const [rubro] = useRubroDemo()
  // key: cada rubro arranca con sus propios datos de ejemplo, sin arrastrar lo
  // que se cargó en otro. Y si para este rubro se hizo el alta, el panel se arma
  // de nuevo con ese negocio (nombre, servicios, horarios) en lugar del de muestra.
  return <PanelDeRubro key={rubro.alta ? `${rubro.key}:alta` : rubro.key} rubro={rubro} />
}

function PanelDeRubro({ rubro }: { rubro: RubroTurnos }) {
  const router = useRouter()
  // Mismo nombre que muestra el sitio público de ese rubro.
  const negocio = temaDe(rubro).nombre
  // El horario del negocio. Cambia solo si se guarda otro en Configuración → Horarios.
  const semana = useMemo(() => semanaDe(rubro), [rubro])

  const [recursos, setRecursos] = useState<Recurso[]>(() => {
    const base = recursosDe(rubro)
    if (rubro.modo !== 'profesional') return base
    // Cada agenda es de una persona: debajo del nombre va su rol (Aprendiz, Colorista…).
    const equipo = personasDe(rubro, base, '')
    const deFabrica = rolesDe(rubro)
    return base.map(r => {
      const rol = deFabrica.find(x => x.id === equipo.find(p => p.recursoId === r.id)?.rolId)
      return rol && !rol.fijo ? { ...r, rol: rol.nombre } : r
    })
  })
  const [clientes, setClientes] = useState<Cliente[]>(() => clientesDe(rubro))
  const [clases, setClases] = useState<ClasePanel[]>(() => clasesDe(rubro))
  const [servicios, setServicios] = useState<ServicioPanel[]>(() => rubro.servicios.map((s, i) => ({ ...s, id: `s${i + 1}`, online: i !== 3 })))
  const [roles, setRoles] = useState<Rol[]>(() => rolesDe(rubro))
  const [personas, setPersonas] = useState<Persona[]>(() => personasDe(rubro, recursosDe(rubro), `${subdominioDe(temaDe(rubro).nombre)}.com.ar`))
  // Hasta qué día se le pagó a cada uno (los que no figuran: el último cierre según cada cuánto cobran).
  const [pagadoHasta, setPagadoHasta] = useState<Record<string, number>>({})
  const [cambios, setCambios] = useState<Record<string, Partial<Turno>>>({})
  const [agregados, setAgregados] = useState<TurnoAgenda[]>([])
  // Turnos de ejemplo que se movieron a otro día: en el suyo ya no van.
  const [ocultos, setOcultos] = useState<string[]>([])
  // Como quién se está mirando el panel. null = el dueño, con todo.
  const [como, setComo] = useState<VerComo | null>(null)

  // Los turnos de cada día (0 = hoy): los de ejemplo, más los agendados acá, con
  // sus cambios. Se arman una vez para dos meses para atrás y dos para adelante:
  // la agenda del mes y las ganancias miran muchos días a la vez.
  const porDia = useMemo(() => {
    const armar = (dia: number): TurnoAgenda[] => [...turnosDelDia(rubro, recursos, semana, dia), ...agregados.filter(t => t.dia === dia)]
      .filter(t => !ocultos.includes(t.id) && recursos.some(r => r.id === t.recursoId))
      .map(t => ({ ...t, ...cambios[t.id] }))
    const dias = new Map<number, TurnoAgenda[]>()
    for (let d = -62; d <= 62; d++) dias.set(d, armar(d))
    return { dias, armar }
  }, [rubro, recursos, semana, agregados, ocultos, cambios])
  const delDia = (dia: number): TurnoAgenda[] => porDia.dias.get(dia) ?? porDia.armar(dia)
  /** En qué tramos atiende una agenda un día (contado desde hoy). */
  const jornada = (recursoId: string, dia: number): Tramo[] => {
    const r = recursos.find(x => x.id === recursoId)
    return r ? tramosDeRecurso(r, semana, indiceDia(dia)) : []
  }
  const tramosHoy = tramosDelDia(semana, HOY_SEMANA)
  const rangoHoy: Tramo = tramosHoy.length ? [tramosHoy[0][0], tramosHoy[tramosHoy.length - 1][1]] : extremos(semana)

  // ── Quién mira ──
  const rolDe = (id: string) => roles.find(r => r.id === id)
  const puede = puedeDe(como, roles)
  const rolComo = como ? rolDe(como.rolId) ?? null : null
  const yo = como?.personaId ? personas.find(p => p.id === como.personaId) ?? null : null
  // Lo "propio" de quien mira: su agenda. Un rol sin nadie adentro se mira con la primera agenda, de muestra.
  const miRecurso = !como ? undefined : yo ? yo.recursoId : rolComo?.atiende ? recursos[0]?.id : undefined
  const soloMiAgenda = puede('agenda.ver') === 'propio'
  const recursosVista = puede('agenda.ver') === 'no' ? [] : soloMiAgenda ? recursos.filter(r => r.id === miRecurso) : recursos
  const delDiaVista = (dia: number): TurnoAgenda[] => (puede('agenda.ver') === 'no' ? [] : soloMiAgenda ? delDia(dia).filter(t => t.recursoId === miRecurso) : delDia(dia))
  const turnos = delDiaVista(0)
  const editaTurno = (t: Turno) => puede('agenda.editar') === 'todo' || (puede('agenda.editar') === 'propio' && t.recursoId === miRecurso)
  const puedeAgendar = puede('agenda.editar') !== 'no'
  const recursosAgendables = puede('agenda.editar') === 'propio' ? recursos.filter(r => r.id === miRecurso) : recursosVista
  const verContacto = puede('clientes.contacto') !== 'no'
  const verNumeros = puede('reportes.ver') !== 'no'
  const clientesVista = puede('clientes.ver') === 'todo' ? clientes
    : puede('clientes.ver') === 'propio' ? clientes.filter(c => clientesDeLaAgenda(miRecurso, delDia).has(c.id)) : []
  const telefonoDe = (c: Cliente) => (verContacto ? c.telefono : taparTelefono(c.telefono))

  const [abiertoEn, setAbiertoEn] = useState<{ id: string; dia: number } | null>(null)
  const abierto = abiertoEn ? delDia(abiertoEn.dia).find(t => t.id === abiertoEn.id) ?? null : null
  const [clienteSel, setClienteSel] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<NuevoTurnoPre | null>(null)
  const [mensaje, setMensaje] = useState<MensajeWA | null>(null)

  // Aviso de la pantalla: confirma cada acción (nada se guarda, es la demo).
  const [toast, setToast] = useState<{ id: number; titulo: string; descripcion?: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Numerador para lo que se crea en la demo (avisos, turnos, clientes). Arranca alto para no pisar los ids de ejemplo.
  const serie = useRef(1000)
  const avisar = (titulo: string, descripcion?: string) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: ++serie.current, titulo, descripcion })
    timer.current = setTimeout(() => setToast(null), 3200)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const pendientes = turnos.filter(t => t.estado === 'pendiente').length
  const conEspacios = rubro.modo !== 'profesional'
  // El menú, según lo que puede quien mira. El dueño lo ve entero.
  const negocioTxt = !como || puede('config.editar') !== 'no' ? 'Tu negocio' : puede('equipo.editar') !== 'no' || puede('clientes.ver') === 'todo' ? 'El negocio' : 'Lo tuyo'
  const items: ItemNav[] = [
    { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard, grupo: 'Día a día' },
    ...(puede('agenda.ver') !== 'no' ? [{ id: 'agenda', label: rubro.modo === 'cancha' ? 'Reservas' : soloMiAgenda ? 'Mi agenda' : 'Agenda', Icon: CalendarDays, badge: pendientes || undefined, grupo: 'Día a día' }] : []),
    ...(rubro.modo === 'cupo' && puede('agenda.ver') !== 'no' ? [{ id: 'clases', label: 'Clases', Icon: CalendarRange, grupo: 'Día a día' }] : []),
    ...(puede('servicios.editar') !== 'no' ? [{ id: 'servicios', label: rubro.modo === 'cupo' ? 'Actividades' : 'Servicios', Icon: rubro.Icon, grupo: negocioTxt }] : []),
    ...(puede('equipo.editar') !== 'no' ? [{ id: 'equipo', label: 'Equipo', Icon: Users, grupo: negocioTxt }] : []),
    ...(conEspacios && puede('equipo.editar') !== 'no' ? [{ id: 'espacios', label: espaciosTxt(rubro), Icon: LayoutGrid, grupo: negocioTxt }] : []),
    ...(puede('clientes.ver') !== 'no' ? [{ id: 'clientes', label: puede('clientes.ver') === 'propio' ? `Mis ${pluralCliente(rubro).toLowerCase()}` : pluralCliente(rubro), Icon: Contact, grupo: negocioTxt }] : []),
    ...(puede('ganancias.ver') !== 'no' ? [{ id: 'ganancias', label: puede('ganancias.ver') === 'propio' ? 'Mis ganancias' : 'Ganancias', Icon: HandCoins, grupo: negocioTxt }] : []),
    ...(puede('config.editar') !== 'no' ? [
      { id: 'configuracion', label: 'Configuración', Icon: Settings, grupo: 'Ajustes' },
      { id: 'avanzado', label: 'Avanzado', Icon: Sparkles, grupo: 'Ajustes' },
    ] : []),
  ]
  // Una vista que este rubro o este rol no tiene (?vista=clases en una barbería) cae en el resumen.
  const pedida = typeof router.query.vista === 'string' ? router.query.vista : 'resumen'
  const vista = items.some(i => i.id === pedida) ? pedida : 'resumen'

  const ir = (v: string) => {
    setClienteSel(null)
    void router.replace({ pathname: router.pathname, query: { ...router.query, vista: v } }, undefined, { shallow: true })
  }
  const nombreDe = (id: string) => clientes.find(c => c.id === id)?.nombre ?? '—'
  const pila = (id: string) => nombreDe(id).split(' ')[0]
  const abrir = (t: TurnoAgenda) => setAbiertoEn({ id: t.id, dia: t.dia ?? 0 })
  const agendar = (pre: NuevoTurnoPre = {}) => { setAbiertoEn(null); setClienteSel(null); setNuevo(pre) }

  // ── Turnos ──
  const cambiarEstado = (id: string, estado: EstadoTurno) => {
    setCambios(c => ({ ...c, [id]: { ...c[id], estado } }))
    const quien = abierto ? pila(abierto.clienteId) : ''
    if (estado === 'confirmado') avisar('Turno confirmado', quien ? `Le avisamos a ${quien}.` : undefined)
    else if (estado === 'completado') avisar('Turno atendido', 'Quedó en el historial.')
    else if (estado === 'ausente') avisar('Marcado como ausente', quien ? `Queda anotado en la ficha de ${quien}.` : undefined)
    else if (estado === 'cancelado') avisar('Turno cancelado', 'El horario volvió a quedar libre.')
  }
  /** Mover un turno: a otro horario del mismo día, o a otro día (ahí deja el suyo y aparece en el nuevo). */
  const moverTurno = (t: TurnoAgenda, aDia: number, inicio: number) => {
    const quien = pila(t.clienteId)
    if (aDia === (t.dia ?? 0)) {
      setCambios(c => ({ ...c, [t.id]: { ...c[t.id], inicio, estado: 'confirmado' } }))
      avisar('Turno reprogramado', `Pasó a las ${horaTxt(inicio)}. Le avisamos a ${quien}.`)
      return
    }
    const id = `n${++serie.current}`
    setOcultos(o => [...o, t.id])
    setAgregados(a => [...a.filter(x => x.id !== t.id), { ...t, id, dia: aDia, inicio, estado: 'confirmado' }])
    setAbiertoEn({ id, dia: aDia })
    avisar('Turno reprogramado', `Pasó ${aDia === 0 ? 'a hoy' : aDia === 1 ? 'a mañana' : `al ${fechaLarga(aDia).toLowerCase()}`}, ${horaTxt(inicio)}. Le avisamos a ${quien}.`)
  }
  const registrarSena = (t: TurnoAgenda) => {
    setCambios(c => ({ ...c, [t.id]: { ...c[t.id], senaPagada: true } }))
    avisar('Seña registrada', `${pesos(Math.round(t.precio * rubro.sena / 100))} de ${nombreDe(t.clienteId)}`)
  }
  const crearTurno = (t: Omit<TurnoAgenda, 'id'>, clienteNuevo?: { nombre: string; telefono: string }) => {
    const sello = ++serie.current
    const clienteId = clienteNuevo ? `c${sello}` : t.clienteId
    if (clienteNuevo) {
      setClientes(cs => [...cs, { id: clienteId, nombre: clienteNuevo.nombre, telefono: clienteNuevo.telefono || 'Sin teléfono', visitas: 0, ultima: '—', gastado: 0, ...(esSalud(rubro) ? { obraSocial: 'Particular' } : {}) }])
    }
    setAgregados(a => [...a, { ...t, id: `n${sello}`, clienteId }])
    setNuevo(null)
    avisar('Turno agendado', `${clienteNuevo?.nombre ?? nombreDe(clienteId)} · ${cuandoTxt(t.dia ?? 0)} a las ${horaTxt(t.inicio)}`)
  }
  // WhatsApp a un cliente: el texto sale del estado del turno. El envío es
  // simulado (MensajeWhatsApp): la demo nunca le escribe a un teléfono.
  const escribirPorTurno = (t: TurnoAgenda) => {
    const c = clientes.find(x => x.id === t.clienteId)
    if (!c) return
    const pila = c.nombre.split(' ')[0]
    const d = t.dia ?? 0
    const cuando = `${d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : `el ${fechaLarga(d).toLowerCase()}`} a las ${horaTxt(t.inicio)}`
    const reservar = `${window.location.origin}/turnos-demo/reserva?rubro=${encodeURIComponent(rubro.key)}`
    const textos: Record<EstadoTurno, string> = {
      pendiente: `¡Hola ${pila}! Te escribimos de ${negocio}. Tenés un turno de ${t.servicio} ${cuando}. ¿Nos confirmás que venís?`,
      confirmado: `¡Hola ${pila}! Te recordamos tu turno de ${t.servicio} ${cuando} en ${negocio}. Si no podés venir, avisanos así le damos el lugar a otra persona.`,
      'en-curso': `¡Hola ${pila}! Te escribimos de ${negocio} por tu turno de ${t.servicio} de ${cuando}.`,
      completado: `¡Hola ${pila}! Gracias por venir a ${negocio}. Cuando quieras tu próximo turno, lo reservás acá: ${reservar}`,
      ausente: `¡Hola ${pila}! Te esperábamos ${cuando} para tu turno de ${t.servicio}. ¿Querés que te busquemos otro horario?`,
      cancelado: `¡Hola ${pila}! Tu turno de ${t.servicio} de ${cuando} quedó cancelado. Si querés otro horario, lo reservás acá: ${reservar}`,
    }
    setMensaje({ titulo: `Escribirle a ${pila}`, para: c.nombre, telefono: tieneTelefono(c.telefono) ? c.telefono : undefined, texto: textos[t.estado] })
  }
  const escribirACliente = (c: Cliente) => setMensaje({
    titulo: `Escribirle a ${c.nombre.split(' ')[0]}`, para: c.nombre, telefono: tieneTelefono(c.telefono) ? c.telefono : undefined,
    texto: `¡Hola ${c.nombre.split(' ')[0]}! Te escribimos de ${negocio}. `,
  })
  /** El próximo turno de alguien, de ahora en adelante (mira las próximas tres semanas). */
  const proximoDe = (clienteId: string): TurnoAgenda | null => {
    for (let d = 0; d <= 21; d++) {
      const t = delDiaVista(d)
        .filter(x => x.clienteId === clienteId && (x.estado === 'confirmado' || x.estado === 'pendiente') && (d > 0 || x.inicio > AHORA_DEMO))
        .sort((a, b) => a.inicio - b.inicio)[0]
      if (t) return t
    }
    return null
  }

  // ── Altas, cambios y bajas de lo demás ──
  const guardar = <T extends { id: string }>(lista: T[], item: T) => (lista.some(x => x.id === item.id) ? lista.map(x => (x.id === item.id ? item : x)) : [...lista, item])
  const guardarServicio = (s: ServicioPanel, silencio?: boolean) => {
    const era = servicios.some(x => x.id === s.id)
    setServicios(l => guardar(l, s))
    if (!silencio) avisar(era ? 'Cambios guardados' : rubro.modo === 'cupo' ? 'Actividad creada' : 'Servicio creado', `${s.nombre} · ${duracionTxt(s.duracion)}`)
  }
  const borrarServicio = (id: string) => {
    const s = servicios.find(x => x.id === id)
    setServicios(l => l.filter(x => x.id !== id))
    avisar(rubro.modo === 'cupo' ? 'Actividad eliminada' : 'Servicio eliminado', s?.nombre)
  }
  const guardarRecurso = (r: Recurso) => {
    const era = recursos.some(x => x.id === r.id)
    setRecursos(l => guardar(l, r))
    avisar(era ? 'Cambios guardados' : 'Agregado a la agenda', `${r.nombre} · ${r.dias}${r.horario ? `, ${r.horario}` : ''}`)
  }
  const borrarRecurso = (id: string) => {
    const r = recursos.find(x => x.id === id)
    setRecursos(l => l.filter(x => x.id !== id))
    // Quien atendía ahí se queda sin espacio fijo.
    setPersonas(l => l.map(p => (p.recursoId === id ? { id: p.id, nombre: p.nombre, rolId: p.rolId, email: p.email, telefono: p.telefono, color: p.color, pago: p.pago, ...(p.pendiente ? { pendiente: true } : {}) } : p)))
    avisar('Eliminado de la agenda', r?.nombre)
  }
  const guardarClase = (c: ClasePanel, aviso?: string) => {
    const era = clases.some(x => x.id === c.id)
    setClases(l => guardar(l, c))
    avisar(aviso ?? (era ? 'Cambios guardados' : 'Clase creada'), `${c.nombre} · ${horaTxt(c.inicio)}`)
  }
  const borrarClase = (id: string) => {
    const c = clases.find(x => x.id === id)
    setClases(l => l.filter(x => x.id !== id))
    avisar('Clase eliminada', c ? `${c.nombre} · ${horaTxt(c.inicio)}` : undefined)
  }
  const agregarCliente = (c: Cliente) => {
    setClientes(l => [...l, c])
    avisar(`Agregado a tus ${pluralCliente(rubro).toLowerCase()}`, c.nombre)
  }

  // ── Equipo: personas, roles y pagos ──
  // En los rubros por profesional, quien atiende ES una agenda: guardar a la
  // persona guarda también su columna (nombre, color, días y horario).
  const guardarPersona = (p: Persona, agenda: Agenda | null) => {
    const era = personas.some(x => x.id === p.id)
    let persona = p
    if (rubro.modo === 'profesional') {
      if (agenda) {
        const id = p.recursoId ?? `r${++serie.current}`
        const rol = rolDe(p.rolId)
        // El dueño figura en la agenda con su oficio (Barbero), no con "Dueño/a".
        setRecursos(l => guardar(l, { id, nombre: p.nombre, rol: rol && !rol.fijo ? rol.nombre : rubro.profesional, color: p.color, ...agenda }))
        persona = { ...p, recursoId: id }
      } else if (p.recursoId) {
        const sinAgenda = p.recursoId
        setRecursos(l => l.filter(x => x.id !== sinAgenda))
        persona = { id: p.id, nombre: p.nombre, rolId: p.rolId, email: p.email, telefono: p.telefono, color: p.color, pago: p.pago, ...(p.pendiente ? { pendiente: true } : {}) }
      }
    }
    setPersonas(l => guardar(l, persona))
    avisar(era ? 'Cambios guardados' : 'Sumado al equipo', era ? p.nombre : `${p.nombre} · ${rolDe(p.rolId)?.nombre ?? ''}${p.email ? '. Demo: no se mandó ninguna invitación.' : ''}`)
  }
  const borrarPersona = (id: string) => {
    const p = personas.find(x => x.id === id)
    setPersonas(l => l.filter(x => x.id !== id))
    if (rubro.modo === 'profesional' && p?.recursoId) setRecursos(l => l.filter(x => x.id !== p.recursoId))
    avisar('Ya no está en el equipo', p?.nombre)
  }
  const guardarRol = (r: Rol) => {
    const era = roles.some(x => x.id === r.id)
    setRoles(l => guardar(l, r))
    // El nombre del rol es lo que se lee debajo de cada agenda.
    if (rubro.modo === 'profesional') setRecursos(l => l.map(x => (personas.some(p => p.recursoId === x.id && p.rolId === r.id) ? { ...x, rol: r.nombre } : x)))
    avisar(era ? 'Rol actualizado' : 'Rol creado', era ? `${r.nombre}: vale para todos los que lo tienen.` : `${r.nombre}: ya se lo podés dar a alguien del equipo.`)
  }
  const borrarRol = (id: string) => {
    const r = rolDe(id)
    setRoles(l => l.filter(x => x.id !== id))
    if (como?.rolId === id) setComo(null)
    avisar('Rol eliminado', r?.nombre)
  }
  const guardarPago = (personaId: string, pago: Pago) => {
    setPersonas(l => l.map(p => (p.id === personaId ? { ...p, pago } : p)))
    avisar('Forma de pago actualizada', personas.find(p => p.id === personaId)?.nombre)
  }
  const registrarPago = (personaId: string, monto: number) => {
    const p = personas.find(x => x.id === personaId)
    setPagadoHasta(m => ({ ...m, [personaId]: 0 }))
    avisar(p?.pago?.forma === 'alquiler' ? 'Cobro registrado' : 'Pago registrado', `${plata(monto)} · ${p?.nombre ?? ''}. Queda al día hasta hoy.`)
  }

  // ── Ver el panel como alguien del equipo ──
  const verComo = (c: VerComo) => {
    const p = c.personaId ? personas.find(x => x.id === c.personaId) : null
    setComo(c)
    setAbiertoEn(null); setNuevo(null); setMensaje(null)
    ir('resumen')
    avisar(p ? `Así ve el panel ${p.nombre.split(' ')[0]}` : `Así se ve con el rol ${rolDe(c.rolId)?.nombre ?? ''}`, 'Volvés a tu panel desde la franja de arriba.')
  }
  const volverAMiPanel = () => {
    setComo(null)
    setAbiertoEn(null); setNuevo(null); setMensaje(null)
    avisar('Volviste a tu panel')
  }
  const dueno = personas.find(p => rolDe(p.rolId)?.fijo)
  const usuario = como
    ? { id: yo?.id ?? 'rol', nombre: yo?.nombre ?? `Rol ${rolComo?.nombre ?? ''}`, rol: rolComo?.nombre ?? '', color: yo?.color ?? '#3B82F6' }
    : { id: dueno?.id ?? 'dueno', nombre: dueno?.nombre ?? negocio, rol: rolDe(dueno?.rolId ?? 'dueno')?.nombre ?? 'Dueño/a', color: dueno?.color ?? '#3B82F6' }
  const cuentas = personas.filter(p => !rolDe(p.rolId)?.fijo).map(p => ({ id: p.id, nombre: p.nombre, rol: rolDe(p.rolId)?.nombre ?? 'Sin rol', color: p.color }))

  // ── Campanita y buscador del header ──
  const avisos: AvisoNav[] = [
    ...turnos.filter(t => t.estado === 'pendiente').map(t => ({ id: `p-${t.id}`, Icon: BellRing, tono: 'aviso' as const, titulo: `${nombreDe(t.clienteId)} todavía no confirmó`, detalle: `${horaTxt(t.inicio)} · ${t.servicio}`, cuando: 'Hoy', nueva: true, onAbrir: () => abrir(t) })),
    ...agregados.filter(t => !ocultos.includes(t.id) && recursosVista.some(r => r.id === t.recursoId)).map(t => ({ id: `n-${t.id}`, Icon: CalendarClock, tono: 'primario' as const, titulo: `Turno nuevo de ${nombreDe(t.clienteId)}`, detalle: `${horaTxt(t.inicio)} · ${t.servicio}`, cuando: cuandoTxt(t.dia ?? 0), onAbrir: () => abrir(t) })),
    ...turnos.filter(t => t.estado === 'ausente').map(t => ({ id: `a-${t.id}`, Icon: UserX, tono: 'error' as const, titulo: `${nombreDe(t.clienteId)} no vino a su turno`, detalle: `${horaTxt(t.inicio)} · ${t.servicio}`, cuando: 'Hoy', onAbrir: () => abrir(t) })),
    ...turnos.filter(t => t.estado === 'cancelado').map(t => ({ id: `c-${t.id}`, Icon: Ban, tono: 'primario' as const, titulo: `Se canceló el turno de ${nombreDe(t.clienteId)}`, detalle: `${horaTxt(t.inicio)} · quedó libre`, cuando: 'Hoy', onAbrir: () => abrir(t) })),
  ]
  const veSeccion = (id: string) => items.some(i => i.id === id)
  const busqueda: ItemBusqueda[] = [
    ...items.map(i => ({ id: `ir-${i.id}`, grupo: 'Ir a', titulo: i.label, detalle: i.grupo, Icon: i.Icon, onElegir: () => ir(i.id) })),
    ...turnos.map(t => ({ id: `t-${t.id}`, grupo: 'Turnos de hoy', titulo: `${horaTxt(t.inicio)} · ${nombreDe(t.clienteId)}`, detalle: `${t.servicio} · ${recursos.find(r => r.id === t.recursoId)?.nombre ?? ''} · ${ESTADO_TURNO[t.estado].label}`, Icon: CalendarDays, onElegir: () => abrir(t) })),
    ...(veSeccion('clientes') ? clientesVista.map(c => ({ id: `c-${c.id}`, grupo: pluralCliente(rubro), titulo: c.nombre, detalle: `${telefonoDe(c)} · ${c.visitas} visita${c.visitas === 1 ? '' : 's'}`, Icon: Contact, onElegir: () => { ir('clientes'); setClienteSel(c.id) } })) : []),
    ...(veSeccion('servicios') ? servicios.map(s => ({ id: `s-${s.id}`, grupo: rubro.modo === 'cupo' ? 'Actividades' : 'Servicios', titulo: s.nombre, detalle: duracionTxt(s.duracion), Icon: rubro.Icon, onElegir: () => ir('servicios') })) : []),
    ...(veSeccion('equipo') ? personas.map(p => ({ id: `e-${p.id}`, grupo: 'Equipo', titulo: p.nombre, detalle: rolDe(p.rolId)?.nombre, Icon: Users, onElegir: () => ir('equipo') })) : []),
  ]

  // Mover el turno abierto: los próximos días de su agenda y lo que tiene libre cada uno.
  const diasMover = abierto ? Array.from({ length: 14 }, (_, d) => ({ dia: d, cerrado: jornada(abierto.recursoId, d).length === 0 })) : []
  const libresMover = (d: number) => {
    if (!abierto) return []
    return libresPorTramo(delDia(d), jornada(abierto.recursoId, d), abierto.recursoId, abierto.duracion, d, abierto.id)
      .map(g => ({ ...g, libres: g.libres.filter(m => !(d === (abierto.dia ?? 0) && m === abierto.inicio)) }))
  }

  return (
    <LayoutTurnos
      negocio={negocio}
      rubro={rubro.label}
      fecha="Sáb 26 sep · 10:40"
      items={items}
      activo={vista}
      onIr={ir}
      reservas={`/turnos-demo/negocio?rubro=${encodeURIComponent(rubro.key)}`}
      avisos={avisos}
      busqueda={busqueda}
      usuario={usuario}
      cuentas={cuentas}
      viendoComo={como ? usuario.id : null}
      onCuenta={id => { const p = id ? personas.find(x => x.id === id) : null; if (p) verComo({ rolId: p.rolId, personaId: p.id }); else volverAMiPanel() }}
      franja={como && (
        <div className="tu-como" role="status">
          <Eye size={15} aria-hidden />
          <span>Estás viendo el panel como <b>{usuario.nombre}</b>{yo ? <> · {usuario.rol}</> : null}. Ve solo lo que su rol le permite.</span>
          <button type="button" className="tuo-btn tuo-btn--sm" onClick={volverAMiPanel}>Volver a mi panel</button>
        </div>
      )}
    >
      <style>{CSS_PANEL}</style>

      {vista === 'resumen' && (
        <ResumenDia
          negocio={negocio} saludo={como ? (yo?.nombre.split(' ')[0] ?? rolComo?.nombre ?? negocio) : negocio} rubro={rubro} turnos={turnos} clientes={clientes} recursos={recursosVista}
          jornada={id => jornada(id, 0)} rango={rangoHoy} puedeAgendar={puedeAgendar} verNumeros={verNumeros}
          onAbrir={abrir} onIr={ir} onNuevo={agendar} onCompartir={setMensaje}
        />
      )}
      {vista === 'agenda' && <Agenda rubro={rubro} semana={semana} recursos={recursosVista} turnosDelDia={delDiaVista} jornada={jornada} clientes={clientes} puedeAgendar={puedeAgendar} onAbrir={abrir} onNuevo={agendar} />}
      {vista === 'clases' && (
        <Clases
          rubro={rubro} clases={clases} actividades={servicios.map(s => s.nombre)} salas={recursos.map(r => r.nombre)} alumnos={clientes.map(c => c.nombre)}
          profes={personas.filter(p => rolDe(p.rolId)?.atiende).map(p => p.nombre.split(' ')[0])} onGuardar={guardarClase} onBorrar={borrarClase}
        />
      )}
      {vista === 'servicios' && <Servicios rubro={rubro} recursos={recursos} servicios={servicios} onGuardar={guardarServicio} onBorrar={borrarServicio} />}
      {vista === 'equipo' && (
        <Equipo
          rubro={rubro} semana={semana} personas={personas} roles={roles} recursos={recursos} turnos={delDia(0)} jornada={id => jornada(id, 0)} rango={rangoHoy}
          onGuardar={guardarPersona} onBorrar={borrarPersona} onGuardarRol={guardarRol} onBorrarRol={borrarRol} onVerComo={verComo}
        />
      )}
      {vista === 'espacios' && (
        <Espacios rubro={rubro} semana={semana} recursos={recursos} turnos={delDia(0)} jornada={id => jornada(id, 0)} rango={rangoHoy} personas={personas} onGuardar={guardarRecurso} onBorrar={borrarRecurso} />
      )}
      {vista === 'clientes' && (
        <Clientes
          rubro={rubro} clientes={clientesVista} servicios={servicios} selId={clienteSel} onSel={setClienteSel}
          proximo={proximoDe} onAbrirTurno={t => { setClienteSel(null); abrir(t) }}
          onAgregar={agregarCliente} onAgendar={c => agendar({ clienteId: c.id })} onWhatsApp={escribirACliente}
          verContacto={verContacto} verNumeros={verNumeros} puedeAgendar={puedeAgendar} soloLosSuyos={puede('clientes.ver') === 'propio'}
        />
      )}
      {vista === 'ganancias' && (
        <Ganancias
          rubro={rubro} personas={puede('ganancias.ver') === 'propio' ? (yo ? [yo] : []) : personas} roles={roles} clientes={clientes} clases={clases} turnosDelDia={delDia}
          pagadoHasta={Object.fromEntries(personas.map(p => [p.id, pagadoHasta[p.id] ?? pagadoHastaInicial(p)]))}
          alcance={puede('ganancias.ver') === 'propio' ? 'propio' : 'todo'} puedeLiquidar={puede('ganancias.liquidar') !== 'no'}
          onPagar={registrarPago} onPago={guardarPago} onAvisar={setMensaje}
        />
      )}
      {vista === 'configuracion' && <ConfiguracionTurnos rubro={rubro} equipo={{ roles, personas, onGuardarRol: guardarRol, onBorrarRol: borrarRol, onVerComo: verComo, onIrEquipo: () => ir('equipo') }} />}
      {vista === 'avanzado' && <AvanzadoTurnos rubro={rubro} />}

      {/* key: cada turno abre su detalle con el estado interno (mover, cancelar) de cero */}
      {abierto && (
        <DetalleTurno
          key={abierto.id}
          turno={abierto}
          rubro={rubro}
          cliente={clientes.find(c => c.id === abierto.clienteId)}
          recurso={recursos.find(r => r.id === abierto.recursoId)}
          diasMover={diasMover}
          libresMover={libresMover}
          puedeEditar={editaTurno(abierto)}
          puedeCobrar={puede('caja.cobrar') !== 'no'}
          verContacto={verContacto}
          onCerrar={() => setAbiertoEn(null)}
          onEstado={cambiarEstado}
          onMover={(d, inicio) => moverTurno(abierto, d, inicio)}
          onSena={() => registrarSena(abierto)}
          onAgendarOtro={() => agendar({ clienteId: abierto.clienteId, recursoId: abierto.recursoId })}
          onWhatsApp={() => escribirPorTurno(abierto)}
        />
      )}

      {nuevo && <NuevoTurno rubro={rubro} pre={nuevo} clientes={clientesVista.length ? clientesVista : clientes} recursos={recursosAgendables} servicios={servicios} turnosDelDia={delDia} jornada={jornada} verContacto={verContacto} onCerrar={() => setNuevo(null)} onCrear={crearTurno} />}
      {mensaje && <MensajeWhatsApp key={mensaje.texto} mensaje={mensaje} onCerrar={() => setMensaje(null)} avisar={avisar} />}

      {toast && (
        <div key={toast.id} className="tu-toast" aria-live="polite">
          <Toast variant="success" title={toast.titulo} description={toast.descripcion} onClose={() => setToast(null)} />
        </div>
      )}
    </LayoutTurnos>
  )
}
