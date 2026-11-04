// Claro u oscuro en el sitio público de un negocio, a elección de quien lo visita.
//
// Pedido de Ale (04/11/2026): "falta agregarle el modo claro a Turnos, o sea
// debe estar para todos". Cada sitio arranca con el modo que trae su tema (en
// Turnos lo decide la plantilla del rubro; Alquileres y Gimnasio nacen en
// claro) y el visitante lo da vuelta con el sol o la luna de la cabecera. Queda
// guardado en su navegador, por módulo (un negocio de turnos y un gimnasio no
// se pisan), y el cambio se funde como en el resto de Órbita (conFundidoDeTema
// y globals.css, "Cambio de tema con fundido"; la clase tema-boton le da al
// botón su propia capa, uno solo pintado por pantalla).
//
// Es un store externo y no un contexto: así el `useTema` de Turnos y cualquier
// página del sitio leen el mismo valor sin provider, y el cambio hecho adentro
// de la View Transition les llega a todos en el mismo cuadro. El servidor y el
// primer pintado ven "sin elegir" (null → el modo del tema); lo guardado
// aparece al hidratar.
import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { conFundidoDeTema } from '@/hooks/useDarkMode'

export type ModuloSitio = 'turnos' | 'alquileres' | 'gimnasio'

const clave = (m: ModuloSitio) => `orbita-theme-${m}`
const oyentes = new Set<() => void>()
// Sin almacenamiento (navegación privada con todo bloqueado) el modo dura lo que la página.
const memoria: Partial<Record<ModuloSitio, boolean>> = {}

function leer(m: ModuloSitio): boolean | null {
  if (memoria[m] !== undefined) return memoria[m]!
  try {
    const v = localStorage.getItem(clave(m))
    return v === 'dark' ? true : v === 'light' ? false : null
  } catch {
    return null
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  window.addEventListener('storage', avisar)
  return () => {
    oyentes.delete(avisar)
    window.removeEventListener('storage', avisar)
  }
}
const sinElegir = () => null

/** El modo del sitio: lo que eligió el visitante o, si no eligió, el del tema (`porDefecto`). */
export function useModoSitio(modulo: ModuloSitio, porDefecto: boolean): boolean {
  const elegido = useSyncExternalStore(suscribir, () => leer(modulo), sinElegir)
  return elegido ?? porDefecto
}

/** Cambia el modo con fundido y lo guarda: todo lo que lo lee se vuelve a pintar adentro de la transición. */
export function cambiarModoSitio(modulo: ModuloSitio, oscuro: boolean) {
  conFundidoDeTema(oscuro, () => {
    memoria[modulo] = oscuro
    try { localStorage.setItem(clave(modulo), oscuro ? 'dark' : 'light') } catch { /* queda en memoria */ }
    oyentes.forEach((f) => f())
  })
}

/** Solo para tests: vuelve al estado inicial. */
export function olvidarModoSitio() {
  for (const m of Object.keys(memoria) as ModuloSitio[]) delete memoria[m]
}

/**
 * El sol o la luna. `className` lo viste cada sitio (tu-tema, als-tema, gis-tema);
 * con `texto`, además del ícono dice "Modo claro" / "Modo oscuro" (para una fila
 * de menú). Lleva tema-boton: no puede haber dos pintados a la vez en la página.
 */
export function BotonTema({ modulo, oscuro, className = '', texto = false, tamano = 18 }: {
  modulo: ModuloSitio
  oscuro: boolean
  className?: string
  texto?: boolean
  tamano?: number
}) {
  const etiqueta = oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'
  return (
    <button type="button" className={`tema-boton ${className}`.trim()} onClick={() => cambiarModoSitio(modulo, !oscuro)} aria-label={etiqueta} title={etiqueta}>
      {oscuro ? <Sun size={tamano} strokeWidth={1.8} aria-hidden /> : <Moon size={tamano} strokeWidth={1.8} aria-hidden />}
      {texto && <span>{oscuro ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  )
}
