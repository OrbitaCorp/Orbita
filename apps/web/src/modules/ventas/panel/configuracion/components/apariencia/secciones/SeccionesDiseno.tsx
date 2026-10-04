// Paleta de colores y tipografía: solo se editan sin plantilla activa.

import { Droplets, Monitor, Moon, Sun, Type } from 'lucide-react'
import { GOOGLE_FONTS, fontStack, type EscalaFuente, type ModoColor } from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES } from '../ayudas'
import { ColorBlock, FondoTiendaBlock } from '../ColorPickers'
import { Divider, FieldLabel, SecCard } from '../Controles'
import { FontSelect } from '../FontSelect'
import type { IconT, PropsSeccion } from '../utils'

const fontOpts = Object.keys(GOOGLE_FONTS)

export function SeccionPaleta({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-paleta" title="Paleta de colores" icon={Droplets} ayuda={AYUDA_SECCIONES.paleta}>
            <FieldLabel>Modo de color de la tienda</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                {([['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon], ['sistema', 'Sistema', Monitor]] as [ModoColor, string, IconT][]).map(([id, l, I]) => {
                    const a = ap.modoColor === id
                    return (
                        <button key={id} onClick={() => set('modoColor', id)} className="ds-hover" style={{ padding: '14px 8px', borderRadius: 10, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <I size={18} strokeWidth={1.6} style={{ color: a ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                            <span style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)' }}>{l}</span>
                        </button>
                    )
                })}
            </div>
            <ColorBlock label="Color primario" help="Botones, links y elementos de acción" value={ap.colorPrimario} onChange={v => set('colorPrimario', v)} />
            <ColorBlock label="Color secundario" help="Textos y fondos oscuros" value={ap.colorSecundario} onChange={v => set('colorSecundario', v)} />
            <ColorBlock label="Color de acento" help="Badges y highlights" value={ap.colorAccent} onChange={v => set('colorAccent', v)} />
            <FondoTiendaBlock value={ap.colorFondo} colorPrimario={ap.colorPrimario} onChange={v => set('colorFondo', v)} />
        </SecCard>
    )
}

export function SeccionTipografia({ ap, set }: PropsSeccion) {
    return (
        <SecCard id="ap-sec-tipografia" title="Tipografía" icon={Type} ayuda={AYUDA_SECCIONES.tipografia}>
            <FieldLabel>Fuente para títulos</FieldLabel>
            <FontSelect value={ap.fuenteHeading} onChange={v => set('fuenteHeading', v)} opts={fontOpts} />
            <div style={{ marginTop: 12, marginBottom: 18, padding: '14px 16px', background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', fontFamily: fontStack(ap.fuenteHeading) }}>{ap.nombreTienda}</div>
            <FieldLabel>Fuente para textos</FieldLabel>
            <FontSelect value={ap.fuenteBody} onChange={v => set('fuenteBody', v)} opts={fontOpts} />
            <Divider />
            <FieldLabel>Escala de texto</FieldLabel>
            <div style={{ display: 'flex', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
                {([['sm', 'Pequeño'], ['md', 'Mediano'], ['lg', 'Grande']] as [EscalaFuente, string][]).map(([id, l]) => {
                    const a = ap.escalaFuente === id
                    return <button key={id} onClick={() => set('escalaFuente', id)} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 5, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{l}</button>
                })}
            </div>
        </SecCard>
    )
}
