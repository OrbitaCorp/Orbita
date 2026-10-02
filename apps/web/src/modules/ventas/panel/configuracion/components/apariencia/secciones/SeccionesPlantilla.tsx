import { LayoutGrid } from 'lucide-react'
import type { ApiCategory, ApiProductListItem } from '@/lib/api'
import type { seccionesDe } from '@/modules/ventas/panel/avanzado/plantillas/secciones'
import type { CampoSeccion } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import { FieldLabel, Inp, SecCard, ToggleRow } from '../Controles'
import { ImgUploader } from '../ImgUploader'
import { subirImagenApariencia, type PropsSeccion } from '../utils'

// Secciones propias de la plantilla activa. El formulario no está escrito
// a mano: lo dibuja el esquema que declara cada plantilla (secciones.ts),
// porque no hay dos que tengan las mismas secciones ni en el mismo orden.
// Lo que se escribe acá se guarda en homeTemplateData.secciones y lo lee
// el bloque de esa plantilla en homes.tsx (helper `txt()`), que cae al
// texto de la maqueta cuando el campo está vacío.
// Los campos arrancan con el contenido real con el que se diseñó la
// sección (`porDefecto` en secciones.ts), no vacíos: así el dueño ve qué
// está por cambiar, y para retocar una palabra no tiene que reescribir
// toda la frase (pedido explícito, con capturas del editor de Premium en
// blanco mientras la tienda mostraba texto). Vaciar un campo lo saca del
// guardado y la portada vuelve a ese mismo texto — ver limpiarSecciones().
// ...con UNA excepción: los campos marcados como `afirmacion` (un
// descuento, un envío gratis, una cantidad — ver tipos.ts). Esos NO se
// precargan: si vinieran con el ejemplo puesto, guardar sin tocarlos
// alcanzaría para prometerle al comprador algo que el negocio nunca dijo.
// El ejemplo se sigue viendo, pero como placeholder: se lee, no se guarda.
export function SeccionesPlantilla({ ap, set, seccionesPlantilla, categorias, productos, onToast }: PropsSeccion & {
    seccionesPlantilla: ReturnType<typeof seccionesDe>
    categorias: ApiCategory[]
    productos: ApiProductListItem[]
    onToast: (m: string) => void
}) {
    const valorSeccion = (seccion: string, campo: CampoSeccion) => {
        const guardado = ap.seccionesPlantilla?.[seccion]?.[campo.id]
        if (guardado !== undefined) return guardado
        if (campo.afirmacion) return ''
        // La versión neutra cuando existe: el editor edita la TIENDA, no la
        // vitrina, así que tiene que mostrar el mismo texto que el cliente ve.
        return campo.porDefectoReal ?? campo.porDefecto ?? ''
    }
    const pistaSeccion = (campo: CampoSeccion) =>
        campo.afirmacion ? (campo.porDefecto ? `Ej: ${campo.porDefecto}` : '') : undefined
    const setSeccion = (seccion: string, campo: string, valor: string) => {
        const actual = ap.seccionesPlantilla ?? {}
        set('seccionesPlantilla', {
            ...actual,
            [seccion]: { ...(actual[seccion] ?? {}), [campo]: valor },
        })
    }

    return (
        <>
            {seccionesPlantilla.map(sec => (
                <SecCard key={sec.id} id={`ap-sec-${sec.id}`} title={sec.nombre} icon={LayoutGrid}>
                    {sec.nota && (
                        <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>{sec.nota}</p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {sec.campos.map(campo => campo.tipo === 'switch' ? (
                            // El interruptor trae su propio label (ToggleRow), así que
                            // no se le pone FieldLabel encima como al resto.
                            <div key={campo.id}>
                                <ToggleRow
                                    label={campo.label}
                                    on={valorSeccion(sec.id, campo) === 'si'}
                                    onChange={v => setSeccion(sec.id, campo.id, v ? 'si' : '')}
                                />
                                {campo.help && (
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -4, lineHeight: 1.45 }}>{campo.help}</div>
                                )}
                            </div>
                        ) : (
                            <div key={campo.id}>
                                <FieldLabel help={campo.help}>{campo.label}</FieldLabel>
                                {campo.tipo === 'imagen' ? (
                                    <ImgUploader
                                        value={valorSeccion(sec.id, campo) || null}
                                        onChange={v => setSeccion(sec.id, campo.id, v ?? '')}
                                        onUpload={subirImagenApariencia}
                                        shape="square"
                                        size={80}
                                        formats="JPG, PNG o HEIC · máx 10MB"
                                        onToast={onToast}
                                    />
                                ) : campo.tipo === 'parrafo' ? (
                                    <textarea
                                        value={valorSeccion(sec.id, campo)}
                                        onChange={e => setSeccion(sec.id, campo.id, e.target.value)}
                                        maxLength={campo.max}
                                        placeholder={pistaSeccion(campo)}
                                        rows={3}
                                        style={{
                                            width: '100%', borderRadius: 8, border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg)', color: 'var(--color-text)',
                                            padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit',
                                            lineHeight: 1.55, resize: 'vertical',
                                        }}
                                    />
                                ) : campo.tipo === 'seleccion' ? (
                                    /* Elegir del catálogo real. Sin elegir nada la
                                       sección no se dibuja en la portada — es a
                                       propósito: antes se rellenaba sola con las
                                       primeras categorías, que no significaba nada. */
                                    <select
                                        className="ds-field"
                                        value={valorSeccion(sec.id, campo)}
                                        onChange={e => setSeccion(sec.id, campo.id, e.target.value)}
                                        style={{
                                            width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
                                            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                            color: 'var(--color-text)', fontSize: 14, fontFamily: 'inherit',
                                        }}
                                    >
                                        <option value="">— Sin elegir —</option>
                                        {categorias.length > 0 && (
                                            <optgroup label="Categorías">
                                                {categorias.map(c => <option key={c.id} value={`cat:${c.slug}`}>{c.name}</option>)}
                                            </optgroup>
                                        )}
                                        {productos.length > 0 && (
                                            <optgroup label="Productos">
                                                {productos.map(pr => <option key={pr.id} value={`prod:${pr.id}`}>{pr.name}</option>)}
                                            </optgroup>
                                        )}
                                    </select>
                                ) : (
                                    <Inp value={valorSeccion(sec.id, campo)} onChange={v => setSeccion(sec.id, campo.id, v)} maxLength={campo.max} placeholder={pistaSeccion(campo)} />
                                )}
                            </div>
                        ))}
                    </div>
                </SecCard>
            ))}
        </>
    )
}
