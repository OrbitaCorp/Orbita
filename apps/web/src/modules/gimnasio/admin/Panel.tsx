// Panel del gimnasio (demo). Cuatro secciones: Clases (el día y la grilla
// semanal, con asistencia y lista de espera), Socios (planes, vencimientos y
// asistencia), Ingresos y Configuración. Cambia de pantalla con ?vista=.
//
// Todo lo que se toca acá vive en el almacén de la demo (datos/negocio.ts): un
// check-in hecho acá se ve en "Mis clases", y una reserva desde el sitio
// aparece en la clase. No hay backend.
import { useRouter } from 'next/router'
import { CalendarDays, HandCoins, Settings, Users } from 'lucide-react'
import LayoutPanel, { type ItemNav } from '@/design-system/reservas/LayoutPanel'
import { Encabezado, useAviso } from '@/design-system/reservas/piezas'
import { HOY, clasesDelDia, cupoDe, estadoPlanDe, rubroPorKey } from '../datos'
import { useNegocio } from '../demo/useNegocio'
import { ruta } from '../storefront/Sitio'
import Clases from './Clases'
import Socios from './Socios'
import Ingresos from './Ingresos'
import Configuracion from './Configuracion'

export default function Panel() {
  const router = useRouter()
  const n = useNegocio()
  const { rubro, negocio, inscripciones, socios } = n
  const [avisar, aviso] = useAviso()
  const r = rubroPorKey(negocio.rubro)

  // Lo que más conviene mirar al entrar: las clases de hoy con gente esperando
  // y los planes que vencen en los próximos 7 días (el aviso de vencimientos).
  const conEspera = clasesDelDia(negocio, HOY).filter(c => cupoDe(c, HOY, inscripciones).espera > 0).length
  const porVencer = socios.filter(s => estadoPlanDe(s) === 'por-vencer').length
  const items: ItemNav[] = [
    { id: 'clases', label: 'Clases', Icon: CalendarDays, badge: conEspera || undefined },
    { id: 'socios', label: r.socios, Icon: Users, badge: porVencer || undefined },
    { id: 'ingresos', label: 'Ingresos', Icon: HandCoins },
    { id: 'configuracion', label: 'Configuración', Icon: Settings },
  ]
  const pedida = typeof router.query.vista === 'string' ? router.query.vista : 'clases'
  const vista = items.some(i => i.id === pedida) ? pedida : 'clases'
  const ir = (v: string) => {
    const { tab: _t, ...resto } = router.query
    void _t
    void router.replace({ pathname: router.pathname, query: { ...resto, vista: v } }, undefined, { shallow: true })
  }

  // En una carga completa el primer render todavía tiene el negocio de ejemplo (ver
  // useHidratado): las secciones esperan a lo guardado. Si no, los formularios de
  // Configuración arrancaban con el ejemplo y al guardar pisaban lo del dueño.
  // Mientras tanto, el armazón sin datos del negocio (ni nombre ni contadores): nada que después cambie.
  if (!n.hidratado) {
    return (
      <LayoutPanel negocio="" rubro={r.label} items={items.map(i => ({ ...i, badge: undefined }))} activo={vista} onIr={ir} sitio={ruta('inicio', rubro.key)}>
        <div className="rv-pagina" aria-busy="true"><Encabezado rotulo="Cargando" titulo={items.find(i => i.id === vista)?.label ?? ''} /></div>
      </LayoutPanel>
    )
  }

  return (
    <LayoutPanel negocio={negocio.nombre} rubro={r.label} items={items} activo={vista} onIr={ir} sitio={ruta('inicio', rubro.key)}>
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
          onGuardarGrilla={(clases, msj) => { n.configurar(rubro.key, { clases }); avisar(msj ?? 'Grilla guardada') }} />
      )}
      {vista === 'socios' && (
        <Socios key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios}
          onAgregar={s => { n.agregarSocio(rubro.key, s); avisar('Sumado', `${s.nombre} ya puede reservar.`) }}
          onCambiar={(id, cambio, msj) => { n.cambiarSocio(id, cambio); if (msj) avisar(msj) }} />
      )}
      {vista === 'ingresos' && <Ingresos key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios} />}
      {vista === 'configuracion' && <Configuracion key={rubro.key} negocio={negocio} onGuardar={(cambio, msj) => { n.configurar(rubro.key, cambio); avisar(msj ?? 'Cambios guardados') }} />}
      {aviso}
    </LayoutPanel>
  )
}
