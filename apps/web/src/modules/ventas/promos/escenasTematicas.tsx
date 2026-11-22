// El mismo juego con otra piel. Arma una EscenaConfig (la misma interfaz que
// las escenas originales de escenas.tsx) a partir de una temática, así la
// mecánica de JuegoInline.tsx no se entera: mismo timing, misma zona de
// acierto, mismas reglas en la tienda y en la vista previa.
//
// Dos reglas de geometría, las mismas que explica escenas.tsx:
//   - `destinoY` es el BORDE INFERIOR del proyectil, medido desde abajo.
//   - El proyectil se achica hasta 0.72 alrededor de su centro: con uno alto y
//     asimétrico (dardo, anzuelo) hay que compensarlo al calcular dónde cae.

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ALTO_ESCENA, ANCHO_DISENO, ESCENAS, type EscenaConfig, type EstadoTiro } from '@/modules/ventas/cliente/juegos/escenas'
import { esTematicaConPiel, tematicaDe, type PaletaEscena, type Tematica } from './catalogo'
import { calabaza, circ, corazon, escaparTexto, estrella, flor, huevo } from './dibujos'

// En la temática "Línea" todo es blanco con trazo negro: lo que tiene que
// resaltar pasa al color de la tinta.
const acento = (p: PaletaEscena) => (p.a === '#FFFFFF' ? p.t : p.a)

function pieza(t: Tematica) {
    const p = t.p
    switch (t.pieza) {
        case 'corazon': return corazon(0, -1, 1.1, p.a)
        case 'huevo': return huevo(0, 0, 1.08, p.a, p.c)
        case 'calabaza': return calabaza(0, 1, 0.95, p.a)
        case 'estrella': return estrella(0, 0, 18, p.c)
        case 'flor': return flor(0, 0, 9, p.a, p.c)
        case 'bola': return `<rect x="-4" y="-20" width="8" height="6" rx="1" fill="${p.c}"/>${circ(0, 0, 15, p.a)}<path d="M-14.4-4Q0 2 14.4-4M-14.4 4Q0 10 14.4 4" stroke="${p.c}" stroke-width="2.2" fill="none"/>`
        default: return `${circ(0, 0, 15, p.a)}<path d="M-15 0H15M0-15V15M-10.6-10.6Q0 0-10.6 10.6M10.6-10.6Q0 0 10.6 10.6" stroke="${p.t}" stroke-width="1.2" fill="none"/>`
    }
}

function etiquetaSvg(p: PaletaEscena, texto: string, y: number) {
    const tinta = p.b === '#24382F' ? p.t : '#14181F'
    return `<rect x="-25" y="${y}" width="50" height="26" rx="4" fill="${p.b}" stroke="${p.t}" stroke-width="1.6"/><text y="${y + 18}" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="13.5" fill="${tinta}">${escaparTexto(texto)}</text>`
}

// Cada juego: dónde va, cómo se mueve y qué se dibuja. `obj` y `frente` se
// dibujan con el origen en el centro del objetivo; `frente` va por delante del
// proyectil, que es lo que hace que la pelota se vea entrar.
interface Juego {
    instruccion: string
    centro: number // y del centro del objetivo, desde arriba
    origenSvg: number // cuánto del SVG del objetivo queda arriba de su centro
    amplitud: number; destinoY: number; pico: number; picoFallo: number
    direccion: EscenaConfig['direccion']; ritmo?: EscenaConfig['ritmo']
    suelo: (p: PaletaEscena) => string
    obj: (p: PaletaEscena, estado: EstadoTiro, etiqueta: string) => string
    frente?: (p: PaletaEscena) => string
    fijoFrente?: (p: PaletaEscena) => string
    proyectil: (t: Tematica, etiqueta: string) => { svg: string; w: number; h: number; vb: string }
}

const proyectilPieza = (t: Tematica) => ({ svg: pieza(t), w: 40, h: 40, vb: '-20 -20 40 40' })

