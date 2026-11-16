// Panel del gimnasio, con el armazón del panel de Tienda (LayoutPanel): la
// barra lateral con todas las secciones a la vista, agrupadas en Hoy (Clases,
// Alumnos, Ingresos), Negocio (Equipo, Actividades y salas, Planes y precios)
// y Reservas (Reglas, Días sin clases, Recordatorios y mensajes, Pagos), más
// Calendarios y Configuración (Datos del negocio, Horarios).
//
// La URL dice dónde se está: ?rubro=&vista=&tab= y, dentro de una sección, lo
// que abrió (?clase=, ?dia=, ?ver=, ?socio=): un aviso de la campanita o el
// buscador llegan directo a una ficha, y el link se puede compartir. Los
// links viejos (?vista=configuracion&tab=planes) siguen abriendo lo correcto:
// se redirigen a la sección nueva.
//
// Los datos y las acciones salen del origen (datos/origen): la demo, con todo
// en el navegador (un check-in hecho acá se ve en "Mis clases"), o la API de
// reservas con la sesión del panel. Con la API, el día y la hora son los de
// verdad, lo que la API rechaza se avisa con su mensaje, y las secciones que
// todavía no guardan allá lo dicen en la franja de arriba.
import { useEffect, useEffectEvent } from 'react'
import { useRouter } from 'next/router'
import { BellRing, CalendarDays, CalendarOff, CalendarRange, CloudOff, HandCoins, Hourglass, MessageCircle, Settings, Shapes, SlidersHorizontal, Tag, UserRound, UserX, Users, Wallet } from 'lucide-react'
import LayoutPanel, { type AvisoNav, type ItemBusqueda, type ItemNav } from '@/design-system/reservas/LayoutPanel'
import { Vacio, useAviso } from '@/design-system/reservas/piezas'
import { SkeletonVista, useCargaSimulada, type FormaSkeleton } from '@/design-system/reservas/skeleton'
import { DIAS_CORTOS, MESES_CORTOS, diaSemana, diasEntre, esISO, fechaCorta, hhmm, partes } from '@/lib/reservas/fechas'
import { ESTADO_PLAN, clasesDelDia, clasesSinProfe, cupoDe, estadoPlanDe, planDe, type NegocioGym } from '../datos'
import { useGimnasio, type Resultado, type SeccionGimnasio } from '../datos/origen'
import { RelojProvider, type Reloj } from '../datos/reloj'
import { useRubroDemo } from '../demo/BarraDemo'
import { ruta } from '../storefront/Sitio'
import { CSS_PANEL } from './piezas'
import Clases from './Clases'
import Socios from './Socios'
import Ingresos from './Ingresos'
import Equipo from './Equipo'
import Actividades from './configuracion/Actividades'
import Planes from './configuracion/Planes'
import Reglas from './configuracion/Reglas'
import Bloqueos from './configuracion/Bloqueos'
import Mensajes from './configuracion/Mensajes'
import Pagos from './configuracion/Pagos'
import Calendarios from './configuracion/Calendarios'
import Negocio from './configuracion/Negocio'
import Horarios from './configuracion/Horarios'

const SUBS_CONFIG = [{ id: 'negocio', label: 'Datos del negocio' }, { id: 'horarios', label: 'Horarios' }]
// La silueta de cada sección mientras llegan sus datos: la forma de la pantalla que viene
// después. Clases es la tira de días con lo del día (y la grilla semanal, columnas por día);
// Alumnos, indicadores, buscador y tabla; Ingresos, indicadores y gráficos; Equipo, tarjetas;
// el resto son formularios de 880 px (Planes también: una tarjeta con sus campos por plan).
const FORMAS: Record<SeccionGimnasio, FormaSkeleton> = {
  clases: 'agenda', socios: 'lista', ingresos: 'tablero', equipo: 'tarjetas-icono', actividades: 'formulario', planes: 'formulario',
  reglas: 'formulario', bloqueos: 'formulario', mensajes: 'formulario', pagos: 'formulario', calendarios: 'formulario', configuracion: 'formulario',
}
const esVista = (v: string): v is SeccionGimnasio => v in FORMAS
/** Las pestañas que Configuración tenía antes y hoy son secciones propias: el link viejo abre la nueva. */
const PESTANA_VIEJA: Record<string, SeccionGimnasio> = { actividades: 'actividades', planes: 'planes', reglas: 'reglas', bloqueos: 'bloqueos', calendarios: 'calendarios' }
const q1 = (v: unknown) => (typeof v === 'string' ? v : '')
/** "Sáb 14 nov · 10:40": el día y la hora del panel, en el header. */
const fechaDelHeader = ({ hoy, ahora }: Reloj) => `${DIAS_CORTOS[diaSemana(hoy)]} ${partes(hoy).dia} ${MESES_CORTOS[partes(hoy).mes - 1]} · ${hhmm(ahora)}`
const mensajeDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo guardar. Probá de nuevo.')

