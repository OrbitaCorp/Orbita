import { useEffect, useState } from 'react'

/**
 * ¿Estamos del lado móvil del breakpoint?
 *
 * Las plantillas de Home dibujan con un único booleano `movil` en vez de CSS
 * fluido (fueron pensadas para los marcos Notebook/Celular del panel), así que
 * la tienda real tiene que decirles de qué lado del corte está. 768px es el
 * mismo breakpoint que ya usan Sidebar/Shell/ConfigSidebar en este repo.
 *
 * Vive acá y no suelto adentro de Inicio.tsx porque lo necesitan los dos: la
 * portada y `StorefrontChrome`, que desde que el header de la plantilla se
 * dibuja en TODAS las vistas también tiene que elegir entre el navbar de
 * escritorio y el de celular — con el valor fijo en `false`, un cliente
 * entrando desde el teléfono al catálogo se comía el header de escritorio.
 *
 * Arranca en `false` (escritorio) porque en el servidor no hay `window`: el
 * primer render tiene que coincidir con el del HTML o React tira un error de
 * hidratación.
 */
export function useMovilPlantilla(): boolean {
  const [movil, setMovil] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const leer = () => setMovil(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  return movil
}
