// Piezas de presentación del Manual — dibujan los bloques de contenido.ts.
//
// Ninguna tiene texto propio: todo el copy vive en contenido.ts. Acá solo
// está la forma. Mismo criterio de estilo que el resto del panel (inline
// styles + variables de globals.css, así el modo oscuro sale gratis).

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

// ─── Botón "Ir a…" ───────────────────────────────────────────────────────────
export function BotonIr({ destino, compacto }: { destino: Destino; compacto?: boolean }) {
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
        <button
            className="ds-hover man-ir"
            onClick={ir}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                // 36px de alto + padding generoso: entra cómodo el dedo en celular.
                minHeight: compacto ? 34 : 38, padding: compacto ? '0 12px' : '0 14px',
                borderRadius: 9, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-primary)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                transition: 'background 180ms ease, border-color 180ms ease',
            }}
        >
            {destino.label}
            <ArrowRight size={14} strokeWidth={2.2} />
        </button>
    )
}

// ─── Bloques ─────────────────────────────────────────────────────────────────

const TEXTO_BASE: React.CSSProperties = {
    fontSize: 14, lineHeight: 1.7, color: 'var(--color-body)',
    // 68ch: el largo de renglón que se lee sin perder el hilo (línea del
    // design system; en pantallas anchas la columna no se estira sola).
    maxWidth: '68ch',
}

function Parrafo({ texto }: { texto: string }) {
    return <p style={{ ...TEXTO_BASE, margin: 0 }}><TextoRico texto={texto} /></p>
}

function Lista({ items }: { items: string[] }) {
    return (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span aria-hidden="true" style={{
                        width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)',
                        flexShrink: 0, marginTop: 9,
                    }} />
                    <span style={TEXTO_BASE}><TextoRico texto={t} /></span>
                </li>
            ))}
        </ul>
    )
}

function Pasos({ items }: { items: { titulo: string; texto: string }[] }) {
    return (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                        display: 'grid', placeItems: 'center',
                        background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                        fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>{p.titulo}</div>
                        <div style={{ ...TEXTO_BASE, fontSize: 13.5, marginTop: 2 }}><TextoRico texto={p.texto} /></div>
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
                <div style={{
                    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--color-muted)', marginBottom: 10,
                }}>{titulo}</div>
            )}
            <dl className="man-campos" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {items.map((c, i) => (
                    <div key={i} style={{
                        display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 16,
                        padding: '11px 0',
                        borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    }}>
                        <dt style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>{c.label}</dt>
                        <dd style={{ ...TEXTO_BASE, fontSize: 13.5, margin: 0 }}><TextoRico texto={c.texto} /></dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

function Estados({ items }: { items: { label: string; color: string; texto: string }[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        height: 24, padding: '0 10px', borderRadius: 9999,
                        background: `color-mix(in srgb, ${e.color} 13%, transparent)`,
                        // El color no es el único indicador: el chip también
                        // lleva su nombre escrito (regla de accesibilidad).
                        border: `1px solid color-mix(in srgb, ${e.color} 35%, transparent)`,
                        color: e.color, fontSize: 12, fontWeight: 600, minWidth: 96, justifyContent: 'center',
                    }}>
                        <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                        {e.label}
                    </span>
                    <span style={{ ...TEXTO_BASE, fontSize: 13.5, flex: '1 1 260px' }}><TextoRico texto={e.texto} /></span>
                </div>
            ))}
        </div>
    )
}

const NOTA_META = {
    tip:   { Icon: Lightbulb,     color: '#2563EB', label: 'Consejo' },
    aviso: { Icon: AlertTriangle, color: '#D97706', label: 'Ojo' },
    dato:  { Icon: Info,          color: '#0891B2', label: 'Dato' },
} as const

function Nota({ variante, texto }: { variante: 'tip' | 'aviso' | 'dato'; texto: string }) {
    const { Icon, color, label } = NOTA_META[variante]
    return (
        <div style={{
            display: 'flex', gap: 11, alignItems: 'flex-start',
            padding: '12px 14px', borderRadius: 10,
            background: `color-mix(in srgb, ${color} 7%, var(--color-surface))`,
            // Barra lateral además del fondo: en modo oscuro un fondo teñido
            // al 7% casi no se distingue, la barra sí.
            borderLeft: `3px solid ${color}`,
            border: '1px solid var(--color-border)', borderLeftWidth: 3, borderLeftColor: color,
        }}>
            <Icon size={16} strokeWidth={2} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color, marginRight: 8 }}>{label}</span>
                <span style={{ ...TEXTO_BASE, fontSize: 13.5, display: 'inline' }}><TextoRico texto={texto} /></span>
            </div>
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
