import { createContext, useContext, useEffect, useState } from 'react'

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
 * En el servidor no hay `window`, así que el primer render no puede medir la
 * pantalla, y tiene que coincidir con el del HTML o React tira un error de
 * hidratación. Arrancaba siempre en `false`: quien entraba desde el teléfono
 * recibía la portada de escritorio —panel lateral de Circuito incluido— y la
 * veía acomodarse recién cuando el JavaScript terminaba de cargar.
 *
 * Ahora arranca en lo que el servidor adivinó por el navegador que hizo el
 * pedido (`MovilSSR`, que llena _app.tsx con el `__movil` de forceSSR.ts). Es
 * una pista y no una medida —una tablet o una ventana angosta en la
 * computadora la erran—, y el efecto de abajo la corrige igual que antes.
 */
export const MovilSSR = createContext(false)

/** ¿El pedido viene de un teléfono? Para `__movil`, del lado del servidor. */
export function esNavegadorMovil(userAgent: string | undefined): boolean {
  return /Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent ?? '')
}

export function useMovilPlantilla(): boolean {
  const [movil, setMovil] = useState(useContext(MovilSSR))

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const leer = () => setMovil(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  return movil
}
