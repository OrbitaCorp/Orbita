// Piezas de presentación del Manual — dibujan los bloques de contenido.ts.
//
// Ninguna tiene texto propio: todo el copy vive en contenido.ts. Acá solo
// está la forma.
//
// Criterio visual (vale para todo el módulo): esto es un documento, no un
// tablero. La jerarquía la hace la TIPOGRAFÍA y el aire — no las cajas de
// colores. Dos únicos colores con significado: el gris del texto y el azul
// de marca, y el azul solo donde se puede hacer clic. Nada de tarjetas con
// ícono tintado, badges en mayúscula ni una paleta distinta por capítulo:
// trece acentos distintos en una misma página no jerarquizan nada, solo
// hacen ruido.

import { useRouter } from 'next/router'
import { ArrowRight, Lightbulb, AlertTriangle, Info } from 'lucide-react'
import { adminPath, currentSlug } from '@/lib/tenant'
import type { Bloque, Destino } from './contenido'

// ─── Texto con **negrita** ───────────────────────────────────────────────────
// El contenido se escribe en texto plano para que se pueda editar sin tocar
// JSX; los dobles asteriscos son lo único que interpreta el manual.
export function TextoRico({ texto }: { texto: string }) {
    const partes = texto.split(/(\*\*[^*]+\*\*)/g)
    return (
        <>
            {partes.map((p, i) =>
                p.startsWith('**') && p.endsWith('**') && p.length > 4
                    ? <strong key={i} style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.slice(2, -2)}</strong>
                    : <span key={i}>{p}</span>
            )}
        </>
    )
}

// ─── Enlace "Ir a…" ──────────────────────────────────────────────────────────
// Un enlace, no un botón: en un documento, "andá a esta pantalla" es una
// remisión, y un botón con borde compite con el texto que lo rodea.
export function EnlaceIr({ destino }: { destino: Destino }) {
    const router = useRouter()

    function ir() {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        void router.push({
            pathname: adminPath(negocioId, moduloPadre, destino.seccion),
            ...(destino.query ? { query: destino.query } : {}),
        })
    }

    return (
        <button type="button" className="man-ir" onClick={ir}>
            {destino.label}
            <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
        </button>
    )
}

// ─── Bloques ─────────────────────────────────────────────────────────────────

const TEXTO: React.CSSProperties = {
    fontSize: 14, lineHeight: 1.72, color: 'var(--color-body)',
}

function Parrafo({ texto }: { texto: string }) {
    return <p style={{ ...TEXTO, margin: 0 }}><TextoRico texto={texto} /></p>
}

function Lista({ items }: { items: string[] }) {
    return (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    {/* Raya al margen en vez de viñeta de color: marca el ítem
                        sin sumar un punto de color por renglón. */}
                    <span aria-hidden="true" style={{
                        width: 7, height: 1, background: 'var(--color-muted)', opacity: 0.45,
                        flexShrink: 0, transform: 'translateY(-4px)',
                    }} />
                    <span style={TEXTO}><TextoRico texto={t} /></span>
                </li>
            ))}
        </ul>
    )
}

function Pasos({ items }: { items: { titulo: string; texto: string }[] }) {
    return (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {items.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                    <span style={{
                        flexShrink: 0, width: 16, textAlign: 'right',
                        fontSize: 12.5, fontWeight: 500, color: 'var(--color-muted)',
                        fontVariantNumeric: 'tabular-nums', lineHeight: 1.75,
                    }}>{i + 1}.</span>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.55 }}>{p.titulo}</div>
                        <div style={{ ...TEXTO, marginTop: 1 }}><TextoRico texto={p.texto} /></div>
                    </div>
                </li>
            ))}
        </ol>
    )
}

function Campos({ titulo, items }: { titulo?: string; items: { label: string; texto: string }[] }) {
    return (
        <div>
            {titulo && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                    {titulo}
                </div>
            )}
            <dl className="man-campos" style={{ margin: 0 }}>
                {items.map((c, i) => (
                    <div key={i}>
                        <dt>{c.label}</dt>
                        <dd style={TEXTO}><TextoRico texto={c.texto} /></dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

function Estados({ items }: { items: { label: string; color: string; texto: string }[] }) {
    return (
        <dl className="man-campos" style={{ margin: 0 }}>
            {items.map((e, i) => (
                <div key={i}>
                    <dt style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        {/* El punto lleva el color REAL que ese estado tiene en
                            la pantalla: es el dato, no decoración. El nombre
                            va escrito al lado, así el color nunca es el único
                            indicador. */}
                        <span aria-hidden="true" style={{
                            width: 6, height: 6, borderRadius: '50%', background: e.color, flexShrink: 0,
                        }} />
                        {e.label}
                    </dt>
                    <dd style={TEXTO}><TextoRico texto={e.texto} /></dd>
                </div>
            ))}
        </dl>
    )
}

const NOTA_META = {
    tip:   { Icon: Lightbulb,     regla: 'var(--color-border)', label: 'Consejo' },
    // El único color del set: un aviso que se ve igual que un consejo no es
    // un aviso. Va en la raya, sin fondo teñido.
    aviso: { Icon: AlertTriangle, regla: '#D97706',             label: 'Ojo' },
    dato:  { Icon: Info,          regla: 'var(--color-border)', label: 'Dato' },
} as const

function Nota({ variante, texto }: { variante: 'tip' | 'aviso' | 'dato'; texto: string }) {
    const { Icon, regla, label } = NOTA_META[variante]
    return (
        <div style={{
            display: 'flex', gap: 11, alignItems: 'flex-start',
            padding: '2px 0 2px 14px', borderLeft: `2px solid ${regla}`,
        }}>
            <Icon size={15} strokeWidth={1.7} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 4 }} aria-hidden="true" />
            <p style={{ ...TEXTO, margin: 0, fontSize: 13.5 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{label}. </span>
                <TextoRico texto={texto} />
            </p>
        </div>
    )
}

export function BloqueVista({ bloque }: { bloque: Bloque }) {
    switch (bloque.tipo) {
        case 'parrafo': return <Parrafo texto={bloque.texto} />
        case 'lista':   return <Lista items={bloque.items} />
        case 'pasos':   return <Pasos items={bloque.items} />
        case 'campos':  return <Campos titulo={bloque.titulo} items={bloque.items} />
        case 'estados': return <Estados items={bloque.items} />
        case 'nota':    return <Nota variante={bloque.variante} texto={bloque.texto} />
    }
}