export default function Panel() {
  const router = useRouter()
  const [rubro] = useRubroDemo()
  const g = useGimnasio(rubro)
  const { negocio, inscripciones, socios, reloj, acciones } = g
  const { hoy, ahora } = reloj
  const [avisar, aviso] = useAviso()
  // La espera fingida de la demo (la de la API es de verdad): la primera carga muestra la silueta.
  const simulada = useCargaSimulada()
  const r = rubro

  // Lo que más conviene mirar al entrar: las clases de hoy con gente esperando
  // o ya completas, los planes que vencen en 7 días y las clases que quedaron sin profe.
  const deHoy = clasesDelDia(negocio, hoy).map(c => ({ ...c, k: cupoDe(c, hoy, inscripciones) }))
  const esperando = deHoy.reduce((s, c) => s + c.k.espera, 0)
  const porVencer = socios.filter(s => estadoPlanDe(s, hoy) === 'por-vencer').sort((a, b) => (a.vence ?? '').localeCompare(b.vence ?? ''))
  const sinProfe = clasesSinProfe(negocio)

  const items: ItemNav[] = [
    { id: 'clases', label: 'Clases', Icon: CalendarDays, grupo: 'Hoy', badge: esperando || undefined },
    { id: 'socios', label: r.socios, Icon: Users, grupo: 'Hoy', badge: porVencer.length || undefined },
    { id: 'ingresos', label: 'Ingresos', Icon: HandCoins, grupo: 'Hoy' },
    { id: 'equipo', label: 'Equipo', Icon: UserRound, grupo: 'Negocio' },
    { id: 'actividades', label: 'Actividades y salas', Icon: Shapes, grupo: 'Negocio' },
    { id: 'planes', label: 'Planes y precios', Icon: Tag, grupo: 'Negocio' },
    { id: 'reglas', label: 'Reglas de reserva', Icon: SlidersHorizontal, grupo: 'Reservas' },
    { id: 'bloqueos', label: 'Días sin clases', Icon: CalendarOff, grupo: 'Reservas' },
    { id: 'mensajes', label: 'Recordatorios y mensajes', Icon: MessageCircle, grupo: 'Reservas' },
    { id: 'pagos', label: 'Pagos', Icon: Wallet, grupo: 'Reservas' },
    { id: 'calendarios', label: 'Calendarios (.ics)', Icon: CalendarRange },
    { id: 'configuracion', label: 'Configuración', Icon: Settings, subs: SUBS_CONFIG },
  ]

  const pedida = q1(router.query.vista) || 'clases'
  const tabQ = q1(router.query.tab)
  const viejo = pedida === 'configuracion' ? PESTANA_VIEJA[tabQ] : undefined
  const vista: SeccionGimnasio = viejo ?? (esVista(pedida) && items.some(i => i.id === pedida) ? pedida : 'clases')
  const tab = vista === 'configuracion' ? (SUBS_CONFIG.some(s => s.id === tabQ) ? tabQ : 'negocio') : undefined
  // La query se arma de cero: lo que abrió una sección (?clase=, ?socio=) no viaja a la siguiente.
  // El origen viaja siempre: con ?origen=api, todas las secciones siguen sobre la API.
  const origenQ = q1(router.query.origen)
  const ir = (id: string, t?: string, extra: Record<string, string> = {}) => {
    void router.replace({ pathname: router.pathname, query: { rubro: rubro.key, ...(origenQ ? { origen: origenQ } : {}), vista: id, ...(t ? { tab: t } : {}), ...extra } }, undefined, { shallow: true, scroll: false })
  }
  // El link viejo se corrige en la barra de direcciones, para que lo que se copie ya sea el nuevo.
  useEffect(() => {
    if (viejo) void router.replace({ pathname: router.pathname, query: { rubro: rubro.key, ...(origenQ ? { origen: origenQ } : {}), vista: viejo } }, undefined, { shallow: true, scroll: false })
  }, [viejo, router, rubro.key, origenQ])

  // Con la API, el día que se mira en Clases tiene que estar leído: si cae fuera de la ventana, el origen la agranda.
  const diaQ = q1(router.query.dia)
  const verFecha = useEffectEvent((f: string) => g.verFecha(f))
  useEffect(() => { if (esISO(diaQ)) verFecha(diaQ) }, [diaQ])

  const avisos: AvisoNav[] = [
    ...deHoy.filter(c => c.k.espera > 0).map(c => ({
      id: `espera-${c.id}`, Icon: Hourglass, tono: 'aviso' as const, nueva: true, cuando: `Hoy ${hhmm(c.inicio)}`,
      titulo: `${c.k.espera} ${c.k.espera === 1 ? 'persona espera' : 'personas esperan'} lugar en ${c.actividad?.nombre ?? 'una clase'}`,
      detalle: 'Si alguien cancela, pasa solo. También podés subirle el cupo a la clase.',
      onAbrir: () => ir('clases', undefined, { clase: c.id }),
    })),
    ...porVencer.slice(0, 5).map(s => ({
      id: `vence-${s.id}`, Icon: BellRing, tono: 'primario' as const, nueva: !!s.vence && diasEntre(hoy, s.vence) <= 3, cuando: s.vence ? `Vence el ${fechaCorta(s.vence)}` : '',
      titulo: `El plan de ${s.nombre} vence en ${s.vence ? diasEntre(hoy, s.vence) : 0} días`,
      detalle: `${planDe(negocio, s.planId)?.nombre ?? 'Plan'} · avisale para que renueve`,
      onAbrir: () => ir('socios', undefined, { socio: s.id }),
    })),
    ...deHoy.filter(c => c.k.lleno && c.k.espera === 0 && c.inicio > ahora).map(c => ({
      id: `llena-${c.id}`, Icon: Users, tono: 'ok' as const, cuando: `Hoy ${hhmm(c.inicio)}`,
      titulo: `${c.actividad?.nombre ?? 'La clase'} de las ${hhmm(c.inicio)} está completa`,
      detalle: `${c.k.cupo} de ${c.k.cupo} lugares tomados.`,
      onAbrir: () => ir('clases', undefined, { clase: c.id }),
    })),
    ...(sinProfe.length ? [{
      id: 'sin-profe', Icon: UserX, tono: 'error' as const, nueva: true, cuando: 'Grilla semanal',
      titulo: `${sinProfe.length} ${sinProfe.length === 1 ? 'clase de la grilla quedó' : 'clases de la grilla quedaron'} sin profe`,
      detalle: 'Asignales a alguien desde la grilla o sumá a alguien al equipo.',
      onAbrir: () => ir('clases', undefined, { ver: 'grilla' }),
    }] : []),
  ]

  const busqueda: ItemBusqueda[] = [
    ...items.flatMap(i => (i.subs
      ? i.subs.map(s => ({ id: `ir-${i.id}-${s.id}`, grupo: 'Ir a', titulo: s.label, detalle: i.label, Icon: i.Icon, onElegir: () => ir(i.id, s.id) }))
      : [{ id: `ir-${i.id}`, grupo: 'Ir a', titulo: i.label, detalle: i.grupo, Icon: i.Icon, onElegir: () => ir(i.id) }])),
    ...deHoy.map(c => ({
      id: `clase-${c.id}`, grupo: 'Clases de hoy', titulo: `${c.actividad?.nombre ?? 'Clase'} · ${hhmm(c.inicio)}`, Icon: CalendarDays,
      detalle: `${c.profe?.nombre ?? 'Sin profe'}${c.sala ? ` · ${c.sala}` : ''} · ${c.k.anotados} de ${c.k.cupo}${c.k.espera ? ` · ${c.k.espera} en espera` : ''}`,
      onElegir: () => ir('clases', undefined, { clase: c.id }),
    })),
    ...negocio.profes.map(p => ({
      id: `profe-${p.id}`, grupo: 'Equipo', titulo: p.nombre, Icon: UserRound,
      detalle: p.actividades.map(a => negocio.actividades.find(x => x.id === a)?.nombre).filter(Boolean).join(', ') || 'Sin actividades',
      onElegir: () => ir('equipo'),
    })),
    ...socios.map(s => {
      const estado = estadoPlanDe(s, hoy)
      return {
        id: `socio-${s.id}`, grupo: r.socios, titulo: s.nombre, Icon: Users,
        detalle: `${s.telefono || 'Sin celular'} · ${ESTADO_PLAN[estado].label}${s.planId ? ` · ${planDe(negocio, s.planId)?.nombre ?? ''}` : ''}`,
        onElegir: () => ir('socios', undefined, { socio: s.id }),
      }
    }),
  ]

  const armazon = {
    producto: 'Gimnasio', rubro: r.label, fecha: fechaDelHeader(reloj), activo: vista, tab, onIr: ir,
    sitio: ruta('inicio', rubro.key), sitioDetalle: `Lo que ven tus ${r.socios.toLowerCase()} para reservar`,
  }

  // Lo que el armazón muestra del negocio: el nombre, quién mira y el buscador. Antes de
  // tener los datos, nada: sería el de ejemplo.
  const delNegocio = g.listo
    ? { negocio: negocio.nombre, usuario: { id: 'yo', nombre: g.usuario.nombre, rol: g.usuario.rol, color: '#1D4ED8' }, busqueda, buscar: `Buscar ${r.socios.toLowerCase()}, clases o secciones` }
    : { negocio: '' }

  // Con la API, una franja dice que el panel es el de un negocio real y si la sección
  // que se mira todavía no guarda allá (se ve con lo que se puede armar de las reservas).
  const franja = g.tipo === 'api' && g.listo ? (
    <div className="gip-franja" role="status">
      {g.guarda(vista)
        ? <span><b>{negocio.nombre}</b> · conectado a la API de reservas: lo que cambies acá queda guardado.</span>
        : <><CloudOff size={15} aria-hidden /><span><b>Esta sección todavía no guarda en la API.</b> Muestra lo que se puede armar con las reservas o datos de ejemplo; lo que cambies no queda guardado. Clases y Días sin clases ya guardan.</span></>}
    </div>
  ) : undefined

  // En una carga completa de la demo el primer render todavía tiene el negocio de ejemplo
  // (ver useHidratado), y con la API los datos todavía no llegaron: las secciones esperan.
  // Si no, los formularios arrancaban con el ejemplo y al guardar pisaban lo del dueño.
  // Mientras tanto, en el lugar de la sección va su silueta y el menú va sin contadores ni
  // avisos: llegan con los datos. Nada que después cambie.
  const cargando = !g.listo || (g.tipo === 'demo' && simulada)
  if (cargando) {
    const sinMenu = items.map(i => ({ ...i, badge: undefined }))
    return (
      <LayoutPanel {...armazon} {...delNegocio} items={sinMenu} cargando={!g.error}>
        <style>{CSS_PANEL}</style>
        {g.error
          ? <div className="rv-pagina"><Vacio titulo="No pudimos abrir el panel" texto={g.error} accion={<button type="button" className="rv-btn rv-btn--primario" onClick={g.reintentar}>Reintentar</button>} /></div>
          : <SkeletonVista forma={FORMAS[vista]} nombre={tab ? SUBS_CONFIG.find(s => s.id === tab)?.label : items.find(i => i.id === vista)?.label} />}
      </LayoutPanel>
    )
  }

  /**
   * Corre una acción del origen y avisa cómo salió: el mensaje de éxito con lo
   * que contó el origen ("El primero de la lista ya tiene su lugar."), o el
   * error tal como lo dijo la API.
   */
  const hacer = (accion: Promise<Resultado>, exito?: string, detalle?: string) => {
    accion.then(
      res => { if (exito) avisar(exito, res.detalle ?? detalle) },
      (e: unknown) => avisar(mensajeDe(e), undefined, 'error'),
    )
  }
  const noGuarda = () => avisar('Todavía no se guarda en la API', 'Esta sección no está conectada: lo que cambiaste no quedó guardado.', 'error')
  /** Guardar desde una sección: si con este origen todavía no guarda, se avisa y no se manda nada. */
  const guardarDesde = (seccion: SeccionGimnasio) => (cambio: Partial<NegocioGym>, msj = 'Cambios guardados', detalle?: string) => {
    if (g.guarda(seccion)) hacer(acciones.configurar(cambio), msj, detalle)
    else noGuarda()
  }

  return (
    <LayoutPanel {...armazon} {...delNegocio} items={items} avisos={avisos} franja={franja}>
      <style>{CSS_PANEL}</style>
      <RelojProvider reloj={reloj}>
        {/* Con la API, mientras se guarda y se vuelve a leer, la sección no se toca: lo que se ve puede estar viejo. */}
        <div className="gip-seccion" data-ocupado={g.ocupado || undefined} aria-busy={g.ocupado || undefined}>
        {vista === 'clases' && (
          <Clases key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios} corregirAsistencia={g.puede.corregirAsistencia}
            onCambiar={(id, cambio, msj) => hacer(acciones.cambiarInscripcion(id, cambio), msj)}
            onCancelar={(id, msj) => hacer(acciones.cancelar(id), msj ?? 'Lugar liberado')}
            onInscribir={(i, msj, nuevo) => hacer(acciones.inscribir(i, nuevo), msj ?? 'Anotado')}
            onGuardarGrilla={(clases, msj) => hacer(acciones.configurar({ clases }), msj ?? 'Grilla guardada')} />
        )}
        {vista === 'socios' && (
          <Socios key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios}
            onAgregar={s => (g.guarda('socios') ? hacer(acciones.agregarSocio(s), 'Sumado', `${s.nombre} ya puede reservar.`) : noGuarda())}
            onCambiar={(id, cambio, msj, detalle) => (g.guarda('socios') ? hacer(acciones.cambiarSocio(id, cambio), msj, detalle) : noGuarda())}
            onAvisar={avisar} />
        )}
        {vista === 'ingresos' && <Ingresos key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios} />}
        {vista === 'equipo' && <Equipo key={rubro.key} negocio={negocio} onGuardar={guardarDesde('equipo')} />}
        {vista === 'actividades' && <Actividades key={rubro.key} negocio={negocio} onGuardar={guardarDesde('actividades')} onIrEquipo={() => ir('equipo')} />}
        {vista === 'planes' && <Planes key={rubro.key} negocio={negocio} socios={socios} onGuardar={guardarDesde('planes')} />}
        {vista === 'reglas' && <Reglas key={rubro.key} negocio={negocio} onGuardar={guardarDesde('reglas')} />}
        {vista === 'bloqueos' && <Bloqueos key={rubro.key} negocio={negocio} onGuardar={guardarDesde('bloqueos')} />}
        {vista === 'mensajes' && <Mensajes key={rubro.key} negocio={negocio} socios={socios} onGuardar={guardarDesde('mensajes')} onAvisar={avisar} />}
        {vista === 'pagos' && <Pagos key={rubro.key} negocio={negocio} socios={socios} onGuardar={guardarDesde('pagos')} onIrMensajes={() => ir('mensajes')} />}
        {vista === 'calendarios' && <Calendarios key={rubro.key} negocio={negocio} onGuardar={guardarDesde('calendarios')} />}
        {vista === 'configuracion' && tab === 'negocio' && <Negocio key={rubro.key} negocio={negocio} onGuardar={guardarDesde('configuracion')} />}
        {vista === 'configuracion' && tab === 'horarios' && <Horarios key={rubro.key} negocio={negocio} onGuardar={guardarDesde('configuracion')} />}
        </div>
      </RelojProvider>
      {aviso}
    </LayoutPanel>
  )
}
