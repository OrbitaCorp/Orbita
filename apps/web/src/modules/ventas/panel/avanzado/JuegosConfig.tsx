// src/modules/ventas/panel/avanzado/JuegosConfig.tsx — Configuración de
// "Juegos con premio" (paquete Avanzado).
//
// Ya hay 5 mecánicas reales jugables en la tienda (Fase 2.2 —
// JuegoInline.tsx, misma mecánica de timing con distinto tema cada una).
// Cada una es un `Game` propio en la base ([businessId, type] único, ver
// schema.prisma) — el dueño elige la mecánica acá arriba y edita SU
// configuración (nombre, %, techo, activo/inactivo, vigencia) por
// separado; no hay "un solo juego", pueden convivir varias activas a la
// vez.
//
// (2026-08-27) Layout rehecho: antes todo era una sola columna angosta
// (maxWidth 640) apilada de a cards, se veía "feo"/vacío en pantallas
// anchas (pedido explícito del dueño). Ahora es de dos columnas —
// principal + sidebar de resumen, mismo patrón que ClienteDetalle.tsx — y
// los "Ganadores" pasaron de ser una card más abajo a su propia pestaña
// ("Reportes"), con una barra de tabs tipo navbar arriba del contenido
// (mismo patrón role="tablist" que ya usa ClienteDetalle.tsx).
//
// (2026-08-27, más tarde) El juego dejó de tener URL propia — pedido
// explícito del dueño: "no quiero que exista esa URL, solamente quiero
// modal al entrar a la página". Ahora se juega DENTRO del modal de
// Inicio.tsx (ver JuegoInline.tsx); el link de abajo ya no puede apuntar a
// `/juegos/{type}` (no existe más) — apunta al home de la tienda, que es
// donde ese modal aparece.

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Trophy, Goal, Crosshair, Fish, Flag, Check, Award, X } from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle, CfgField } from '../configuracion/components/ConfigControls'
import { RangoFechasPicker } from '@/modules/ventas/_shared/components'
import { ApiError, panelGetGames, panelUpsertGame, panelGetGameWinners, type ApiGame, type ApiGameWinner } from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { currentSlug, tenantUrl } from '@/lib/tenant'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
type Tab = 'config' | 'reportes'

// Mecánicas reales — agregar una nueva acá Y en TEMAS de JuegoInline.tsx (la
// mecánica del lado del storefront es genérica, solo cambia el tema).
const MECANICAS: { tipo: string; label: string; desc: string; Icon: IconType }[] = [
    { tipo: 'HOOP', label: 'Encestar', desc: 'Meter la pelota en el aro antes de que se acabe el tiempo.', Icon: Trophy },
    { tipo: 'GOAL', label: 'Meter un gol', desc: 'Patear justo a tiempo para meterla adentro del arco.', Icon: Goal },
    { tipo: 'DART', label: 'Tiro al blanco', desc: 'Clavar el dardo justo en el centro de la diana.', Icon: Crosshair },
    { tipo: 'FISH', label: 'Pescá el premio', desc: 'Enganchar el pez justo cuando pica el anzuelo.', Icon: Fish },
    { tipo: 'GOLF', label: 'Hoyo en uno', desc: 'Meter la pelota de un solo golpe, con el swing justo.', Icon: Flag },
]

const CONFIG_VACIA = { name: '', isActive: false, percentPerWin: '1', maxPercent: '15', timeLimitSeconds: '4', startDate: '', endDate: '' }

