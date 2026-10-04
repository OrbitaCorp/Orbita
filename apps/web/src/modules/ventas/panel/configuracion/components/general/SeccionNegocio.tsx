import { useState } from 'react'
import { MapPin, LocateFixed } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { MapPicker } from '@/components/MapPicker'
import { CfgField } from '../ConfigControls'
import { DirtyHint, ErrorInline, SectionTitle } from './comunes'
import type { ConfigGeneralState } from './useConfigGeneral'

export function SeccionNegocio({ cfg, onToast }: { cfg: ConfigGeneralState; onToast: (m: string) => void }) {
    const { negocio, setNegocio, pagos, cambiado, guardando, guardarNegocio, errores } = cfg

    // ── Mapa de "Dirección del local" — mismo mecanismo que StepUbicacion en
    // el wizard de onboarding (SetupUnificado.tsx): buscar por texto, GPS, o
    // arrastrar el pin. Nominatim (OpenStreetMap) para geocodificar en los
    // dos sentidos — gratis, sin API key, mismo que ya usa el wizard.
    const [buscandoDireccion, setBuscandoDireccion] = useState(false)
    const [localizando, setLocalizando] = useState(false)

    async function buscarDireccion() {
        const q = negocio.pickupAddress.trim()
        if (!q) return
        setBuscandoDireccion(true)
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ar&limit=1`)
            const data = await res.json()
            const hit = data[0]
            if (hit) setNegocio(p => ({ ...p, latLng: [+hit.lat, +hit.lon], pickupAddress: hit.display_name }))
        } catch { /* sin resultados o sin red: el campo de texto queda como el dueño lo dejó */ }
        finally { setBuscandoDireccion(false) }
    }

    function usarUbicacionActual() {
        // El botón fallaba en silencio: si el navegador no puede ubicar (o ya
        // tiene el permiso denegado) no pasaba absolutamente nada y parecía
        // roto. Cada caso ahora dice qué hacer.
        //
        // El más común en celular: entrar por IP o por http:// — el navegador
        // solo entrega la ubicación en un contexto seguro (https o localhost)
        // y ni siquiera muestra el cartel de permiso.
        if (!navigator.geolocation) {
            onToast('Tu navegador no puede darnos la ubicación. Escribí la dirección y tocá "Buscar".')
            return
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            onToast('Para usar tu ubicación hay que entrar por https. Escribí la dirección y tocá "Buscar".')
            return
        }
        setLocalizando(true)
        navigator.geolocation.getCurrentPosition(
            pos => {
                const latLng: [number, number] = [pos.coords.latitude, pos.coords.longitude]
                setNegocio(p => ({ ...p, latLng }))
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
                    .then(r => r.json())
                    .then(d => { if (d.display_name) setNegocio(p => ({ ...p, pickupAddress: d.display_name })) })
                    .catch(() => {})
                    .finally(() => setLocalizando(false))
            },
            err => {
                setLocalizando(false)
                onToast(
                    err.code === err.PERMISSION_DENIED
                        ? 'No nos diste permiso de ubicación. Habilitalo para este sitio en el navegador, o arrastrá el pin del mapa.'
                        : err.code === err.TIMEOUT
                            ? 'Tardó demasiado en ubicarte. Probá de nuevo o arrastrá el pin del mapa.'
                            : 'No pudimos obtener tu ubicación. Escribí la dirección o arrastrá el pin del mapa.',
                )
            },
            // 8s con GPS frío en un celular se corta antes de fijar posición.
            { timeout: 20000, maximumAge: 60000 },
        )
    }

    function arrastrarPin(latLng: [number, number]) {
        setNegocio(p => ({ ...p, latLng }))
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
            .then(r => r.json())
            .then(d => { if (d.display_name) setNegocio(p => ({ ...p, pickupAddress: d.display_name })) })
            .catch(() => {})
    }

    return (
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Información del negocio</SectionTitle>
            {/* "Nombre del negocio" NO es opcional: es obligatorio desde el alta
                (register-business.dto.ts, @IsNotEmpty) y este campo siempre llega
                precargado con el que ya tiene — dejarlo vacío rompería la tienda. */}
            <CfgField label="Nombre del negocio" value={negocio.name} onChange={v => setNegocio(p => ({ ...p, name: v }))} />
            <CfgField label="Rubro (opcional)" value={negocio.industry} onChange={v => setNegocio(p => ({ ...p, industry: v }))} />
            <CfgField label="Descripción corta (opcional)" value={negocio.description} area onChange={v => setNegocio(p => ({ ...p, description: v }))} />
            {/* Mismo widget que "¿Dónde operás?" del wizard de onboarding
                (SetupUnificado.tsx): buscar por texto, GPS, o arrastrar el
                pin — las tres formas escriben el mismo par lat/lng. */}
            <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>Dirección del local</label>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', padding: '4px 4px 4px 12px', gap: 8 }}>
                        <MapPin size={15} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                        <input
                            value={negocio.pickupAddress}
                            onChange={e => setNegocio(p => ({ ...p, pickupAddress: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarDireccion() } }}
                            placeholder="Ej: Av. Corrientes 1234, CABA"
                            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '8px 0', fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit' }}
                        />
                        <Button size="sm" variant="secondary" loading={buscandoDireccion} onClick={buscarDireccion}>Buscar</Button>
                    </div>
                    <div className="cfg-ubic-row" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '8px 12px' }}>
                        <button
                            type="button"
                            onClick={usarUbicacionActual}
                            disabled={localizando}
                            className="ds-hover"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '6px 14px', borderRadius: 20,
                                border: `1.5px solid ${localizando ? 'var(--color-border)' : 'rgba(59,130,246,0.3)'}`,
                                background: localizando ? 'transparent' : 'rgba(59,130,246,0.05)',
                                color: localizando ? 'var(--color-muted)' : 'var(--color-primary)',
                                fontSize: 12, fontWeight: 600, cursor: localizando ? 'default' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <LocateFixed size={13} strokeWidth={2.2} />
                            {localizando ? 'Obteniendo tu ubicación…' : 'Usar mi ubicación actual'}
                        </button>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-subtle)' }}>o arrastrá el pin</span>
                    </div>
                    <MapPicker center={negocio.latLng} onDragEnd={arrastrarPin} />
                </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
                Se muestra a tus clientes cuando activás &quot;Retiro en local&quot; en Pagos.
            </div>
            {pagos.acceptsPickup && !negocio.pickupAddress.trim() && (
                <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                    Tenés Retiro en local activado pero sin dirección cargada — el storefront le avisa al cliente que se la vas a pasar por WhatsApp.
                </div>
            )}
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <DirtyHint show={cambiado('negocio', negocio)} />
                <Button variant="primary" loading={guardando === 'negocio'} disabled={!cambiado('negocio', negocio)} onClick={guardarNegocio}>Guardar cambios</Button>
                <ErrorInline msg={errores.negocio} />
            </div>
        </Card>
    )
}
