// src/modules/ventas/panel/configuracion/ConfigGeneral.tsx — hub de Configuración
//
// Punto de entrada del módulo `configuracion` (registrado en el componentMap).
//
//   /admin/[negocioId]/ventas/configuracion               → Negocio (default, sin ?vista=)
//   …/configuracion?vista=contacto|pagos|envios|redes|peligro
//   …/configuracion?vista=apariencia|equipo|notificaciones
//
// (2026-08-20) Rediseño completo del módulo: antes "General" era una sola
// pantalla con 6 tarjetas apiladas de a dos columnas, y Apariencia/Equipo/
// Notificaciones vivían como pantallas sueltas elegidas desde el sidebar
// PRINCIPAL del panel. Ahora las 9 son secciones independientes ("raíces",
// no tabs ni cards agrupadas) de un menú guía propio (ConfigSidebar.tsx) que
// vive DENTRO de esta pantalla — el sidebar principal se colapsa solo a la
// franja de íconos apenas se entra a Configuración (ver Sidebar.tsx) para
// hacerle lugar, mismo patrón que un módulo de configuración típico.
//
// Cada sección trae sus propios datos y tiene su propio botón de guardar
// (así si falla una no se pierde lo del resto — sin cambios ahí). Usa la
// sesión real del login: si no entraste con tu cuenta, muestra un aviso con
// un botón para ir a iniciar sesión. "Eliminar espacio" (RBT — ciclo de vida
// de suscripciones, 2026-09) ya está conectada: la tienda queda guardada 60
// días (no 30, como decía el texto viejo) antes del borrado definitivo
// simulado — ver SubscriptionsService.cancelBusiness/reactivateFromCancellation.
//
// Este archivo es el hub y el marco de las secciones del negocio. El estado
// vive en components/general/useConfigGeneral.ts y cada tarjeta en su
// propio archivo de components/general/.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { toastEsError } from '@/lib/utils'

import type { VistaConfig } from './components/ConfigTabs'
import { ConfigSidebar } from './components/ConfigSidebar'
import { GeneralViewSkeleton } from './components/general/GeneralViewSkeleton'
import { SeccionContacto, SeccionRedes } from './components/general/SeccionContacto'
import { SeccionEnvios } from './components/general/SeccionEnvios'
import { SeccionNegocio } from './components/general/SeccionNegocio'
import { BarraGuardadoPagos, SeccionPagos } from './components/general/SeccionPagos'
import { SeccionPeligro } from './components/general/SeccionPeligro'
import { SeccionPostventa } from './components/general/SeccionPostventa'
import { SectionTitle, h1Style, pageWrap } from './components/general/comunes'
import { TITULOS_SECCION } from './components/general/constantes'
import { useConfigGeneral } from './components/general/useConfigGeneral'
import Apariencia from './Apariencia'
import Equipo from './Equipo'
import Notificaciones from './Notificaciones'
import Suscripcion from './Suscripcion'
import Dominios from './Dominios'
import Soporte from './Soporte'
import RegistroActividad from './RegistroActividad'

// ─── General (V15) ────────────────────────────────────────────────────────────

