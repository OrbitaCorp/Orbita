// Los pasos propios de Alquileres y de Gimnasio dentro del alta (qué alquilás,
// lo que alquilás, rubro, actividades y precios): son los de cada módulo (su
// onboarding/pasos.tsx, pintados con su kit rv-), con lo cargado encima de sus
// valores de fábrica.
//
// El alta lo baja recién al entrar a uno de estos pasos (next/dynamic en
// Alta.tsx): no lo importes de forma estática. En el alta real esos módulos
// están en "Próximamente" y este código no se baja nunca.
import { PasoQueAlquilas, PasoTipoAlquiler, type AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import { PasoActividades, PasoPlanes, PasoRubroGym, altaConRubro, type AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import type { Errores, PasoId } from './modelo'
import { alquilerDe, gymDe } from './reservas'

export default function PasosReservas({ id, alquiler, gym, onAlquiler, onGym, errores, intentado }: {
  id: PasoId
  /** Lo que se tocó en estos pasos: estadoAlta.ts guarda solo eso. */
  alquiler: Partial<AltaAlquiler>
  gym: Partial<AltaGym>
  /** Cada paso devuelve el pedazo que cambió. */
  onAlquiler: (cambio: Partial<AltaAlquiler>) => void
  onGym: (cambio: Partial<AltaGym>) => void
  errores: Errores
  intentado: boolean
}) {
  const a = alquilerDe(alquiler)
  const g = gymDe(gym)
  return (
    <div className="tuob-ancho">
      {id === 'tipo-alquiler' && <PasoTipoAlquiler valor={a.tipo} onElegir={tipo => onAlquiler({ tipo })} error={intentado ? errores.tipo : undefined} />}
      {id === 'que-alquilas' && <PasoQueAlquilas a={a} onChange={onAlquiler} errores={errores} intentado={intentado} />}
      {/* Elegir rubro precarga sus actividades y precios; volver a tocar el mismo no pisa lo editado. */}
      {id === 'rubro-gym' && <PasoRubroGym valor={g.rubro} onElegir={key => { if (key !== g.rubro) onGym(altaConRubro(g, key)) }} error={intentado ? errores.rubro : undefined} />}
      {id === 'actividades' && <PasoActividades a={g} onChange={onGym} errores={errores} intentado={intentado} />}
      {id === 'planes' && <PasoPlanes a={g} onChange={onGym} errores={errores} intentado={intentado} />}
    </div>
  )
}
