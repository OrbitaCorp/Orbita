import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { CfgField } from '../ConfigControls'
import { DirtyHint, ErrorInline, SectionTitle } from './comunes'
import type { ConfigGeneralState } from './useConfigGeneral'

export function SeccionContacto({ cfg }: { cfg: ConfigGeneralState }) {
    const { contacto, setContacto, soportaFiscal, cambiado, guardando, guardarContacto, errores } = cfg
    return (
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Datos de contacto</SectionTitle>
            <CfgField label="WhatsApp de atención (opcional)" value={contacto.whatsapp} onChange={v => setContacto(p => ({ ...p, whatsapp: v }))} />
            <CfgField label="Email de contacto (opcional)" value={contacto.email} onChange={v => setContacto(p => ({ ...p, email: v }))} />
            <CfgField label="Horario de atención (opcional)" value={contacto.scheduleText} onChange={v => setContacto(p => ({ ...p, scheduleText: v }))} />
            {soportaFiscal && (
                <>
                    <SectionTitle>Datos fiscales</SectionTitle>
                    <p style={{ margin: '-6px 0 10px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                        Aparecen en los Términos y la Política de privacidad de tu tienda: la normativa de comercio electrónico pide identificar al vendedor.
                    </p>
                    {/* Sin "(opcional)" a propósito: no bloquean el guardado (la
                        validación los deja vacíos, y sin CUIT el documento legal
                        queda solo con la razón social), pero el párrafo de arriba ya
                        avisa que la normativa los pide — ponerles "opcional" al lado
                        contradiría esa advertencia. */}
                    <CfgField label="Razón social" value={contacto.legalName} placeholder="Ej. Zapatos Lorena S.R.L." onChange={v => setContacto(p => ({ ...p, legalName: v }))} />
                    <CfgField label="CUIT/CUIL" value={contacto.cuit} placeholder="Ej. 30-71234567-1" onChange={v => setContacto(p => ({ ...p, cuit: v }))} />
                </>
            )}
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <DirtyHint show={cambiado('contacto', contacto)} />
                <Button variant="primary" loading={guardando === 'contacto'} disabled={!cambiado('contacto', contacto)} onClick={guardarContacto}>Guardar cambios</Button>
                <ErrorInline msg={errores.contacto} />
            </div>
        </Card>
    )
}

export function SeccionRedes({ cfg }: { cfg: ConfigGeneralState }) {
    const { redes, setRedes, cambiado, guardando, guardarRedes, errores } = cfg
    return (
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Redes sociales</SectionTitle>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -6, marginBottom: 14 }}>
                Solo tu usuario (sin @) — también podés pegar el link completo si preferís, las dos formas andan.
            </div>
            {/* Ninguna red es obligatoria — un negocio puede no tener las tres, o
                ninguna. Mismo criterio que Envíos: "(opcional)" en el label. */}
            <CfgField label="Instagram (opcional)" placeholder="mi_negocio" value={redes.instagram} onChange={v => setRedes(p => ({ ...p, instagram: v }))} />
            <CfgField label="TikTok (opcional)" placeholder="mi_negocio" value={redes.tiktok} onChange={v => setRedes(p => ({ ...p, tiktok: v }))} />
            <CfgField label="Facebook (opcional)" placeholder="mi.negocio" value={redes.facebook} onChange={v => setRedes(p => ({ ...p, facebook: v }))} />
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <DirtyHint show={cambiado('redes', redes)} />
                <Button variant="primary" loading={guardando === 'redes'} disabled={!cambiado('redes', redes)} onClick={guardarRedes}>Guardar cambios</Button>
                <ErrorInline msg={errores.redes} />
            </div>
        </Card>
    )
}
