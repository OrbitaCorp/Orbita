// Panel del gimnasio (demo), con el armazón del panel de Tienda (LayoutPanel):
// la barra lateral con todas las secciones a la vista, agrupadas en Hoy
// (Clases, Alumnos, Ingresos), Negocio (Equipo, Actividades y salas, Planes y
// precios) y Reservas (Reglas, Días sin clases, Recordatorios y mensajes,
// Pagos), más Calendarios y Configuración (Datos del negocio, Horarios).
//
// La URL dice dónde se está: ?rubro=&vista=&tab= y, dentro de una sección, lo
// que abrió (?clase=, ?dia=, ?ver=, ?socio=): un aviso de la campanita o el
// buscador llegan directo a una ficha, y el link se puede compartir. Los
// links viejos (?vista=configuracion&tab=planes) siguen abriendo lo correcto:
// se redirigen a la sección nueva.
//
// Todo lo que se toca acá vive en el almacén de la demo (datos/negocio.ts): un
// check-in hecho acá se ve en "Mis clases", y una reserva desde el sitio
// aparece en la clase. No hay backend.
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { BellRing, CalendarDays, CalendarOff, CalendarRange, HandCoins, Hourglass, MessageCircle, Settings, Shapes, SlidersHorizontal, Tag, UserRound, UserX, Users, Wallet } from 'lucide-react'
import LayoutPanel, { type AvisoNav, type ItemBusqueda, type ItemNav } from '@/design-system/reservas/LayoutPanel'
import { Encabezado, useAviso } from '@/design-system/reservas/piezas'
import { DIAS_CORTOS, MESES_CORTOS, diaSemana, diasEntre, fechaCorta, hhmm, partes } from '@/lib/reservas/fechas'
import { AHORA, ESTADO_PLAN, HOY, clasesDelDia, clasesSinProfe, cupoDe, estadoPlanDe, planDe, rubroPorKey } from '../datos'
import { useNegocio } from '../demo/useNegocio'
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
/** Las pestañas que Configuración tenía antes y hoy son secciones propias: el link viejo abre la nueva. */
const PESTANA_VIEJA: Record<string, string> = { actividades: 'actividades', planes: 'planes', reglas: 'reglas', bloqueos: 'bloqueos', calendarios: 'calendarios' }
const q1 = (v: unknown) => (typeof v === 'string' ? v : '')
/** "Sáb 14 nov · 10:40": el ahora fijo de la demo, en el header. */
const FECHA_DEMO = `${DIAS_CORTOS[diaSemana(HOY)]} ${partes(HOY).dia} ${MESES_CORTOS[partes(HOY).mes - 1]} · ${hhmm(AHORA)}`

