// src/modules/propuestas/prototipos/index.ts — Registro id → prototipo.
// Cada prototipo es un componente default, sin props, autocontenido.
// Se cargan con next/dynamic y ssr: false: son demos con animaciones,
// timers y estado local, no hace falta que rendericen en el server.

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

const cargando = () => null

export const PROTOTIPOS: Record<string, ComponentType> = {
  'constelaciones':   dynamic(() => import('./Constelaciones'),  { ssr: false, loading: cargando }),
  'libreta':          dynamic(() => import('./Libreta'),         { ssr: false, loading: cargando }),
  'carrito-colectivo':dynamic(() => import('./CarritoColectivo'),{ ssr: false, loading: cargando }),
  'precio-congelado': dynamic(() => import('./PrecioCongelado'), { ssr: false, loading: cargando }),
  'radar':            dynamic(() => import('./Radar'),           { ssr: false, loading: cargando }),
  'regateo':          dynamic(() => import('./Regateo'),         { ssr: false, loading: cargando }),
  'piloto':           dynamic(() => import('./Piloto'),          { ssr: false, loading: cargando }),
  'foto-catalogo':    dynamic(() => import('./FotoCatalogo'),    { ssr: false, loading: cargando }),
  'simulador':        dynamic(() => import('./Simulador'),       { ssr: false, loading: cargando }),
  'orbi-oido':        dynamic(() => import('./OrbiOido'),        { ssr: false, loading: cargando }),
  'publicidad':       dynamic(() => import('./Publicidad'),      { ssr: false, loading: cargando }),
  'vidriera-viva':    dynamic(() => import('./VidrieraViva'),    { ssr: false, loading: cargando }),
  'marca-60':         dynamic(() => import('./Marca60'),         { ssr: false, loading: cargando }),
  'recupera':         dynamic(() => import('./Recupera'),        { ssr: false, loading: cargando }),
  'escucha':          dynamic(() => import('./Escucha'),         { ssr: false, loading: cargando }),
  'cuentas-claras':   dynamic(() => import('./CuentasClaras'),   { ssr: false, loading: cargando }),
}