const JUEGOS: Record<string, Juego> = {
    HOOP: {
        instruccion: 'Tocá la cancha para tirar', centro: 66, origenSvg: 46, amplitud: 36, destinoY: 180, pico: 110, picoFallo: 130, direccion: 'lanzar',
        suelo: p => `<rect y="238" width="400" height="52" fill="${p.suelo}"/><rect y="238" width="400" height="2.5" fill="${p.raya}"/><path d="M120 290Q200 250 280 290" stroke="${p.raya}" stroke-width="2" fill="none"/>`,
        obj: p => `<rect x="-48" y="-54" width="96" height="66" rx="4" fill="${p.b}" stroke="${p.t}" stroke-width="2"/><rect x="-16" y="-33" width="32" height="26" fill="none" stroke="${acento(p)}" stroke-width="3"/><rect x="-5" y="12" width="10" height="9" fill="${p.t}"/><path d="M-31 24A31 8 0 0 1 31 24" stroke="${acento(p)}" stroke-width="5" fill="none"/>`,
        frente: p => `<path d="M31 24A31 8 0 0 1-31 24" stroke="${acento(p)}" stroke-width="5" fill="none"/><path d="M-29 28L-20 60M-15 31L-10 62M0 32V63M15 31L10 62M29 28L20 60M-25 43Q0 51 25 43" stroke="${p.t}" stroke-opacity=".65" stroke-width="1.5" fill="none"/>`,
        proyectil: proyectilPieza,
    },
    GOAL: {
        instruccion: 'Tocá la cancha para patear', centro: 126, origenSvg: 46, amplitud: 32, destinoY: 142, pico: 90, picoFallo: 112, direccion: 'lanzar',
        suelo: p => `<rect y="182" width="400" height="108" fill="${p.suelo}"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 68}" y="182" width="34" height="108" fill="${p.suelo2}"/>`).join('')}<rect y="182" width="400" height="2.5" fill="${p.raya}"/><path d="M60 290L110 232H290L340 290" stroke="${p.raya}" stroke-width="2" fill="none"/>`,
        obj: () => '<rect x="-70" y="-44" width="140" height="100" fill="rgba(0,0,0,.22)"/>',
        frente: p => `<g stroke="${p.t}" stroke-opacity=".45" stroke-width="1">${Array.from({ length: 13 }, (_, i) => `<path d="M${-66 + i * 11} -44V56"/>`).join('')}${Array.from({ length: 9 }, (_, i) => `<path d="M-70 ${-38 + i * 11}H70"/>`).join('')}</g><path d="M-70 56V-44H70V56" stroke="${p.b === '#24382F' ? p.t : p.b}" stroke-width="5" fill="none"/>`,
        proyectil: proyectilPieza,
    },
    DART: {
        instruccion: 'Tocá para lanzar el dardo', centro: 112, origenSvg: 46, amplitud: 34, destinoY: 126, pico: 90, picoFallo: 110, direccion: 'lanzar',
        suelo: p => `<rect y="252" width="400" height="38" fill="${p.suelo}"/><rect y="252" width="400" height="2.5" fill="${p.raya}"/>`,
        obj: p => `${circ(0, 0, 58, p.t)}${circ(0, 0, 53, p.b)}${circ(0, 0, 41, acento(p))}${circ(0, 0, 29, p.b)}${circ(0, 0, 17, acento(p))}${circ(0, 0, 6, p.c)}`,
        proyectil: t => ({
            svg: `<path d="M0-24L3-10V14L9 26H-9L-3 14V-10z" fill="${t.p.t}"/><path d="M-9 26L0 18 9 26 0 32z" fill="${acento(t.p)}"/>`,
            w: 28, h: 62, vb: '-14 -26 28 62',
        }),
    },
    FISH: {
        instruccion: 'Tocá para soltar el anzuelo', centro: 196, origenSvg: 46, amplitud: 34, destinoY: 82, pico: 0, picoFallo: 0, direccion: 'soltar',
        suelo: p => `<rect y="96" width="400" height="194" fill="${p.agua}"/><path d="M0 96q25-9 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0v14H0z" fill="${p.agua2}"/>${[[60, 160], [330, 140], [110, 250], [300, 256]].map(([x, y]) => `<path d="M${x} ${y}q10-6 20 0t20 0" stroke="${p.b}" stroke-opacity=".4" stroke-width="1.5" fill="none"/>`).join('')}<path d="M0 290v-16q50-14 100 0t100 0 100 0 100 0v16z" fill="${p.agua2}"/><rect x="198" y="0" width="4" height="26" fill="${p.t}"/>`,
        obj: (p, estado) => `<g transform="rotate(${estado === 'acierto' ? -14 : 0})"><path d="M-38 0L-58-16V16z" fill="${p.c}"/><ellipse rx="42" ry="22" fill="${p.a === '#FFFFFF' ? '#fff' : p.a}"/><path d="M-6-21Q4-34 16-19z" fill="${p.c}"/>${circ(24, -6, 4.5, '#fff')}${circ(25, -6, 2.2, '#111')}<path d="M6-10Q14 0 6 10" stroke="${p.b}" stroke-width="1.6" fill="none"/></g>`,
        // La línea sube mucho más allá del SVG: la escena la recorta arriba.
        proyectil: t => ({
            svg: `<path d="M0-320V-16" stroke="${t.p.t}" stroke-width="1.5"/><path d="M0-16V4A8 8 0 0 1-14 8" stroke="${t.p.t}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
            w: 32, h: 72, vb: '-16 -60 32 72',
        }),
    },
    GOLF: {
        instruccion: 'Tocá para pegarle', centro: 176, origenSvg: 46, amplitud: 33, destinoY: 102, pico: 110, picoFallo: 130, direccion: 'lanzar',
        suelo: p => `<path d="M0 150Q100 122 200 142T400 134V290H0z" fill="${p.suelo}"/><path d="M0 222Q120 196 230 216T400 208V290H0z" fill="${p.suelo2}"/><path d="M0 150Q100 122 200 142T400 134" stroke="${p.raya}" stroke-width="2" fill="none"/>`,
        obj: p => `<ellipse rx="26" ry="9" fill="#10161c"/><rect x="-1.5" y="-72" width="3" height="72" fill="${p.t}"/><path d="M1.5-72L38-60 1.5-48z" fill="${acento(p)}"/>`,
        frente: p => `<path d="M-26 0A26 9 0 0 0 26 0" stroke="${p.raya}" stroke-width="2" fill="none"/>`,
        proyectil: t => ({ svg: circ(0, 0, 10, '#fff', `stroke="${t.p.t}" stroke-width="1.2"`), w: 24, h: 24, vb: '-12 -12 24 24' }),
    },
    CUT: {
        // La caja mide exactamente la zona de acierto (38%-62% de 400px): lo
        // que se ve es el margen que se tiene.
        instruccion: 'Tocá para cortar el hilo', centro: 28, origenSvg: 0, amplitud: 34, destinoY: 28, pico: 0, picoFallo: 0, direccion: 'cortar', ritmo: 'irregular',
        suelo: p => `<rect y="270" width="400" height="20" fill="${p.suelo}"/><rect y="270" width="400" height="2.5" fill="${p.raya}"/><rect x="152" y="232" width="96" height="16" fill="rgba(0,0,0,.35)"/>`,
        obj: (p, estado, etiqueta) => {
            const suelto = estado !== 'moviendo'
            return `<g transform="translate(0 ${suelto ? -10 : 0})"><ellipse cy="34" rx="31" ry="38" fill="${p.a === '#FFFFFF' ? '#fff' : p.a}"/><path d="M-5 72h10l-5-7z" fill="${acento(p)}"/><path d="M-15 14Q-20 30-12 42" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none"/></g>${suelto ? '' : `<path d="M0 72V106" stroke="${p.t}" stroke-width="1.4"/>${etiquetaSvg(p, etiqueta, 106)}`}`
        },
        fijoFrente: p => `<rect x="150" y="240" width="100" height="32" rx="2" fill="${p.c}"/><rect x="191" y="240" width="18" height="32" fill="${p.b}" opacity=".85"/><rect x="146" y="236" width="108" height="7" rx="2" fill="${acento(p)}"/>`,
        proyectil: (t, etiqueta) => ({ svg: etiquetaSvg(t.p, etiqueta, 0), w: 54, h: 30, vb: '-27 -2 54 30' }),
    },
}