export default function Panel() {
  const router = useRouter()
  const n = useNegocio()
  const { rubro, negocio, inscripciones, socios } = n
  const [avisar, aviso] = useAviso()
  const r = rubroPorKey(negocio.rubro)

  // Lo que más conviene mirar al entrar: las clases de hoy con gente esperando
  // o ya completas, los planes que vencen en 7 días y las clases que quedaron sin profe.
  const hoy = clasesDelDia(negocio, HOY).map(c => ({ ...c, k: cupoDe(c, HOY, inscripciones) }))
  const esperando = hoy.reduce((s, c) => s + c.k.espera, 0)
  const porVencer = socios.filter(s => estadoPlanDe(s) === 'por-vencer').sort((a, b) => (a.vence ?? '').localeCompare(b.vence ?? ''))
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
  const vista = viejo ?? (items.some(i => i.id === pedida) ? pedida : 'clases')
  const tab = vista === 'configuracion' ? (SUBS_CONFIG.some(s => s.id === tabQ) ? tabQ : 'negocio') : undefined
  // La query se arma de cero: lo que abrió una sección (?clase=, ?socio=) no viaja a la siguiente.
  const ir = (id: string, t?: string, extra: Record<string, string> = {}) => {
    void router.replace({ pathname: router.pathname, query: { rubro: rubro.key, vista: id, ...(t ? { tab: t } : {}), ...extra } }, undefined, { shallow: true, scroll: false })
  }
  // El link viejo se corrige en la barra de direcciones, para que lo que se copie ya sea el nuevo.
  useEffect(() => {
    if (viejo) void router.replace({ pathname: router.pathname, query: { rubro: rubro.key, vista: viejo } }, undefined, { shallow: true, scroll: false })
  }, [viejo, router, rubro.key])

  const avisos: AvisoNav[] = [
    ...hoy.filter(c => c.k.espera > 0).map(c => ({
      id: `espera-${c.id}`, Icon: Hourglass, tono: 'aviso' as const, nueva: true, cuando: `Hoy ${hhmm(c.inicio)}`,
      titulo: `${c.k.espera} ${c.k.espera === 1 ? 'persona espera' : 'personas esperan'} lugar en ${c.actividad?.nombre ?? 'una clase'}`,
      detalle: 'Si alguien cancela, pasa solo. También podés subirle el cupo a la clase.',
      onAbrir: () => ir('clases', undefined, { clase: c.id }),
    })),
    ...porVencer.slice(0, 5).map(s => ({
      id: `vence-${s.id}`, Icon: BellRing, tono: 'primario' as const, nueva: !!s.vence && diasEntre(HOY, s.vence) <= 3, cuando: s.vence ? `Vence el ${fechaCorta(s.vence)}` : '',
      titulo: `El plan de ${s.nombre} vence en ${s.vence ? diasEntre(HOY, s.vence) : 0} días`,
      detalle: `${planDe(negocio, s.planId)?.nombre ?? 'Plan'} · avisale para que renueve`,
      onAbrir: () => ir('socios', undefined, { socio: s.id }),
    })),
    ...hoy.filter(c => c.k.lleno && c.k.espera === 0 && c.inicio > AHORA).map(c => ({
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
    ...hoy.map(c => ({
      id: `clase-${c.id}`, grupo: 'Clases de hoy', titulo: `${c.actividad?.nombre ?? 'Clase'} · ${hhmm(c.inicio)}`, Icon: CalendarDays,
      detalle: `${c.profe?.nombre ?? 'Sin profe'} · ${c.sala} · ${c.k.anotados} de ${c.k.cupo}${c.k.espera ? ` · ${c.k.espera} en espera` : ''}`,
      onElegir: () => ir('clases', undefined, { clase: c.id }),
    })),
    ...negocio.profes.map(p => ({
      id: `profe-${p.id}`, grupo: 'Equipo', titulo: p.nombre, Icon: UserRound,
      detalle: p.actividades.map(a => negocio.actividades.find(x => x.id === a)?.nombre).filter(Boolean).join(', ') || 'Sin actividades',
      onElegir: () => ir('equipo'),
    })),
    ...socios.map(s => {
      const estado = estadoPlanDe(s)
      return {
        id: `socio-${s.id}`, grupo: r.socios, titulo: s.nombre, Icon: Users,
        detalle: `${s.telefono} · ${ESTADO_PLAN[estado].label}${s.planId ? ` · ${planDe(negocio, s.planId)?.nombre ?? ''}` : ''}`,
        onElegir: () => ir('socios', undefined, { socio: s.id }),
      }
    }),
  ]

  const armazon = {
    producto: 'Gimnasio', rubro: r.label, fecha: FECHA_DEMO, activo: vista, tab, onIr: ir,
    sitio: ruta('inicio', rubro.key), sitioDetalle: `Lo que ven tus ${r.socios.toLowerCase()} para reservar`,
  }

  // En una carga completa el primer render todavía tiene el negocio de ejemplo (ver
  // useHidratado): las secciones esperan a lo guardado. Si no, los formularios
  // arrancaban con el ejemplo y al guardar pisaban lo del dueño. Mientras tanto,
  // el armazón sin datos del negocio (ni nombre ni contadores): nada que después cambie.
  if (!n.hidratado) {
    return (
      <LayoutPanel {...armazon} negocio="" items={items.map(i => ({ ...i, badge: undefined }))}>
        <style>{CSS_PANEL}</style>
        <div className="rv-pagina" aria-busy="true"><Encabezado rotulo="Cargando" titulo={items.find(i => i.id === vista)?.label ?? ''} /></div>
      </LayoutPanel>
    )
  }

  const onGuardar = (cambio: Parameters<typeof n.configurar>[1], msj = 'Cambios guardados', detalle?: string) => { n.configurar(rubro.key, cambio); avisar(msj, detalle) }
  const usuario = { id: 'dueno', nombre: negocio.dueno.nombre, rol: negocio.dueno.rol, color: '#1D4ED8' }

  return (
    <LayoutPanel {...armazon} negocio={negocio.nombre} items={items} avisos={avisos} busqueda={busqueda} buscar={`Buscar ${r.socios.toLowerCase()}, clases o secciones`} usuario={usuario}>
      <style>{CSS_PANEL}</style>
      {vista === 'clases' && (
        <Clases key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios}
          onCambiar={(id, cambio, msj) => { n.cambiarInscripcion(id, cambio); if (msj) avisar(msj) }}
          onCancelar={(id, msj) => {
            // Si se libera un lugar de una clase con lista de espera, el aviso dice que el primero ya pasó.
            const la = inscripciones.find(i => i.id === id)
            const pasa = la?.estado === 'reservada' && inscripciones.some(i => i.claseId === la.claseId && i.fecha === la.fecha && i.estado === 'espera')
            n.cancelar(rubro.key, id)
            avisar(msj ?? 'Lugar liberado', pasa ? 'El primero de la lista de espera ya tiene su lugar.' : undefined)
          }}
          onInscribir={(i, msj) => { n.inscribir(rubro.key, i); avisar(msj ?? 'Anotado') }}
          onGuardarGrilla={(clases, msj) => onGuardar({ clases }, msj ?? 'Grilla guardada')} />
      )}
      {vista === 'socios' && (
        <Socios key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios}
          onAgregar={s => { n.agregarSocio(rubro.key, s); avisar('Sumado', `${s.nombre} ya puede reservar.`) }}
          onCambiar={(id, cambio, msj, detalle) => { n.cambiarSocio(id, cambio); if (msj) avisar(msj, detalle) }}
          onAvisar={avisar} />
      )}
      {vista === 'ingresos' && <Ingresos key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios} />}
      {vista === 'equipo' && <Equipo key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'actividades' && <Actividades key={rubro.key} negocio={negocio} onGuardar={onGuardar} onIrEquipo={() => ir('equipo')} />}
      {vista === 'planes' && <Planes key={rubro.key} negocio={negocio} socios={socios} onGuardar={onGuardar} />}
      {vista === 'reglas' && <Reglas key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'bloqueos' && <Bloqueos key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'mensajes' && <Mensajes key={rubro.key} negocio={negocio} socios={socios} onGuardar={onGuardar} onAvisar={avisar} />}
      {vista === 'pagos' && <Pagos key={rubro.key} negocio={negocio} socios={socios} onGuardar={onGuardar} onIrMensajes={() => ir('mensajes')} />}
      {vista === 'calendarios' && <Calendarios key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'configuracion' && tab === 'negocio' && <Negocio key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {vista === 'configuracion' && tab === 'horarios' && <Horarios key={rubro.key} negocio={negocio} onGuardar={onGuardar} />}
      {aviso}
    </LayoutPanel>
  )
}
