// Las piezas del panel para elegir el diseño de una promo: galería de
// temáticas, grilla de formatos y la vista previa dentro de una tienda de
// muestra. Las usan Juegos, Anuncios y la Oferta relámpago, así las tres
// pantallas se eligen igual.

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { ApiError, panelGetAppearance, panelUploadStorefrontImage } from '@/lib/api'
import JuegoInline from '@/modules/ventas/cliente/juegos/JuegoInline'
import { AnuncioPromo, type DatosAnuncio } from './AnuncioPromo'
import { MarcoJuego } from './MarcoJuego'
import { MiniEscena } from './escenasTematicas'
import { DISENOS_BASICOS, tematicasOrdenadas, type Mini } from './catalogo'

// ─── Color real de la tienda ────────────────────────────────────────────────
// La vista previa se dibuja adentro del panel, que tiene su propia paleta (y
// puede estar en modo oscuro): acá se fijan los tokens que usa la tienda.

function textoSobre(hex: string) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return '#FFFFFF'
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.38 ? '#14181F' : '#FFFFFF'
}

export function useTokensTienda(): CSSProperties {
    const { data } = useQuery({ queryKey: ['promos-apariencia'], queryFn: panelGetAppearance, staleTime: 60_000 })
    const primario = data?.colorPrimary || '#2563EB'
    return useMemo(() => ({
        '--color-primary': primario, '--color-on-primary': textoSobre(primario),
        '--color-primary-bg': `color-mix(in srgb, ${primario} 10%, #fff)`,
        '--color-bg': '#FFFFFF', '--color-surface': '#FFFFFF', '--color-surface-alt': '#F4F5F7',
        '--color-text': '#14181F', '--color-body': '#14181F', '--color-muted': '#596270', '--color-subtle': '#596270',
        '--color-border': '#E4E6EA', '--color-border-strong': '#C6CAD1',
        color: '#14181F',
    }) as CSSProperties, [primario])
}

// ─── Marco de la vista previa ───────────────────────────────────────────────

function MarcoTienda({ movil, children }: { movil: boolean; children: ReactNode }) {
    const tokens = useTokensTienda()
    return (
        <div className={`pv-marco${movil ? ' pv-marco--cel' : ''}`} style={tokens}>
            <div className="pv-tienda" aria-hidden="true">
                <div className="pv-head"><b>Tu tienda</b><span className="pv-nav"><i /><i /><i /></span><span className="pv-ic"><i /><i /></span></div>
                <div className="pv-hero" />
                <div className="pv-fila">{[0, 1, 2, 3].map(i => <div key={i}><span /><i /><i /></div>)}</div>
            </div>
            {children}
        </div>
    )
}

function CabezaVista({ titulo, nota, movil, onMovil }: { titulo: string; nota: string; movil: boolean; onMovil: (m: boolean) => void }) {
    return (
        <div className="pv-top">
            <div>
                <div className="pv-t">{titulo}</div>
                <div className="pv-n">{nota}</div>
            </div>
            <div className="pv-seg" role="group" aria-label="Pantalla">
                <button type="button" aria-pressed={!movil} onClick={() => onMovil(false)}>Computadora</button>
                <button type="button" aria-pressed={movil} onClick={() => onMovil(true)}>Celular</button>
            </div>
        </div>
    )
}

// Se juega de verdad, con la configuración que está en pantalla aunque no se
// haya guardado. JuegoInline en modo `prueba` no toca la API ni el navegador
// del dueño: ni sesión, ni descuento, ni métricas.
export function VistaPreviaJuego({ tipo, tema, presentacion, titulo, prueba }: {
    tipo: string
    tema: string
    presentacion: string
    titulo: string
    prueba: { percentPerWin: number; maxPercent: number; maxAttempts: number; timeLimitSeconds: number }
}) {
    const [movil, setMovil] = useState(false)
    const [vez, setVez] = useState(0)
    const clave = [tipo, tema, prueba.percentPerWin, prueba.maxPercent, prueba.maxAttempts, prueba.timeLimitSeconds, vez].join(':')
    return (
        <div>
            <style>{ESTILOS}</style>
            <CabezaVista titulo="Vista previa" nota="Jugala: no gasta premios ni queda registrada." movil={movil} onMovil={setMovil} />
            <MarcoTienda movil={movil}>
                <MarcoJuego enMarco tema={tema} presentacion={presentacion} titulo={titulo} onCerrar={() => setVez(v => v + 1)}>
                    <JuegoInline key={clave} slug="" tipo={tipo} nombreTienda="tu tienda" tema={tema} prueba={prueba} />
                </MarcoJuego>
            </MarcoTienda>
        </div>
    )
}