const defs = (t: Tematica) => {
    if (t.filtro === 'papel') return '<defs><filter id="promoPapel" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.2" flood-color="#3a2e1c" flood-opacity=".38"/></filter></defs>'
    if (t.filtro === 'tiza') return '<defs><filter id="promoTiza" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs>'
    return ''
}
const attrFiltro = (t: Tematica) => (t.filtro === 'papel' ? 'filter="url(#promoPapel)"' : t.filtro === 'tiza' ? 'filter="url(#promoTiza)"' : '')
const attrTrazo = (t: Tematica) => (t.trazo ? `stroke="${t.trazo.color}" stroke-width="${t.trazo.ancho}"` : '')

// Los dibujos salen del catálogo; lo único variable es la etiqueta del premio,
// que pasa por escaparTexto.
const Svg = ({ html, w, h, vb, style }: { html: string; w: number | string; h: number | string; vb: string; style?: React.CSSProperties }) => (
    <svg width={w} height={h} viewBox={vb} fill="none" style={{ display: 'block', overflow: 'visible', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
)

const cache = new Map<string, EscenaConfig>()

// Con cache porque React compara los componentes por identidad: si esto armara
// uno nuevo en cada render, la escena se remontaría en cada cuadro del juego.
export function escenaDe(tipo: string, temaId?: string | null): EscenaConfig {
    const original = ESCENAS[tipo] ?? ESCENAS.HOOP
    if (!esTematicaConPiel(temaId)) return original
    const juego = JUEGOS[tipo] ?? JUEGOS.HOOP
    const clave = `${ESCENAS[tipo] ? tipo : 'HOOP'}:${temaId}`
    const hecha = cache.get(clave)
    if (hecha) return hecha

    const t = tematicaDe(temaId)!
    const p = t.p
    const filtro = attrFiltro(t), trazo = attrTrazo(t)
    const altoObj = 180
    const vbObj = `-100 ${-juego.origenSvg} 200 ${altoObj}`
    const envolver = (s: string) => `${defs(t)}<g ${trazo} ${filtro}>${s}</g>`
    // La trama de la risografía va por encima de todo, proyectil incluido.
    const trama = t.trama ? '<defs><pattern id="promoPuntos" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.05" fill="#1D2F8F" opacity=".5"/></pattern></defs><rect width="400" height="290" fill="url(#promoPuntos)" style="mix-blend-mode:multiply"/>' : ''

    const Fondo = (): ReactElement => (
        <Svg w="100%" h="100%" vb={`0 0 ${ANCHO_DISENO} ${ALTO_ESCENA}`} style={{ position: 'absolute', inset: 0 }}
            html={`${defs(t)}<rect width="400" height="290" fill="${p.cielo}"/><g ${t.filtro === 'tiza' ? filtro : ''}>${t.decor(p)}</g><g ${trazo} ${t.filtro === 'tiza' ? filtro : ''}>${juego.suelo(p)}</g>`} />
    )
    const fijo = juego.fijoFrente ? envolver(juego.fijoFrente(p)) : ''
    const FondoFrente = fijo || trama
        ? (): ReactElement => (
            <Svg w="100%" h="100%" vb={`0 0 ${ANCHO_DISENO} ${ALTO_ESCENA}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} html={fijo + trama} />
        )
        : undefined
    const Objetivo = ({ estado, etiqueta }: { estado: EstadoTiro; etiqueta?: string }): ReactElement => (
        <Svg w={200} h={altoObj} vb={vbObj} html={envolver(juego.obj(p, estado, etiqueta ?? '%'))} />
    )
    const ObjetivoFrente = juego.frente
        ? (): ReactElement => <Svg w={200} h={altoObj} vb={vbObj} html={envolver(juego.frente!(p))} />
        : undefined
    const Proyectil = ({ etiqueta }: { estado: EstadoTiro; etiqueta?: string }): ReactElement => {
        const x = juego.proyectil(t, etiqueta ?? '%')
        return <Svg w={x.w} h={x.h} vb={x.vb} html={`<g ${trazo}>${x.svg}</g>`} />
    }

    const escena: EscenaConfig = {
        instruccion: juego.instruccion,
        objetivoTop: juego.centro - juego.origenSvg,
        amplitud: juego.amplitud, destinoY: juego.destinoY, pico: juego.pico, picoFallo: juego.picoFallo,
        direccion: juego.direccion, ritmo: juego.ritmo,
        Fondo, FondoFrente, Objetivo, ObjetivoFrente, Proyectil,
    }
    cache.set(clave, escena)
    return escena
}

// Miniatura quieta de la escena, para las galerías del panel. Dibuja con los
// mismos componentes que el juego real y escala el lienzo al ancho disponible.
export function MiniEscena({ tipo, tema, posicion = 56 }: { tipo: string; tema?: string | null; posicion?: number }) {
    const ref = useRef<HTMLDivElement>(null)
    const [escala, setEscala] = useState(0.3)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const medir = () => { if (el.clientWidth) setEscala(el.clientWidth / ANCHO_DISENO) }
        medir()
        if (typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(medir)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    const e = escenaDe(tipo, tema)
    const { Fondo, FondoFrente, Objetivo, ObjetivoFrente } = e
    const capa: React.CSSProperties = { position: 'absolute', left: `${posicion}%`, top: e.objetivoTop, transform: 'translateX(-50%)' }
    return (
        <div ref={ref} aria-hidden="true" style={{ position: 'relative', width: '100%', aspectRatio: `${ANCHO_DISENO} / ${ALTO_ESCENA}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: ANCHO_DISENO, height: ALTO_ESCENA, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
                <Fondo />
                <div style={capa}><Objetivo estado="moviendo" etiqueta="%" /></div>
                {FondoFrente && <FondoFrente />}
                {ObjetivoFrente && <div style={capa}><ObjetivoFrente estado="moviendo" /></div>}
            </div>
        </div>
    )
}
