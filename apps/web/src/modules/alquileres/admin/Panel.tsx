// Panel del negocio de Alquileres (demo). Cuatro secciones, las que el modo
// necesita y nada más: la agenda (Reservas en canchas, Calendario en salones
// y alojamientos), la gente o los eventos (Clientes, Eventos en el salón,
// Huéspedes en la estadía), los ingresos y la configuración. Cambia de
// pantalla con ?vista=.
//
// Todo lo que se toca acá vive en el almacén de la demo (datos/negocio.ts):
// una reserva que se confirma en el panel se ve en "Mis reservas", y una que
// se hace desde el sitio aparece acá. No hay backend.
import { useRouter } from 'next/router'
import { CalendarDays, Contact, HandCoins, PartyPopper, Settings } from 'lucide-react'
import { TIPOS, type Reserva } from '../datos'
import { useNegocio } from '../demo/useNegocio'
import LayoutPanel, { type ItemNav } from '@/design-system/reservas/LayoutPanel'
import { useAviso } from '@/design-system/reservas/piezas'
import { ruta } from '../storefront/Sitio'
import Reservas from './Reservas'
import Clientes from './Clientes'
import Eventos from './Eventos'
import Ingresos from './Ingresos'
import Configuracion from './Configuracion'

export default function Panel() {
  const router = useRouter()
  const n = useNegocio()
  const { tipo, negocio, reservas, clientes, hidratado } = n
  const [avisar, aviso] = useAviso()
  // Cada modo arranca con su propio estado de pantalla, y todo se vuelve a
  // montar una vez cuando el navegador lee lo guardado: los formularios de
  // Configuración (y la propiedad elegida en el calendario) siembran su estado
  // con el negocio, y al recargar se quedaban con el de ejemplo.
  const k = `${tipo}:${hidratado ? 'guardado' : 'fabrica'}`

  const pendientes = reservas.filter(r => r.estado === 'pendiente').length
  const items: ItemNav[] = [
    { id: 'reservas', label: tipo === 'cancha' ? 'Reservas' : 'Calendario', Icon: CalendarDays, badge: pendientes || undefined },
    tipo === 'bloque'
      ? { id: 'eventos', label: 'Eventos', Icon: PartyPopper }
      : { id: 'clientes', label: tipo === 'estadia' ? 'Huéspedes' : 'Clientes', Icon: Contact },
    { id: 'ingresos', label: 'Ingresos', Icon: HandCoins },
    { id: 'configuracion', label: 'Configuración', Icon: Settings },
  ]
  const pedida = typeof router.query.vista === 'string' ? router.query.vista : 'reservas'
  const vista = items.some(i => i.id === pedida) ? pedida : 'reservas'
  const ir = (v: string, tab?: string) => {
    const { tab: _t, ...resto } = router.query
    void _t
    void router.replace({ pathname: router.pathname, query: { ...resto, vista: v, ...(tab ? { tab } : {}) } }, undefined, { shallow: true })
  }

  const cambiar = (id: string, cambio: Partial<Reserva>, aviso?: string) => { n.cambiarReserva(id, cambio); if (aviso) avisar(aviso) }

  return (
    <LayoutPanel negocio={negocio.nombre} rubro={`Alquileres · ${TIPOS[tipo].unidades}`} items={items} activo={vista} onIr={ir} sitio={ruta('inicio', tipo)}>
      {vista === 'reservas' && <Reservas key={k} negocio={negocio} reservas={reservas} clientes={clientes} onCambiar={cambiar} onReservar={(r, c) => { n.reservar(tipo, r, c); avisar('Reserva agendada', 'Ya figura en la agenda y en Mis reservas.') }} onBloqueo={b => { n.agregarBloqueo(tipo, b); avisar(tipo === 'estadia' ? 'Fechas bloqueadas' : 'Día bloqueado', tipo === 'estadia' ? 'No se van a poder reservar.' : 'No se va a poder reservar.') }} onQuitarBloqueo={id => { n.quitarBloqueo(tipo, id); avisar('Bloqueo quitado') }} />}
      {vista === 'eventos' && <Eventos key={k} negocio={negocio} reservas={reservas} clientes={clientes} onCambiar={cambiar} />}
      {vista === 'clientes' && <Clientes key={k} negocio={negocio} reservas={reservas} clientes={clientes} />}
      {vista === 'ingresos' && <Ingresos key={k} negocio={negocio} reservas={reservas} />}
      {vista === 'configuracion' && <Configuracion key={k} negocio={negocio} reservas={reservas} onGuardar={(cambio, aviso) => { n.configurar(tipo, cambio); avisar(aviso ?? 'Cambios guardados') }} onCalendario={(c, b) => { n.agregarCalendario(tipo, c, b); avisar('Calendario conectado', `${b.length} ${b.length === 1 ? 'fecha bloqueada' : 'fechas bloqueadas'}. Demo: sincronización simulada.`) }} onQuitarCalendario={id => { n.quitarCalendario(tipo, id); avisar('Calendario desconectado') }} />}
      {aviso}
    </LayoutPanel>
  )
}