function GeneralView({ vista, onToast }: { vista: VistaConfig; onToast: (m: string) => void }) {
    const cfg = useConfigGeneral(onToast)
    const { authStatus, esDueno, sinSesion, cargando, errorCarga, setRecarga, pagos, cambiado } = cfg

    // ── Pantallas especiales: sin sesión, cargando, o error al traer los datos ──

    if ((authStatus !== 'loading' && !esDueno) || sinSesion) {
        return (
            <div style={pageWrap}>
                <h1 style={h1Style}>Configuración general</h1>
                <Card>
                    <SectionTitle>No hay sesión activa</SectionTitle>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Esta pantalla usa datos reales de tu negocio y necesita que entres con tu
                        cuenta de propietario (o de tu equipo).
                    </div>
                    {/* Va con recarga completa a propósito: es la forma en que el equipo
                        maneja la ida al login, y así anda bien también con subdominios. */}
                    <Button variant="primary" onClick={() => { window.location.href = '/login' }}>
                        Iniciar sesión
                    </Button>
                </Card>
            </div>
        )
    }

    if (cargando) {
        return <GeneralViewSkeleton />
    }

    if (errorCarga) {
        return (
            <div style={pageWrap}>
                <h1 style={h1Style}>Configuración general</h1>
                <Card>
                    <SectionTitle>No se pudo cargar la configuración</SectionTitle>
                    <div style={{ fontSize: 14, color: 'var(--color-error)', marginBottom: 14 }}>{errorCarga}</div>
                    <Button variant="primary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="cfg-vista panel-page panel-page--form">
            {/* Celular: el padding de escritorio (32px por lado) le robaba 64px
                de ancho a la card y se veía aplastada al lado de las otras
                pantallas del panel. .cfg-hub-layout ya pone los 12px de aire. */}
            <style>{`
                @media (max-width: 768px) { .cfg-vista { padding: 4px 0 40px !important; } .cfg-vista > h1 { font-size: 22px !important; margin-bottom: 14px !important; } }
                @keyframes cfgStickyBarIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
            `}</style>
            <h1 style={h1Style}>{TITULOS_SECCION[vista] ?? 'Negocio'}</h1>

            {/* Ya no es un grid de varias tarjetas — cada sección de
                Configuración es su propia raíz en el menú guía (ver
                ConfigSidebar.tsx) y ocupa la pantalla entera, una tarjeta
                enfocada a la vez. */}
            <div>

                {(vista === 'negocio' || vista === 'general') && <SeccionNegocio cfg={cfg} onToast={onToast} />}
                {vista === 'contacto' && <SeccionContacto cfg={cfg} />}
                {vista === 'pagos' && <SeccionPagos cfg={cfg} />}
                {vista === 'envios' && <SeccionEnvios cfg={cfg} />}
                {vista === 'redes' && <SeccionRedes cfg={cfg} />}
                {vista === 'postventa' && <SeccionPostventa cfg={cfg} />}
                {vista === 'peligro' && <SeccionPeligro cfg={cfg} onToast={onToast} />}

            </div>

            {/* Barra flotante de guardado: solo en Pagos (ver BarraGuardadoPagos). */}
            {vista === 'pagos' && cambiado('pagos', pagos) && (
                <BarraGuardadoPagos cfg={cfg} />
            )}
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function ConfigGeneral() {
    const router = useRouter()
    const { vista } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const ir = (v: VistaConfig) => {
        const { vista: _v, ...rest } = router.query
        const q: Record<string, string | string[] | undefined> = { ...rest }
        // 'negocio' es el default (primera raíz del menú guía) — sin ?vista=
        // en la URL cae ahí, mismo criterio que 'general' antes.
        if (v !== 'negocio' && v !== 'general') q.vista = v
        router.push({ query: q })
    }

    const sub = (vista as VistaConfig | undefined) ?? 'negocio'
    let content
    if (sub === 'apariencia')          content = <Apariencia ir={ir} onToast={setToast} />
    else if (sub === 'equipo')         content = <Equipo ir={ir} onToast={setToast} />
    else if (sub === 'notificaciones') content = <Notificaciones ir={ir} />
    else if (sub === 'suscripcion')    content = <Suscripcion />
    else if (sub === 'dominios')       content = <Dominios />
    else if (sub === 'soporte')        content = <Soporte />
    else if (sub === 'actividad')      content = <RegistroActividad />
    else                               content = <GeneralView vista={sub} onToast={setToast} />

    return (
        <>
            {/* Mobile: el sidebar pasa a ser una franja horizontal arriba
                (ConfigSidebar.tsx ya se encarga de su propio layout) — acá
                solo hace falta apilar en vez de poner uno al lado del otro,
                y sacar el padding-left fijo que era "aire" para la card
                flotante de escritorio. */}
            <style>{`
                @media (max-width: 768px) {
                    .cfg-hub-layout { flex-direction: column !important; padding: 12px !important; gap: 12px !important; }
                    /* Negocio: "Usar mi ubicación actual" + "o arrastrá el pin" no
                       entran en una fila de 390px y se pisaban. Apilados. */
                    .cfg-ubic-row { flex-wrap: wrap !important; gap: 6px 10px !important; }
                    .cfg-ubic-row > span { margin-left: 0 !important; width: 100%; }
                    /* Envíos: label de 190px + input se salían de la card. El
                       label toma el ancho que sobra y el input queda fijo. */
                    .cfg-costo-row > div { width: auto !important; flex: 1 1 auto !important; }
                    .cfg-costo-row > input { flex: 0 0 120px !important; }
                    /* Zona peligrosa: el boton de la accion (Pausar, Eliminar)
                       quedaba apretado contra el borde derecho, del tamaño de
                       su texto. Va a lo ancho, debajo de la explicacion. */
                    .cfg-peligro-row > button { width: 100% !important; }
                }
            `}</style>
            <div className="cfg-hub-layout" style={{ display: 'flex', alignItems: 'stretch', gap: 0, padding: 0 }}>
                <ConfigSidebar activa={sub} onNavigate={ir} />
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    {content}
                </div>
            </div>
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}
