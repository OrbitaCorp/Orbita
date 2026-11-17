// Lo que muestra Apariencia mientras hay una plantilla de Home activa: cuál es,
// cómo volver a la apariencia clásica y, debajo (children), el editor de su
// contenido — el mismo de Avanzado → Plantillas (Apariencia con soloContenido).
//
// Antes era solo un cartel que mandaba a Avanzado → Plantillas a editar. Desde
// que el plan Base puede usar las plantillas libres (ver plantillas/libres.ts)
// eso no alcanza: el plan Base no entra a Avanzado, así que acá tiene que poder
// editar el contenido y volver a la clásica.

import { useState, type ReactNode } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, panelSetHomeTemplate } from '@/lib/api'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { pageWrap } from './utils'

export function AparienciaBloqueada({ homeTemplate, onVolvio, onToast, children }: {
    homeTemplate: string
    // La plantilla ya se desactivó: Apariencia vuelve a mostrar el editor.
    onVolvio: () => void
    onToast: (m: string) => void
    children?: ReactNode
}) {
    const [modalVolver, setModalVolver] = useState(false)
    const [volviendo, setVolviendo] = useState(false)
    const nombre = PLANTILLAS.find(x => x.id === homeTemplate)?.nombre ?? homeTemplate

    async function volverAApariencia() {
        setModalVolver(false)
        setVolviendo(true)
        try {
            await panelSetHomeTemplate(null)
            onVolvio()
            onToast('Volviste a la apariencia clásica')
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo desactivar la plantilla')
        } finally {
            setVolviendo(false)
        }
    }

    return (
        <div style={pageWrap}>
            <div style={{ maxWidth: 880, margin: '0 auto' }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Apariencia pública</h1>
                <Card style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
                    <LayoutTemplate size={18} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Tu tienda usa la plantilla {nombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, marginTop: 2 }}>
                            Los colores, las letras y el diseño de la portada los pone ella. Acá abajo editás su contenido.
                        </div>
                    </div>
                    <Button variant="secondary" loading={volviendo} onClick={() => setModalVolver(true)}>
                        Volver a la apariencia clásica
                    </Button>
                </Card>
            </div>

            {children && (
                <div style={{ maxWidth: 880, margin: '0 auto', border: '1px solid var(--color-border)', borderRadius: 12 }}>
                    {children}
                </div>
            )}

            <Modal
                isOpen={modalVolver}
                onClose={() => setModalVolver(false)}
                title="¿Volver a la apariencia clásica?"
                footer={<>
                    <Button variant="secondary" onClick={() => setModalVolver(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={volverAApariencia}>Sí, volver</Button>
                </>}
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    Tu tienda deja de usar la plantilla {nombre} y vuelve al home de siempre, con tus colores y tu
                    diseño de Apariencia. Podés volver a activarla cuando quieras desde Plantillas por defecto: no
                    se pierde nada de lo que cargaste.
                </div>
            </Modal>
        </div>
    )
}