export function VistaPreviaAnuncio({ anuncio, formato, diseno }: { anuncio: DatosAnuncio; formato: string; diseno: string }) {
    const [movil, setMovil] = useState(false)
    const [cerrado, setCerrado] = useState(false)
    return (
        <div>
            <style>{ESTILOS}</style>
            <CabezaVista titulo="Vista previa" nota="Así lo ve quien entra a tu tienda." movil={movil} onMovil={setMovil} />
            <MarcoTienda movil={movil}>
                {!cerrado && (
                    <AnuncioPromo
                        key={formato}
                        enMarco
                        anuncio={{ ...anuncio, title: anuncio.title.trim() || 'Título del anuncio' }}
                        formato={formato}
                        diseno={diseno}
                        onCerrar={() => setCerrado(true)}
                        onCta={() => {}}
                    />
                )}
            </MarcoTienda>
            {cerrado && <button type="button" className="pv-volver" onClick={() => setCerrado(false)}>Volver a mostrar</button>}
        </div>
    )
}

// ─── Selectores ─────────────────────────────────────────────────────────────

export function GaleriaTematicas({ tipo, valor, onCambio }: { tipo: string; valor: string; onCambio: (id: string) => void }) {
    const [filtro, setFiltro] = useState<'todas' | 'temporada' | 'estilo'>('todas')
    const lista = useMemo(() => tematicasOrdenadas(filtro), [filtro])
    return (
        <div>
            <style>{ESTILOS}</style>
            <div className="ps-filtro" role="group" aria-label="Filtrar temáticas">
                {([['todas', 'Todas'], ['temporada', 'Temporada'], ['estilo', 'Estilos']] as const).map(([v, n]) => (
                    <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{n}</button>
                ))}
            </div>
            <div className="ps-temas">
                {lista.map(t => (
                    <button key={t.id} type="button" className="ps-tema" aria-pressed={valor === t.id} onClick={() => onCambio(t.id)}>
                        <span className="ps-img"><MiniEscena tipo={tipo} tema={t.id} /></span>
                        <span className="ps-n">{t.nombre}</span>
                        <span className="ps-w">{t.cuando}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

export function GrillaFormatos<T extends string>({ formatos, valor, onCambio }: {
    formatos: { id: T; nombre: string; desc: string; mini: Mini }[]
    valor: T
    onCambio: (id: T) => void
}) {
    return (
        <div className="ps-formatos">
            <style>{ESTILOS}</style>
            {formatos.map(f => (
                <button key={f.id} type="button" className="ps-formato" aria-pressed={valor === f.id} onClick={() => onCambio(f.id)}>
                    <span className="ps-mini" aria-hidden="true">
                        {f.mini.map(([l, t, w, h, o], i) => <i key={i} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, opacity: o ?? 1 }} />)}
                    </span>
                    <span className="ps-n">{f.nombre}</span>
                    <span className="ps-w">{f.desc}</span>
                </button>
            ))}
        </div>
    )
}

export function SelectorDiseno({ valor, onCambio, label = 'Estilo' }: { valor: string; onCambio: (id: string) => void; label?: string }) {
    return (
        <label className="ps-label">
            <style>{ESTILOS}</style>
            {label}
            <select value={valor} onChange={e => onCambio(e.target.value)}>
                <optgroup label="Básicos">{DISENOS_BASICOS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</optgroup>
                <optgroup label="Temporada">{tematicasOrdenadas('temporada').map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</optgroup>
                <optgroup label="Estilos">{tematicasOrdenadas('estilo').map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</optgroup>
            </select>
        </label>
    )
}

export function SubirFoto({ url, onCambio, onError }: { url: string | null; onCambio: (u: string | null) => void; onError: (m: string) => void }) {
    const input = useRef<HTMLInputElement>(null)
    const [subiendo, setSubiendo] = useState(false)
    async function subir(file: File | undefined) {
        if (!file) return
        setSubiendo(true)
        try {
            const r = await panelUploadStorefrontImage(file, file.name)
            onCambio(r.url)
        } catch (e) {
            onError(e instanceof ApiError ? e.message : 'No se pudo subir la foto')
        } finally {
            setSubiendo(false)
            if (input.current) input.current.value = ''
        }
    }
    return (
        <div className="ps-foto">
            <style>{ESTILOS}</style>
            {url && <img src={url} alt="Foto del anuncio" />}
            <input ref={input} type="file" accept="image/*" hidden onChange={e => subir(e.target.files?.[0])} />
            <button type="button" className="ps-link" disabled={subiendo} onClick={() => input.current?.click()}>
                <ImagePlus size={15} strokeWidth={1.8} /> {subiendo ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {url && (
                <button type="button" className="ps-link ps-link--quitar" onClick={() => onCambio(null)}>
                    <Trash2 size={14} strokeWidth={1.8} /> Quitar
                </button>
            )}
        </div>
    )
}

const ESTILOS = `
.pv-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.pv-t { font-size: 14px; font-weight: 600; color: var(--color-text); }
.pv-n { font-size: 12.5px; color: var(--color-muted); }
.pv-seg { display: flex; border: 1px solid var(--color-border); border-radius: 7px; overflow: hidden; flex-shrink: 0; }
.pv-seg button { height: 34px; padding: 0 11px; border: 0; background: transparent; color: var(--color-muted); font: inherit; font-size: 12.5px; cursor: pointer; }
.pv-seg button[aria-pressed=true] { background: var(--color-text); color: var(--color-bg); }
.pv-marco { position: relative; height: 620px; border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; background: #fff; margin: 0 auto; }
.pv-marco--cel { width: 340px; max-width: 100%; height: 640px; border: 7px solid #14181f; border-radius: 30px; }
.pv-tienda { position: absolute; inset: 0; background: #fff; overflow: hidden; }
.pv-head { height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #eceef1; }
.pv-head b { font-size: 14px; color: #14181f; }
.pv-nav, .pv-ic { display: flex; gap: 12px; }
.pv-nav i { width: 42px; height: 7px; border-radius: 4px; background: #e4e6ea; }
.pv-ic i { width: 15px; height: 15px; border-radius: 50%; border: 1.5px solid #b9bfc9; }
.pv-marco--cel .pv-nav { display: none; }
.pv-hero { height: 230px; background: #eceef1; }
.pv-fila { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 14px 16px; }
.pv-marco--cel .pv-fila { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pv-fila span { display: block; aspect-ratio: 1; border-radius: 6px; background: #eceef1; }
.pv-fila i { display: block; height: 7px; border-radius: 4px; background: #eceef1; margin-top: 6px; }
.pv-fila i:last-child { width: 55%; }
.pv-volver { display: block; margin: 10px auto 0; min-height: 36px; background: none; border: 0; color: var(--color-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }

.ps-filtro { display: flex; gap: 14px; font-size: 13px; margin-bottom: 12px; }
.ps-filtro button { min-height: 32px; padding: 0; border: 0; background: none; color: var(--color-muted); font: inherit; cursor: pointer; }
.ps-filtro button[aria-pressed=true] { color: var(--color-text); font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
.ps-temas { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 14px 10px; }
.ps-formatos { display: grid; grid-template-columns: repeat(auto-fill, minmax(146px, 1fr)); gap: 14px 10px; }
.ps-tema, .ps-formato { display: block; min-width: 0; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.ps-img { display: block; border-radius: 6px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--color-border); transition: opacity .15s; }
.ps-tema:hover .ps-img, .ps-formato:hover .ps-mini { opacity: .85; }
.ps-tema[aria-pressed=true] .ps-img, .ps-formato[aria-pressed=true] .ps-mini { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.ps-tema:focus-visible, .ps-formato:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 6px; }
.ps-n { display: block; margin-top: 5px; font-size: 13px; font-weight: 500; line-height: 1.25; color: var(--color-text); }
.ps-w { display: block; font-size: 12px; line-height: 1.3; color: var(--color-muted); }
.ps-mini { position: relative; display: block; aspect-ratio: 16 / 10; background: var(--color-surface-alt); border-radius: 6px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--color-border); transition: opacity .15s; }
.ps-mini::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 11%; background: var(--color-border); }
.ps-mini i { position: absolute; display: block; background: var(--color-text); border-radius: 2px; }
.ps-label { display: block; font-size: 12.5px; color: var(--color-muted); }
.ps-label select { display: block; width: 100%; height: 40px; margin-top: 4px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 14px; }
.ps-foto { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ps-foto img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.ps-link { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0; border: 0; background: none; color: var(--color-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.ps-link:disabled { opacity: .6; cursor: default; }
.ps-link--quitar { color: var(--color-muted); }
@media (max-width: 620px) {
  .ps-temas, .ps-formatos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pv-marco { height: 600px; }
}
`
