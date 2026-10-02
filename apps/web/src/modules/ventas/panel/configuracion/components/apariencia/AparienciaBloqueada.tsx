// Lo que muestra Apariencia mientras hay una plantilla de Home activa: la
// pantalla queda bloqueada y solo ofrece volver a la apariencia clásica.

import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, panelSetHomeTemplate } from '@/lib/api'
import { pageWrap } from './utils'

// Nombre visible de cada plantilla de Home enganchada de verdad (ver
// panel/avanzado/plantillas/datos.tsx para el catálogo completo — acá solo
// va la que ya tiene lógica real detrás, hoy nada más que Vidriera).
const NOMBRE_PLANTILLA: Record<string, string> = { vidriera: 'Vidriera' }

export function AparienciaBloqueada({ homeTemplate, onVolvio, onToast }: {
    homeTemplate: string
    // La plantilla ya se desactivó: Apariencia vuelve a mostrar el editor.
    onVolvio: () => void
    onToast: (m: string) => void
}) {
    const [modalVolver, setModalVolver] = useState(false)
    const [volviendo, setVolviendo] = useState(false)

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
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Apariencia pública</h1>
            <Card style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                        <LayoutTemplate size={19} strokeWidth={1.8} color="var(--color-primary)" />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                        Estás usando la plantilla {NOMBRE_PLANTILLA[homeTemplate] ?? homeTemplate}
                    </div>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 16 }}>
                    Mientras la plantilla esté activa, el home de tu tienda lo dibuja ella — esta pantalla
                    queda bloqueada para no editar algo que no se va a ver. El anuncio, el hero y la barra de
                    confianza se editan desde <strong>Avanzado → Plantillas</strong>, ahí mismo donde la activaste.
                </div>
                <div>
                    <Button variant="secondary" loading={volviendo} onClick={() => setModalVolver(true)}>
                        Volver a la apariencia clásica
                    </Button>
                </div>
            </Card>

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
                    Tu tienda deja de usar la plantilla {NOMBRE_PLANTILLA[homeTemplate] ?? homeTemplate} y vuelve al
                    home de siempre. Podés volver a activarla cuando quieras desde Avanzado → Plantillas — no se
                    pierde nada de lo que cargaste ahí.
                </div>
            </Modal>
        </div>
    )
}
