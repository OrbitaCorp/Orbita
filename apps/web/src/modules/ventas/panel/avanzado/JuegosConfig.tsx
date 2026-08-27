// src/modules/ventas/panel/avanzado/JuegosConfig.tsx — Configuración de
// "Juegos con premio" (Fase 2.1 del paquete Avanzado).
//
// La parte jugable (el aro de verdad en /tienda/[slug]/juegos/HOOP, el
// reclamo vía Google y la creación del Discount premio) ya se construyó
// (Fase 2.2, ver JuegoHoop.tsx/ReclamarPremio.tsx) — esta pantalla es solo
// la configuración, con un link directo a probar el juego real de acá.

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Trophy, Volleyball, Lock } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle, CfgField } from '../configuracion/components/ConfigControls'
import { ApiError, panelGetGames, panelUpsertGame, type ApiGame } from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { currentSlug, tenantUrl } from '@/lib/tenant'

// 'HOOP' es hoy la única mecánica real — string libre en el backend (mismo
// criterio que BusinessAddon.type) para no migrar de nuevo cuando se sume
// otra. Las demás quedan listadas para que se vea qué viene, deshabilitadas.
const TIPO_ACTIVO = 'HOOP'
const MECANICAS = [
    { tipo: 'HOOP', label: 'Encestar', desc: 'Meter la pelota en el aro antes de que se acabe el tiempo.', Icon: Trophy, disponible: true },
    { tipo: 'GOAL', label: 'Meter un gol', desc: 'Próximamente', Icon: Volleyball, disponible: false },
]

export default function JuegosConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const [nombre, setNombre] = useState('')
    const [activo, setActivo] = useState(false)
    const [porcentajeAcierto, setPorcentajeAcierto] = useState('1')
    const [techo, setTecho] = useState('15')

    useEffect(() => {
        let cancelado = false
        panelGetGames()
            .then(games => {
                if (cancelado) return
                const actual = games.find((g: ApiGame) => g.type === TIPO_ACTIVO)
                if (actual) {
                    setNombre(actual.name ?? '')
                    setActivo(actual.isActive)
                    setPorcentajeAcierto(String(actual.percentPerWin))
                    setTecho(String(actual.maxPercent))
                }
            })
            .catch(e => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración'))
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    // Link directo al juego real en la tienda — solo si se puede resolver el
    // slug por subdominio (ver currentSlug()); en el path legacy sin
    // subdominio se omite en vez de armar un link roto.
    const slug = currentSlug()
    const juegoUrl = slug ? tenantUrl(slug, `/juegos/${TIPO_ACTIVO}`) : null

    const porcentajeNum = Number(porcentajeAcierto)
    const techoNum = Number(techo)
    const valoresValidos = porcentajeAcierto.trim() !== '' && techo.trim() !== ''
        && !Number.isNaN(porcentajeNum) && !Number.isNaN(techoNum)
        && porcentajeNum >= 0 && techoNum >= porcentajeNum

    async function guardar() {
        if (!valoresValidos || guardando) return
        setGuardando(true)
        try {
            await panelUpsertGame(TIPO_ACTIVO, {
                name: nombre.trim() || undefined,
                isActive: activo,
                percentPerWin: porcentajeNum,
                maxPercent: techoNum,
            })
            setToast('Configuración guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <button onClick={onVolver} style={volverBtn}>
                <ArrowLeft size={14} strokeWidth={2} /> Avanzado
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <Trophy size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Juegos con premio</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '0 0 22px', maxWidth: 640 }}>
                <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                    Configurá el juego acá — ya está jugable de verdad en tu tienda.
                </div>
                {juegoUrl && (
                    <a href={juegoUrl} target="_blank" rel="noreferrer" style={linkVerJuego}>
                        Ver el juego en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                    </a>
                )}
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, maxWidth: 640, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md" style={{ maxWidth: 640 }}>
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : (
                <>
                    <Card padding="md" style={{ maxWidth: 640, marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>Mecánica</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                            {MECANICAS.map(m => (
                                <div
                                    key={m.tipo}
                                    style={{
                                        position: 'relative', borderRadius: 10, padding: 14,
                                        border: m.tipo === TIPO_ACTIVO ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                        background: m.tipo === TIPO_ACTIVO ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)',
                                        opacity: m.disponible ? 1 : 0.55,
                                    }}
                                >
                                    <m.Icon size={18} strokeWidth={1.8} color={m.tipo === TIPO_ACTIVO ? 'var(--color-primary)' : 'var(--color-muted)'} />
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>{m.label}</div>
                                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 2 }}>{m.desc}</div>
                                    {!m.disponible && (
                                        <Lock size={12} strokeWidth={2} color="var(--color-muted)" style={{ position: 'absolute', top: 12, right: 12 }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card padding="md" style={{ maxWidth: 640 }}>
                        <CfgField label="Nombre a mostrar (opcional)" value={nombre} onChange={setNombre} placeholder="Encestá y ganá" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <CfgField label="% de descuento por acierto" value={porcentajeAcierto} onChange={setPorcentajeAcierto} placeholder="1" />
                            <CfgField label="Techo máximo de descuento" value={techo} onChange={setTecho} placeholder="15" />
                        </div>
                        {!valoresValidos && (porcentajeAcierto.trim() !== '' || techo.trim() !== '') && (
                            <div style={{ fontSize: 12, color: 'var(--color-error)', margin: '-6px 0 14px' }}>
                                El techo no puede ser menor que el % por acierto, y los dos tienen que ser números válidos.
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={activo} onChange={setActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Juego activo</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, cualquiera que entre a tu tienda puede jugar y ganar el descuento.</div>
                            </div>
                        </div>
                        <Button variant="primary" loading={guardando} disabled={!valoresValidos} onClick={guardar}>Guardar</Button>
                    </Card>
                </>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const volverBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0,
    fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit',
}
const linkVerJuego: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
    color: 'var(--color-primary)', textDecoration: 'none', flexShrink: 0,
}