export default function JuegosConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>('config')

    // Todas las mecánicas ya configuradas, por tipo — se completa al cargar
    // y cada vez que se guarda una, para que la pestañita de "Activo" de la
    // mecánica se actualice sin tener que releer todo.
    const [configuradas, setConfiguradas] = useState<Record<string, ApiGame>>({})
    const [tipoSeleccionado, setTipoSeleccionado] = useState<string>(MECANICAS[0].tipo)

    const [nombre, setNombre] = useState('')
    const [activo, setActivo] = useState(false)
    const [porcentajeAcierto, setPorcentajeAcierto] = useState('1')
    const [techo, setTecho] = useState('15')
    const [tiempoLimite, setTiempoLimite] = useState('4')
    // Vigencia opcional ("desde"/"hasta", 'YYYY-MM-DD' o '' si no hay
    // límite de fechas) — pedido explícito del dueño: poder relanzar el
    // mismo juego con fechas nuevas sin tener que tocar el toggle a mano.
    // Cargar una vigencia distinta de la guardada cuenta como campaña
    // nueva del lado del storefront (ver campaignVersion en el backend).
    const [desde, setDesde] = useState('')
    const [hasta, setHasta] = useState('')
    // Snapshot de lo último cargado/guardado para ESTA mecánica — permite
    // saber si hay cambios sin guardar (mismo patrón que ConfigGeneral.tsx:
    // comparar contra un JSON.stringify original) y apagar "Guardar" si no
    // los hay.
    const [original, setOriginal] = useState('')

    // Ganadores de la mecánica seleccionada — se recarga cada vez que se
    // cambia de mecánica o se guarda (un cambio de % no reescribe premios ya
    // ganados, pero recargar es más simple que parchear la lista a mano).
    const [ganadores, setGanadores] = useState<ApiGameWinner[] | null>(null)

    useEffect(() => {
        let cancelado = false
        panelGetGames()
            .then(games => {
                if (cancelado) return
                setConfiguradas(Object.fromEntries(games.map((g: ApiGame) => [g.type, g])))
            })
            .catch(e => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración'))
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    // Al cambiar de mecánica (o cuando termina de cargar), el form se llena
    // con lo ya guardado para ESA mecánica, o los defaults si nunca se
    // configuró — nunca mezcla valores de una mecánica con otra.
    useEffect(() => {
        const existente = configuradas[tipoSeleccionado]
        const cargado = existente
            ? {
                name: existente.name ?? '', isActive: existente.isActive, percentPerWin: String(existente.percentPerWin), maxPercent: String(existente.maxPercent), timeLimitSeconds: String(existente.timeLimitSeconds),
                // El backend devuelve ISO completo (2026-08-28T00:00:00.000Z) — RangoFechasPicker espera solo 'YYYY-MM-DD'.
                startDate: existente.startDate ? existente.startDate.slice(0, 10) : '', endDate: existente.endDate ? existente.endDate.slice(0, 10) : '',
            }
            : CONFIG_VACIA
        setNombre(cargado.name)
        setActivo(cargado.isActive)
        setPorcentajeAcierto(cargado.percentPerWin)
        setTecho(cargado.maxPercent)
        setTiempoLimite(cargado.timeLimitSeconds)
        setDesde(cargado.startDate)
        setHasta(cargado.endDate)
        setOriginal(JSON.stringify(cargado))
    }, [tipoSeleccionado, configuradas])

    // Ganadores — pedido aparte del resto (no bloquea el form si tarda o
    // falla), se recarga con cada cambio de mecánica.
    useEffect(() => {
        let cancelado = false
        setGanadores(null)
        panelGetGameWinners(tipoSeleccionado)
            .then(w => { if (!cancelado) setGanadores(w) })
            .catch(() => { if (!cancelado) setGanadores([]) })
        return () => { cancelado = true }
    }, [tipoSeleccionado])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    // El juego no tiene URL propia — vive en el modal del home (ver
    // JuegoInline.tsx dentro de Inicio.tsx). El link solo puede llevar
    // hasta ahí, no directo al juego; se omite si no se puede resolver el
    // slug por subdominio (ver currentSlug()), en vez de armar un link roto.
    const slug = currentSlug()
    const tiendaUrl = slug ? tenantUrl(slug, '/') : null

    const porcentajeNum = Number(porcentajeAcierto)
    const techoNum = Number(techo)
    const tiempoNum = Number(tiempoLimite)
    // Vigencia: o las dos fechas vacías (sin límite) o las dos cargadas,
    // con hasta posterior a desde — mismo criterio que valida el backend,
    // repetido acá para no dejar guardar algo que el service va a rechazar.
    const vigenciaValida = (desde === '' && hasta === '') || (desde !== '' && hasta !== '' && hasta > desde)
    const valoresValidos = porcentajeAcierto.trim() !== '' && techo.trim() !== '' && tiempoLimite.trim() !== ''
        && !Number.isNaN(porcentajeNum) && !Number.isNaN(techoNum) && !Number.isNaN(tiempoNum)
        && porcentajeNum >= 0 && techoNum >= porcentajeNum
        && Number.isInteger(tiempoNum) && tiempoNum >= 1 && tiempoNum <= 30
        && vigenciaValida
    const hayCambios = original !== '' && JSON.stringify({ name: nombre, isActive: activo, percentPerWin: porcentajeAcierto, maxPercent: techo, timeLimitSeconds: tiempoLimite, startDate: desde, endDate: hasta }) !== original
    const estado = estadoVigencia(desde, hasta)

    async function guardar() {
        if (!valoresValidos || !hayCambios || guardando) return
        setGuardando(true)
        try {
            const guardado = await panelUpsertGame(tipoSeleccionado, {
                name: nombre.trim() || undefined,
                isActive: activo,
                percentPerWin: porcentajeNum,
                maxPercent: techoNum,
                timeLimitSeconds: tiempoNum,
                startDate: desde || undefined,
                endDate: hasta || undefined,
            })
            setConfiguradas(prev => ({ ...prev, [tipoSeleccionado]: guardado }))
            setOriginal(JSON.stringify({
                name: guardado.name ?? '', isActive: guardado.isActive, percentPerWin: String(guardado.percentPerWin), maxPercent: String(guardado.maxPercent), timeLimitSeconds: String(guardado.timeLimitSeconds),
                startDate: guardado.startDate ? guardado.startDate.slice(0, 10) : '', endDate: guardado.endDate ? guardado.endDate.slice(0, 10) : '',
            }))
            setDesde(guardado.startDate ? guardado.startDate.slice(0, 10) : '')
            setHasta(guardado.endDate ? guardado.endDate.slice(0, 10) : '')
            setToast('Configuración guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <style>{`
                @media (max-width: 900px) {
                    .juegos-cols { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <button onClick={onVolver} style={volverBtn}>
                <ArrowLeft size={14} strokeWidth={2} /> Avanzado
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <Trophy size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Juegos con premio</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>
                Elegí una mecánica y configurala — ya está jugable de verdad en tu tienda. Podés tener varias activas a la vez.
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md">
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : (
                <>
                    <Card padding="md" style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>Mecánica</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                            {MECANICAS.map(m => {
                                const activa = m.tipo === tipoSeleccionado
                                const yaConfigurada = configuradas[m.tipo]
                                return (
                                    <button
                                        key={m.tipo}
                                        type="button"
                                        onClick={() => setTipoSeleccionado(m.tipo)}
                                        style={{
                                            // Ancho de borde SIEMPRE 2px (solo cambia el color) — con un ancho
                                            // distinto según el estado, la card crecía 1px al seleccionarla y
                                            // corría todo lo que estaba debajo (bug reportado).
                                            position: 'relative', borderRadius: 10, padding: 14, textAlign: 'left', cursor: 'pointer',
                                            fontFamily: 'inherit', border: `2px solid ${activa ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            background: activa ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                        }}
                                    >
                                        <m.Icon size={18} strokeWidth={1.8} color={activa ? 'var(--color-primary)' : 'var(--color-muted)'} />
                                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>{m.label}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 2 }}>{m.desc}</div>
                                        {yaConfigurada?.isActive && (
                                            <span style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', borderRadius: 999, padding: '2px 7px' }}>
                                                <Check size={10} strokeWidth={2.5} /> Activo
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </Card>

                    <div className="juegos-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
                        {/* ── Columna principal: tabs Configuración / Reportes ── */}
                        <Card key={tipoSeleccionado} padding="md" style={{ padding: 0 }}>
                            <div role="tablist" aria-label="Secciones del juego" style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid var(--color-border)' }}>
                                {([['config', 'Configuración'], ['reportes', 'Reportes']] as [Tab, string][]).map(([k, l]) => {
                                    const a = tab === k
                                    return (
                                        <button
                                            key={k} onClick={() => setTab(k)} role="tab" aria-selected={a}
                                            style={{
                                                padding: '12px 4px', minHeight: 44, marginRight: 16, border: 'none', background: 'transparent',
                                                color: a ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: 13.5, fontWeight: a ? 600 : 500,
                                                cursor: 'pointer', fontFamily: 'inherit', borderBottom: `2px solid ${a ? 'var(--color-primary)' : 'transparent'}`,
                                                marginBottom: -1, transition: 'color 150ms, border-color 150ms',
                                            }}
                                        >
                                            {l}
                                        </button>
                                    )
                                })}
                            </div>

                            <div style={{ padding: 20 }}>
                                {tab === 'config' && (
                                    <>
                                        <CfgField label="Nombre a mostrar (opcional)" value={nombre} onChange={setNombre} placeholder={MECANICAS.find(m => m.tipo === tipoSeleccionado)?.label} />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                            <CfgField label="% de descuento por acierto" value={porcentajeAcierto} onChange={setPorcentajeAcierto} placeholder="1" />
                                            <CfgField label="Techo máximo de descuento" value={techo} onChange={setTecho} placeholder="15" />
                                        </div>
                                        <CfgField label="Tiempo por tiro (segundos)" value={tiempoLimite} onChange={setTiempoLimite} placeholder="4" />

                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 2px' }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Vigencia (opcional)</div>
                                            {(desde || hasta) && (
                                                <button type="button" onClick={() => { setDesde(''); setHasta('') }} style={quitarVigenciaBtn}>
                                                    <X size={11} strokeWidth={2.5} /> Quitar vigencia
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 10 }}>
                                            Dejalo vacío para manejarlo solo con el toggle de abajo. Cargar fechas nuevas — o volver a activar el juego — cuenta como un relanzamiento: a quien ya le apareció el aviso y lo cerró, le vuelve a aparecer.
                                        </div>
                                        <div style={{ marginBottom: 6 }}>
                                            <RangoFechasPicker
                                                fechaInicio={desde}
                                                fechaFin={hasta}
                                                onChangeInicio={setDesde}
                                                onChangeFin={setHasta}
                                                error={!vigenciaValida ? 'Cargá las dos fechas, con "hasta" posterior a "desde"' : undefined}
                                            />
                                        </div>
                                        {estado && <div style={{ fontSize: 12, fontWeight: 500, color: estado.color, margin: '0 0 14px' }}>{estado.texto}</div>}

                                        {!valoresValidos && (porcentajeAcierto.trim() !== '' || techo.trim() !== '' || tiempoLimite.trim() !== '') && (
                                            <div style={{ fontSize: 12, color: 'var(--color-error)', margin: '-6px 0 14px' }}>
                                                El techo no puede ser menor que el % por acierto, y el tiempo tiene que ser un entero de 1 a 30 segundos.
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                                            <Toggle on={activo} onChange={setActivo} />
                                            <div>
                                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Juego activo</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, cualquiera que entre a tu tienda puede jugar y ganar el descuento.</div>
                                            </div>
                                        </div>
                                        <DirtyHint show={hayCambios} />
                                        <Button variant="primary" loading={guardando} disabled={!valoresValidos || !hayCambios} onClick={guardar}>Guardar</Button>
                                    </>
                                )}

                                {tab === 'reportes' && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Award size={15} strokeWidth={1.8} color="var(--color-muted)" />
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Ganadores</div>
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 14 }}>
                                            Quién ganó esta mecánica y si ya reclamó el descuento.
                                        </div>
                                        {ganadores === null ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <SkeletonText width="100%" height={32} />
                                                <SkeletonText width="100%" height={32} delay={60} />
                                            </div>
                                        ) : ganadores.length === 0 ? (
                                            <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', padding: '8px 0' }}>Todavía nadie ganó esta mecánica.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {ganadores.map((g, i) => (
                                                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {g.cliente ?? 'Todavía sin reclamar'}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 1 }}>
                                                                {new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                {g.email ? ` · ${g.email}` : ''}
                                                                {g.code ? ` · ${g.code}` : ''}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                                                            {g.discountPercent}%
                                                        </div>
                                                        <span style={{
                                                            fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', flexShrink: 0,
                                                            color: g.status === 'CLAIMED' ? 'var(--color-success)' : 'var(--color-warning)',
                                                            background: g.status === 'CLAIMED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                                                        }}>
                                                            {g.status === 'CLAIMED' ? 'Reclamado' : 'Sin reclamar'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* ── Sidebar: resumen de la mecánica seleccionada ── */}
                        <Card padding="md">
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Resumen</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Estado</span>
                                <span style={{
                                    fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '2px 9px',
                                    color: activo ? 'var(--color-success)' : 'var(--color-muted)',
                                    background: activo ? 'var(--color-success-bg)' : 'var(--color-surface-alt)',
                                }}>
                                    {activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                            {estado ? (
                                <div style={{ fontSize: 12, fontWeight: 500, color: estado.color, marginBottom: 10, lineHeight: 1.5 }}>{estado.texto}</div>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginBottom: 10 }}>Sin límite de fechas.</div>
                            )}
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 14 }}>
                                {ganadores === null ? '—' : ganadores.length === 0 ? 'Todavía nadie ganó.' : `${ganadores.length} ${ganadores.length === 1 ? 'ganador' : 'ganadores'} en total.`}
                            </div>
                            {tiendaUrl && (
                                <a href={tiendaUrl} target="_blank" rel="noreferrer" style={linkVerJuego}>
                                    Ver en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                                </a>
                            )}
                        </Card>
                    </div>
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

// Indicador de en qué momento de la vigencia está el juego, calculado del
// lado del cliente sobre los valores del form (no hace falta el backend
// para saber si "ya empezó" o "ya venció").
function estadoVigencia(desde: string, hasta: string): { texto: string; color: string } | null {
    if (!desde || !hasta) return null
    const hoy = new Date().toISOString().slice(0, 10)
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    if (hoy < desde) return { texto: `Todavía no empezó — arranca el ${fmt(desde)}`, color: 'var(--color-warning)' }
    if (hoy > hasta) return { texto: `Venció el ${fmt(hasta)}`, color: 'var(--color-error)' }
    return { texto: `Vigente hasta el ${fmt(hasta)}`, color: 'var(--color-success)' }
}

// Mismo aviso que ya usa Configuración (ConfigGeneral.tsx#DirtyHint): punto
// naranja + "Tenés cambios sin guardar", pegado al botón que lo resuelve.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
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
    color: 'var(--color-primary)', textDecoration: 'none',
}
const quitarVigenciaBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0,
    fontSize: 11.5, fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit',
}
