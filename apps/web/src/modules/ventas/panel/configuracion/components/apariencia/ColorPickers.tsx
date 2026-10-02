// Los selectores de color de Apariencia: paleta, fondo de tienda y fondo de slide.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { onColorPara } from '@/lib/storefront/primarioTema'
import { PRESET_COLORS } from '../../mock/apariencia.mock'
import { FieldLabel, Inp } from './Controles'

// Swatch de los pickers "Personalizado" de acá abajo — un <input
// type="color"> real, no un <span> decorativo: pedido explícito, "no tiene
// que ingresar hexadecimal, es más fácil que con una paleta de colores
// elija". El navegador ya trae su propio selector visual (paleta/rueda de
// color del sistema) con solo hacerle click — no hay que armar uno de
// cero. El campo de hex de al lado (<Inp>) se mantiene: sigue sirviendo
// para pegar un color de marca exacto, que un picker visual no siempre
// permite escribir a mano con precisión.
function ColorSwatchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="color"
            title="Elegir de la paleta"
            value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'}
            onChange={e => onChange(e.target.value.toUpperCase())}
            style={{ width: 20, height: 20, flexShrink: 0 }}
        />
    )
}

export function ColorBlock({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(!PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help={help}>{label}</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ marginBottom: 10, maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<ColorSwatchInput value={value} onChange={onChange} />} />
                </div>
            )}
            <button style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: value, color: onColorPara(value), fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'background 150ms, color 150ms' }}>Botón de ejemplo</button>
        </div>
    )
}

// Fondo de tienda — 3 presets fijos, sin "Personalizado". Hubo una vuelta
// (bug real, reportado: guardaba literalmente el string 'custom' en vez de
// un color, ver historial) donde se le sumó un picker de color libre igual
// al de ColorBlock/SlideBgColorPicker — pedido explícito después de verlo:
// sacarlo del todo. El fondo de página se queda acotado a estas 3 opciones
// a propósito (a diferencia de primario/secundario/acento, que sí son
// libres): son las únicas que se sabe de antemano que no rompen contraste
// con el resto de la paleta.
export function FondoTiendaBlock({ value, colorPrimario, onChange }: { value: string; colorPrimario: string; onChange: (v: string) => void }) {
    const presets: [string, string][] = [['#FFFFFF', 'Blanco puro'], ['#F8FAFC', 'Gris suave'], [colorPrimario + '0D', 'Primario 5%']]
    return (
        <>
            <FieldLabel>Fondo de tienda</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {presets.map(([c, l]) => {
                    const a = value === c
                    return (
                        <button key={l} onClick={() => onChange(c)} className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <span style={{ width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid var(--color-border)', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--color-body)' }}>{l}</span>
                        </button>
                    )
                })}
            </div>
        </>
    )
}

// Color de fondo propio del slide — variante de ColorBlock con un chip extra
// para volver a "sin color" (cae al degradé de tema, comportamiento de siempre).
export function SlideBgColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(value !== '' && !PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help="Si no elegís uno, se usa el degradé del tema como hasta ahora">Color de fondo del slide</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => { onChange(''); setCustom(false) }} title="Usar degradé del tema"
                    className="ds-hover"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${value === '' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <X size={13} style={{ color: 'var(--color-muted)' }} />
                </button>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<ColorSwatchInput value={value} onChange={onChange} />} />
                </div>
            )}
        </div>
    )
}
