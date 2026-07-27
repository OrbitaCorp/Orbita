// src/modules/ventas/panel/catalogo/ProductoNuevo.tsx — Vista P2
// Alta y edición de producto (RBT-302 / RBT-303).
//
// Los pasos están ordenados así a propósito: las variantes se definen ANTES de
// las imágenes porque cada foto se asocia a un valor de opción (el color), y no
// se puede elegir a qué color pertenece si todavía no existe.
//
// Orden de guardado: primero se crea/actualiza el producto (POST/PUT) y recién
// con la respuesta —que ya trae los ids de cada valor de opción— se suben las
// imágenes pendientes. Antes de eso no existe el optionValueId al que apuntan.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Package, Layers, Banknote, Check, ChevronLeft, ChevronRight, Plus, X, Globe, FileText, Edit2, Sparkles, Trash2, Star, ImageIcon } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { fmtMoney } from '@/lib/utils'
import { CatalogoTabs, ProductoEstadoBadge } from './components/CatalogoTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import {
    panelCreateProduct, panelUpdateProduct, panelGetProductFull,
    panelGetCategoriesFlat, panelUploadProductImage, panelDeleteProductImage,
    ApiError,
    type ApiCategory, type ApiProductFull, type UpsertProductInput, type ProductStatus,
} from '@/lib/api'

// ─── Tipos del formulario ─────────────────────────────────────────────────────

interface TipoVariante { id: string; nombre: string; opciones: string[] }

// Una fila de la tabla de precio/stock. `id` solo existe si la variante ya está
// en la base (edición) — el backend lo usa para reconciliar en vez de recrear.
interface FilaVariante {
    clave: string            // "M / Negro" — identidad dentro del form
    valores: string[]        // ["M","Negro"], en el orden de las opciones
    id?: string
    sku: string
    precio: string
    stock: string
    stockMin: string
}

// Imagen todavía sin subir: vive como File hasta que el producto exista.
interface ImagenPendiente {
    key: string
    file: File
    preview: string
    principal: boolean
    // Valor de opción al que se asocia ("Negro"). Vacío = imagen general.
    valorOpcion?: string
}

interface ImagenGuardada {
    id: string
    url: string
    principal: boolean
    optionValueId: string | null
}

interface ProdForm {
    nombre: string; descripcion: string; categoriaId: string; tags: string[]; estado: ProductStatus
    precio: string; precioComparacion: string; costo: string; sku: string
    stock: string; stockMinimo: string
    tieneVariantes: boolean; tiposVariante: TipoVariante[]
}

interface ProductoNuevoProps {
    onVolver: () => void
    onToast: (m: string) => void
    editarId?: string
}

const FORM_INICIAL: ProdForm = {
    nombre: '', descripcion: '', categoriaId: '', tags: [], estado: 'PUBLISHED',
    precio: '', precioComparacion: '', costo: '', sku: '',
    stock: '0', stockMinimo: '5',
    tieneVariantes: false,
    tiposVariante: [{ id: 'v1', nombre: 'Talle', opciones: ['S', 'M', 'L'] }],
}

function generarSKU(nombre: string) {
    const base = nombre.trim().split(/\s+/).slice(0, 3).map(p => p.slice(0, 3).toUpperCase()).join('-')
    return base || 'SKU'
}

export default function ProductoNuevo({ onVolver, onToast, editarId }: ProductoNuevoProps) {
    const editando = !!editarId

    const [step, setStep] = useState(1)
    const [done, setDone] = useState<number[]>([])
    const [orbiGen, setOrbiGen] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [prod, setProd] = useState<ProdForm>(FORM_INICIAL)
    const [filas, setFilas] = useState<FilaVariante[]>([])
    const [imagenes, setImagenes] = useState<ImagenPendiente[]>([])
    const [guardadas, setGuardadas] = useState<ImagenGuardada[]>([])
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    const [guardando, setGuardando] = useState(false)
    const [cargando, setCargando] = useState(!!editarId)
    const [error, setError] = useState('')

    const set = <K extends keyof ProdForm>(k: K, v: ProdForm[K]) => setProd(p => ({ ...p, [k]: v }))

    useEffect(() => {
        panelGetCategoriesFlat().then(setCategorias).catch(() => setCategorias([]))
    }, [])

    // ── Precarga en modo edición ────────────────────────────────────────────
    useEffect(() => {
        if (!editarId) return
        let vigente = true
        setCargando(true)
        panelGetProductFull(editarId)
            .then((p: ApiProductFull) => {
                if (!vigente) return
                const conVariantes = p.options.length > 0
                setProd({
                    nombre: p.name,
                    descripcion: p.description ?? '',
                    categoriaId: p.categoryId ?? '',
                    tags: p.tags.map(t => t.name),
                    estado: p.status,
                    precio: String(p.basePrice),
                    precioComparacion: p.comparePrice != null ? String(p.comparePrice) : '',
                    costo: p.cost != null ? String(p.cost) : '',
                    sku: p.variants.find(v => v.isDefault)?.sku ?? p.variants[0]?.sku ?? '',
                    stock: String(p.variants[0]?.stock.reduce((s, st) => s + st.quantity, 0) ?? 0),
                    stockMinimo: String(p.variants[0]?.stock[0]?.stockMin ?? 5),
                    tieneVariantes: conVariantes,
                    tiposVariante: conVariantes
                        ? p.options.map(o => ({ id: o.id, nombre: o.name, opciones: o.values.map(v => v.value) }))
                        : FORM_INICIAL.tiposVariante,
                })
                setFilas(
                    conVariantes
                        ? p.variants.map(v => ({
                            clave: v.optionValues.map(ov => ov.value).join(' / '),
                            valores: v.optionValues.map(ov => ov.value),
                            id: v.id,
                            sku: v.sku ?? '',
                            precio: String(v.price),
                            stock: String(v.stock.reduce((s, st) => s + st.quantity, 0)),
                            stockMin: String(v.stock[0]?.stockMin ?? 0),
                        }))
                        : [],
                )
                setGuardadas(p.images.map(img => ({ id: img.id, url: img.url, principal: img.isPrimary, optionValueId: img.optionValueId })))
                setDone([1, 2, 3])
            })
            .catch(err => { if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el producto') })
            .finally(() => { if (vigente) setCargando(false) })
        return () => { vigente = false }
    }, [editarId])

    // ── Combinaciones (producto cartesiano de las opciones) ─────────────────
    const combos = useMemo(() => {
        if (!prod.tieneVariantes) return []
        const tipos = prod.tiposVariante.filter(tp => tp.nombre.trim() && tp.opciones.length)
        if (!tipos.length) return []
        let res: string[][] = [[]]
        for (const tp of tipos) {
            const next: string[][] = []
            for (const combo of res) for (const op of tp.opciones) next.push([...combo, op])
            res = next
        }
        return res.map(valores => ({ clave: valores.join(' / '), valores }))
    }, [prod.tieneVariantes, prod.tiposVariante])

    // Sincroniza la tabla con las combinaciones, conservando lo ya tipeado (y
    // el `id` de las que vienen de la base, para no perder la reconciliación).
    useEffect(() => {
        if (!prod.tieneVariantes) { setFilas([]); return }
        setFilas(prev => combos.map(c => {
            const previa = prev.find(f => f.clave === c.clave)
            if (previa) return previa
            const sufijo = c.valores.map(v => v.slice(0, 3).toUpperCase()).join('-')
            return {
                clave: c.clave,
                valores: c.valores,
                sku: `${prod.sku || generarSKU(prod.nombre)}-${sufijo}`,
                precio: prod.precio || '0',
                stock: '0',
                stockMin: prod.stockMinimo || '0',
            }
        }))
        // `prod.sku`/`precio` solo se usan como valor inicial de filas nuevas.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combos, prod.tieneVariantes])

    // Valores de opción disponibles para asociar imágenes.
    const valoresParaImagen = useMemo(() => {
        if (!prod.tieneVariantes) return []
        return prod.tiposVariante
            .filter(tp => tp.nombre.trim() && tp.opciones.length)
            .flatMap(tp => tp.opciones.map(op => ({ opcion: tp.nombre, valor: op })))
    }, [prod.tieneVariantes, prod.tiposVariante])

    const orbiDesc = () => {
        setOrbiGen(true)
        setTimeout(() => {
            const n = prod.nombre.toLowerCase()
            let txt: string
            if (n.includes('remera')) txt = 'Remera de corte oversize en algodón premium 180g. Ideal para looks casuales y urbanos. Lavar a 30°C.'
            else if (n.includes('pantal')) txt = 'Pantalón con múltiples bolsillos de material robusto y cómodo. Tiro medio con calce regular.'
            else if (n.includes('buzo')) txt = 'Buzo de frisa con capucha ajustable y bolsillo canguro. Material premium antipilling.'
            else txt = 'Producto de alta calidad diseñado en Argentina. Material premium, acabados de primera.'
            set('descripcion', prod.descripcion ? prod.descripcion + '\n\n' + txt : txt)
            setOrbiGen(false)
            onToast('Descripción generada por Orbi')
        }, 1000)
    }

    // ── Imágenes ────────────────────────────────────────────────────────────
    function agregarImagenes(files: FileList | null, valorOpcion?: string) {
        if (!files?.length) return
        const nuevas: ImagenPendiente[] = []
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue
            if (file.size > 5 * 1024 * 1024) { onToast(`"${file.name}" supera los 5MB`); continue }
            nuevas.push({
                key: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
                file,
                preview: URL.createObjectURL(file),
                // La primera imagen general del producto queda como principal.
                principal: !valorOpcion && imagenes.every(i => !i.principal) && guardadas.every(g => !g.principal),
                valorOpcion,
            })
        }
        setImagenes(prev => [...prev, ...nuevas])
    }

    function quitarPendiente(key: string) {
        setImagenes(prev => {
            const img = prev.find(i => i.key === key)
            if (img) URL.revokeObjectURL(img.preview)
            return prev.filter(i => i.key !== key)
        })
    }

    async function quitarGuardada(id: string) {
        if (!editarId) return
        try {
            await panelDeleteProductImage(editarId, id)
            setGuardadas(prev => prev.filter(g => g.id !== id))
            onToast('Imagen eliminada')
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo eliminar la imagen')
        }
    }

    function marcarPrincipal(key: string) {
        setImagenes(prev => prev.map(i => ({ ...i, principal: i.key === key })))
        setGuardadas(prev => prev.map(g => ({ ...g, principal: false })))
    }

    // Libera los object URLs al desmontar.
    useEffect(() => () => { imagenes.forEach(i => URL.revokeObjectURL(i.preview)) }, [imagenes])

    // ── Guardado ────────────────────────────────────────────────────────────
    const armarPayload = useCallback((): UpsertProductInput => {
        const precio = Number(prod.precio) || 0
        const opciones = prod.tieneVariantes
            ? prod.tiposVariante.filter(tp => tp.nombre.trim() && tp.opciones.length).map(tp => ({ name: tp.nombre.trim(), values: tp.opciones }))
            : undefined

        const variants: UpsertProductInput['variants'] = prod.tieneVariantes
            ? filas.map(f => ({
                ...(f.id ? { id: f.id } : {}),
                sku: f.sku || undefined,
                price: Number(f.precio) || precio,
                optionValues: f.valores,
                initialStock: Number(f.stock) || 0,
                stockMin: Number(f.stockMin) || 0,
            }))
            // Sin variantes: una sola fila con el stock general del paso 3.
            : [{
                ...(filas[0]?.id ? { id: filas[0].id } : {}),
                sku: prod.sku || undefined,
                price: precio,
                optionValues: [],
                initialStock: Number(prod.stock) || 0,
                stockMin: Number(prod.stockMinimo) || 0,
            }]

        return {
            name: prod.nombre.trim(),
            description: prod.descripcion.trim() || undefined,
            categoryId: prod.categoriaId || undefined,
            basePrice: precio,
            comparePrice: prod.precioComparacion ? Number(prod.precioComparacion) : undefined,
            cost: prod.costo ? Number(prod.costo) : undefined,
            status: prod.estado,
            ...(opciones ? { options: opciones } : {}),
            variants,
        }
    }, [prod, filas])

    async function guardar() {
        setError('')
        setGuardando(true)
        try {
            const payload = armarPayload()
            const guardado = editarId
                ? await panelUpdateProduct(editarId, payload)
                : await panelCreateProduct(payload)

            // Recién ahora existen los ids de cada valor de opción: se resuelve
            // a cuál apunta cada imagen pendiente.
            const idPorValor = new Map<string, string>()
            for (const opt of guardado.options) {
                for (const val of opt.values) idPorValor.set(val.value, val.id)
            }

            for (const img of imagenes) {
                await panelUploadProductImage(guardado.id, img.file, img.file.name, {
                    isPrimary: img.principal,
                    optionValueId: img.valorOpcion ? idPorValor.get(img.valorOpcion) : undefined,
                })
            }

            imagenes.forEach(i => URL.revokeObjectURL(i.preview))
            setImagenes([])
            onToast(
                editarId ? 'Producto actualizado'
                    : prod.estado === 'PUBLISHED' ? 'Producto publicado'
                        : 'Producto guardado como borrador',
            )
            onVolver()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo guardar el producto')
            setGuardando(false)
        }
    }

    // ── Validación por paso ─────────────────────────────────────────────────
    const req1 = prod.nombre.trim() !== ''
    const req3 = prod.precio !== '' && Number(prod.precio) > 0
    const variantesOk = !prod.tieneVariantes || combos.length > 0
    const canNext = step === 1 ? req1 : step === 2 ? variantesOk : step === 3 ? req3 : true

    const next = () => {
        setDone(d => [...new Set([...d, step])])
        if (step < 4) setStep(step + 1)
        else void guardar()
    }

    const STEPS: [string, string, ComponentType<{ size?: number; strokeWidth?: number }>][] = [
        ['1', 'Info', Package],
        ['2', 'Variantes e imágenes', Layers],
        ['3', 'Precio y stock', Banknote],
        ['4', 'Revisión', Check],
    ]
    const margen = prod.costo && prod.precio ? Math.round((1 - Number(prod.costo) / Number(prod.precio)) * 100) : null
    const stockTotal = prod.tieneVariantes
        ? filas.reduce((s, f) => s + (Number(f.stock) || 0), 0)
        : Number(prod.stock) || 0

    if (cargando) {
        return (
            <div style={pageWrap}>
                <CatalogoTabs activo="crear" />
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-muted)' }}>Cargando producto…</div>
            </div>
        )
    }

    return (
        <div className="pn-page" style={pageWrap}>
            <style>{`
                .pn-page    { padding: 24px 32px 64px; }
                .pn-layout  { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
                .pn-preview { position: sticky; top: 20px; }
                @media (max-width: 1080px) {
                    .pn-layout  { grid-template-columns: 1fr !important; }
                    .pn-preview { position: static !important; }
                }
                @media (max-width: 768px) {
                    .pn-page { padding: 16px 14px 48px !important; }
                }
            `}</style>

            <CatalogoTabs activo="crear" />
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>
                {editando ? 'Editar producto' : 'Crear producto'}
            </h1>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', maxWidth: 860, marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
                {STEPS.map(([n, l], i) => {
                    const a = step === Number(n), dn = done.includes(Number(n)) || step > Number(n)
                    return (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none', minWidth: 0 }}>
                            <button
                                onClick={() => { if (dn || a) setStep(Number(n)) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: dn || a ? 'pointer' : 'default', fontFamily: 'inherit' }}
                            >
                                <span style={{ width: 30, height: 30, borderRadius: '50%', background: dn ? 'var(--color-success)' : a ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: dn || a ? '#fff' : 'var(--color-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                                    {dn ? <Check size={14} strokeWidth={2.6} /> : n}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: a || dn ? 600 : 500, color: a || dn ? 'var(--color-text)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>{l}</span>
                            </button>
                            {i < 3 && <div style={{ flex: 1, height: 2, background: dn ? 'var(--color-success)' : 'var(--color-border)', margin: '0 12px', minWidth: 12 }} />}
                        </div>
                    )
                })}
            </div>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16, maxWidth: 860 }}>
                    {error}
                </div>
            )}

            <div className="pn-layout">
                <Card>
                    {/* PASO 1 — Info */}
                    {step === 1 && (
                        <div>
                            <StepHd icon={Package} title="¿Qué estás vendiendo?" sub="Lo básico de tu producto." />
                            <div style={{ marginBottom: 18 }}>
                                <PField label="Nombre del producto" value={prod.nombre} onChange={v => set('nombre', v.slice(0, 80))} placeholder="Ej: Remera oversize negra" h={44} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Usá palabras que tus clientes buscarían</span>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.nombre.length}/80</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Descripción</label>
                                <textarea value={prod.descripcion} onChange={e => set('descripcion', e.target.value.slice(0, 2000))} rows={5} style={{ ...inputBase, width: '100%', resize: 'vertical', minHeight: 110, padding: '10px 12px', fontSize: 14, lineHeight: 1.6 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                    <button onClick={orbiDesc} disabled={orbiGen} style={{ background: 'none', border: 'none', color: '#8B5CF6', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        {orbiGen ? <>Generando…</> : <><Sparkles size={13} /> Generar descripción con Orbi</>}
                                    </button>
                                    <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{prod.descripcion.length}/2000</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Categoría</label>
                                <select value={prod.categoriaId} onChange={e => set('categoriaId', e.target.value)} style={{ ...inputBase, width: '100%', height: 40, padding: '0 12px', cursor: 'pointer' }}>
                                    <option value="">Elegí una categoría</option>
                                    {categorias.filter(c => !c.parentId).map(c => (
                                        <optgroup key={c.id} label={c.name}>
                                            <option value={c.id}>{c.name}</option>
                                            {categorias.filter(h => h.parentId === c.id).map(h => (
                                                <option key={h.id} value={h.id}>{h.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={lbl}>Etiquetas</label>
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); set('tags', [...new Set([...prod.tags, tagInput.trim()])]); setTagInput('') } }}
                                    placeholder="Agregar etiqueta… presioná Enter"
                                    style={{ ...inputBase, width: '100%', height: 36, padding: '0 12px', fontSize: 13 }}
                                />
                                {prod.tags.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                        {prod.tags.map(tg => (
                                            <span key={tg} style={chip}>{tg}
                                                <button onClick={() => set('tags', prod.tags.filter(x => x !== tg))} style={chipX}><X size={11} strokeWidth={2} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>
                                    Las etiquetas ayudan a filtrar en tu panel. Todavía no se guardan en el catálogo público.
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>Estado</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {([['PUBLISHED', 'Publicado', Globe, 'var(--color-success)'], ['DRAFT', 'Borrador', Edit2, 'var(--color-muted)']] as [ProductStatus, string, ComponentType<{ size?: number; strokeWidth?: number }>, string][]).map(([id, l, Icon, col]) => {
                                        const a = prod.estado === id
                                        return (
                                            <button key={id} onClick={() => set('estado', id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderRadius: 8, border: `${a ? 2 : 1}px solid ${a ? col : 'var(--color-border)'}`, background: a ? `color-mix(in srgb, ${col} 8%, transparent)` : 'var(--color-bg)', color: a ? col : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                <Icon size={16} strokeWidth={1.6} /> {l}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2 — Variantes e imágenes */}
                    {step === 2 && (
                        <div>
                            <StepHd icon={Layers} title="Variantes e imágenes" sub="Definí las opciones y subí las fotos de cada una." />

                            <TogRow
                                label="Este producto tiene variantes (talles, colores, etc.)"
                                help="Se genera una combinación por cada cruce. El precio y el stock de cada una se cargan en el paso siguiente."
                                on={prod.tieneVariantes}
                                onChange={v => set('tieneVariantes', v)}
                            />

                            {prod.tieneVariantes && (
                                <div style={{ marginTop: 16 }}>
                                    {prod.tiposVariante.map((tp, ti) => (
                                        <div key={tp.id} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                <input
                                                    value={tp.nombre}
                                                    onChange={e => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, nombre: e.target.value } : x))}
                                                    placeholder="Nombre de la opción (Talle, Color…)"
                                                    style={{ ...inputBase, height: 36, padding: '0 10px', fontSize: 14, fontWeight: 500, flex: 1 }}
                                                />
                                                {prod.tiposVariante.length > 1 && (
                                                    <button onClick={() => set('tiposVariante', prod.tiposVariante.filter((_, j) => j !== ti))} style={iconBtn}><X size={15} strokeWidth={1.8} /></button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                {tp.opciones.map(op => (
                                                    <span key={op} style={{ ...chip, border: '1px solid var(--color-primary)' }}>{op}
                                                        <button onClick={() => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, opciones: x.opciones.filter(o => o !== op) } : x))} style={chipX}><X size={11} strokeWidth={2} /></button>
                                                    </span>
                                                ))}
                                                <OpInput tipo={tp.nombre} onAdd={v => set('tiposVariante', prod.tiposVariante.map((x, j) => j === ti ? { ...x, opciones: [...new Set([...x.opciones, v])] } : x))} />
                                            </div>
                                        </div>
                                    ))}
                                    {prod.tiposVariante.length < 3 && (
                                        <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => set('tiposVariante', [...prod.tiposVariante, { id: 'v' + Date.now(), nombre: '', opciones: [] }])} style={{ width: '100%', justifyContent: 'center' }}>
                                            Agregar otra opción
                                        </Button>
                                    )}
                                    {combos.length > 0 && (
                                        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--color-muted)' }}>
                                            Se van a crear <strong style={{ color: 'var(--color-text)' }}>{combos.length}</strong> combinaciones.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Imagen principal + galería general */}
                            <div style={{ marginTop: 24 }}>
                                <label style={lbl}>Fotos del producto</label>
                                <GaleriaImagenes
                                    pendientes={imagenes.filter(i => !i.valorOpcion)}
                                    guardadas={guardadas.filter(g => !g.optionValueId)}
                                    onAgregar={files => agregarImagenes(files)}
                                    onQuitarPendiente={quitarPendiente}
                                    onQuitarGuardada={quitarGuardada}
                                    onPrincipal={marcarPrincipal}
                                    permitePrincipal
                                />
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>
                                    La foto marcada con la estrella es la que aparece en el catálogo. PNG o JPG, hasta 5MB.
                                </div>
                            </div>

                            {/* Imágenes por valor de opción */}
                            {valoresParaImagen.length > 0 && (
                                <div style={{ marginTop: 24 }}>
                                    <label style={lbl}>Fotos por variante</label>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
                                        Opcional. Sirve sobre todo para el color: cuando el cliente lo elija en tu tienda, va a ver estas fotos.
                                    </div>
                                    {valoresParaImagen.map(({ opcion, valor }) => (
                                        <div key={`${opcion}-${valor}`} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                                {opcion}: {valor}
                                            </div>
                                            <GaleriaImagenes
                                                pendientes={imagenes.filter(i => i.valorOpcion === valor)}
                                                guardadas={[]}
                                                onAgregar={files => agregarImagenes(files, valor)}
                                                onQuitarPendiente={quitarPendiente}
                                                onQuitarGuardada={quitarGuardada}
                                                onPrincipal={marcarPrincipal}
                                                compacta
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3 — Precio y stock */}
                    {step === 3 && (
                        <div>
                            <StepHd icon={Banknote} title="¿Cuánto cuesta?" sub="Precio, costo y disponibilidad." />
                            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20, marginBottom: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <PField label="Precio de venta" value={prod.precio} onChange={v => set('precio', v.replace(/\D/g, ''))} prefix="$" mono big h={44} placeholder="0" />
                                    <div>
                                        <PField label="Precio de comparación" value={prod.precioComparacion} onChange={v => set('precioComparacion', v.replace(/\D/g, ''))} prefix="$" mono h={44} />
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>Si lo completás, aparece tachado con badge de oferta.</div>
                                    </div>
                                </div>
                                <PField label="Costo del producto" value={prod.costo} onChange={v => set('costo', v.replace(/\D/g, ''))} prefix="$" mono h={40} />
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                                    Solo vos podés verlo. Sirve para el margen y para calcular el valor de tu inventario.
                                </div>
                                {margen != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 8, marginTop: 12 }}>
                                        <span style={{ fontSize: 12, color: 'var(--color-body)' }}>Margen estimado</span>
                                        <div style={{ flex: 1 }} />
                                        <span style={{ height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace', display: 'inline-flex', alignItems: 'center' }}>{margen}%</span>
                                    </div>
                                )}
                            </div>

                            {!prod.tieneVariantes ? (
                                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <PField label="SKU" value={prod.sku} onChange={v => set('sku', v.toUpperCase())} mono placeholder="RM-OVR-NG" />
                                            <button onClick={() => set('sku', generarSKU(prod.nombre))} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, padding: 0 }}>Generar automáticamente</button>
                                        </div>
                                        <PField label="Stock disponible" value={prod.stock} onChange={v => set('stock', v.replace(/\D/g, ''))} mono />
                                    </div>
                                    <div style={{ marginTop: 14 }}>
                                        <PField label="Stock mínimo de alerta" value={prod.stockMinimo} onChange={v => set('stockMinimo', v.replace(/\D/g, ''))} mono />
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>Te avisamos cuando el stock baje a este nivel.</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 100px 80px 80px', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <span>Variante</span><span>SKU</span><span>Precio</span><span>Stock</span><span>Mín.</span>
                                    </div>
                                    {filas.map((f, i) => (
                                        <div key={f.clave} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 100px 80px 80px', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{f.clave}</span>
                                            <input value={f.sku} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value.toUpperCase() } : x))} style={celda} />
                                            <input value={f.precio} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, precio: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                            <input value={f.stock} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                            <input value={f.stockMin} onChange={e => setFilas(prev => prev.map((x, j) => j === i ? { ...x, stockMin: e.target.value.replace(/\D/g, '') } : x))} style={celda} />
                                        </div>
                                    ))}
                                    {filas.length === 0 && (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                                            Volvé al paso anterior y cargá al menos una opción con valores.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 4 — Revisión */}
                    {step === 4 && (
                        <div>
                            <StepHd icon={Check} title={editando ? 'Revisá los cambios' : '¡Listo para publicar!'} sub="Verificá que esté todo bien antes de guardar." />
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                                <Resumen etiqueta="Nombre" valor={prod.nombre || '—'} />
                                <Resumen etiqueta="Categoría" valor={categorias.find(c => c.id === prod.categoriaId)?.name ?? 'Sin categoría'} />
                                <Resumen etiqueta="Precio" valor={prod.precio ? fmtMoney(Number(prod.precio)) : '—'} mono />
                                <Resumen etiqueta="Stock total" valor={String(stockTotal)} mono />
                                <Resumen etiqueta="Variantes" valor={prod.tieneVariantes ? `${filas.length} combinaciones` : 'Sin variantes'} />
                                <Resumen etiqueta="Fotos" valor={`${imagenes.length + guardadas.length}`} mono />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Estado</span>
                                    <ProductoEstadoBadge estado={prod.estado === 'PUBLISHED' ? 'publicado' : 'borrador'} />
                                </div>
                            </div>
                            <button
                                onClick={() => void guardar()}
                                disabled={guardando || !req1 || !req3}
                                style={{ width: '100%', height: 52, borderRadius: 10, border: 'none', background: guardando || !req1 || !req3 ? 'var(--color-surface-alt)' : prod.estado === 'PUBLISHED' ? 'var(--color-primary)' : 'var(--color-success)', color: guardando || !req1 || !req3 ? 'var(--color-muted)' : '#fff', fontSize: 15, fontWeight: 700, cursor: guardando || !req1 || !req3 ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {guardando
                                    ? 'Guardando…'
                                    : editando
                                        ? <>Guardar cambios</>
                                        : prod.estado === 'PUBLISHED'
                                            ? <><Globe size={18} strokeWidth={1.8} /> Publicar producto</>
                                            : <><FileText size={18} strokeWidth={1.8} /> Guardar como borrador</>}
                            </button>
                            {(!req1 || !req3) && (
                                <div style={{ fontSize: 12, color: 'var(--color-error)', textAlign: 'center', marginTop: 8 }}>
                                    Falta {!req1 ? 'el nombre del producto' : 'el precio de venta'}.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                        {step > 1
                            ? <Button variant="outline" icon={<ChevronLeft size={14} />} onClick={() => setStep(step - 1)}>Volver</Button>
                            : <Button variant="outline" onClick={onVolver}>Cancelar</Button>}
                        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Paso {step} de 4</span>
                        {step < 4
                            ? <Button variant="primary" onClick={next} disabled={!canNext}>Continuar <ChevronRight size={16} strokeWidth={2} /></Button>
                            : <div />}
                    </div>
                </Card>

                {/* ── Preview en vivo ── */}
                <div className="pn-preview">
                    <Card padding="sm" style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Vista previa
                        </div>
                        <PreviewProducto
                            nombre={prod.nombre}
                            descripcion={prod.descripcion}
                            precio={prod.precio}
                            precioComparacion={prod.precioComparacion}
                            estado={prod.estado}
                            categoria={categorias.find(c => c.id === prod.categoriaId)?.name}
                            imagen={imagenes.find(i => i.principal)?.preview ?? imagenes.find(i => !i.valorOpcion)?.preview ?? guardadas.find(g => g.principal)?.url ?? guardadas[0]?.url}
                            variantes={prod.tieneVariantes ? prod.tiposVariante.filter(t => t.nombre.trim() && t.opciones.length) : []}
                            stockTotal={stockTotal}
                        />
                    </Card>
                </div>
            </div>
        </div>
    )
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function PreviewProducto({ nombre, descripcion, precio, precioComparacion, estado, categoria, imagen, variantes, stockTotal }: {
    nombre: string; descripcion: string; precio: string; precioComparacion: string
    estado: ProductStatus; categoria?: string; imagen?: string
    variantes: TipoVariante[]; stockTotal: number
}) {
    const p = Number(precio) || 0
    const pc = Number(precioComparacion) || 0
    const off = pc > p && p > 0 ? Math.round((1 - p / pc) * 100) : null

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'var(--color-surface)' }}>
                {imagen
                    ? <img src={imagen} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-subtle)' }}>
                        <div style={{ textAlign: 'center' }}>
                            <ImageIcon size={28} strokeWidth={1.4} />
                            <div style={{ fontSize: 11, marginTop: 6 }}>Sin foto todavía</div>
                        </div>
                    </div>}
                {off && (
                    <span style={{ position: 'absolute', top: 10, left: 10, height: 22, padding: '0 8px', borderRadius: 9999, background: 'var(--color-error)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                        -{off}%
                    </span>
                )}
                {estado === 'DRAFT' && (
                    <span style={{ position: 'absolute', top: 10, right: 10, height: 22, padding: '0 8px', borderRadius: 9999, background: 'rgba(15,23,42,0.75)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                        BORRADOR
                    </span>
                )}
            </div>
            <div style={{ padding: 14 }}>
                {categoria && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>{categoria}</div>}
                <div style={{ fontSize: 15, fontWeight: 700, color: nombre ? 'var(--color-text)' : 'var(--color-subtle)', lineHeight: 1.3 }}>
                    {nombre || 'Nombre del producto'}
                </div>
                {descripcion && (
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {descripcion}
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                        {p > 0 ? fmtMoney(p) : '$—'}
                    </span>
                    {off && <span style={{ fontSize: 13, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(pc)}</span>}
                </div>
                {variantes.map(v => (
                    <div key={v.id} style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 5 }}>{v.nombre}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {v.opciones.slice(0, 6).map(op => (
                                <span key={op} style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-body)' }}>{op}</span>
                            ))}
                            {v.opciones.length > 6 && <span style={{ fontSize: 11, color: 'var(--color-muted)', alignSelf: 'center' }}>+{v.opciones.length - 6}</span>}
                        </div>
                    </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 11, color: stockTotal > 0 ? 'var(--color-muted)' : 'var(--color-error)' }}>
                    {stockTotal > 0 ? `${stockTotal} unidades disponibles` : 'Sin stock'}
                </div>
            </div>
        </div>
    )
}

// ─── Galería ──────────────────────────────────────────────────────────────────

function GaleriaImagenes({ pendientes, guardadas, onAgregar, onQuitarPendiente, onQuitarGuardada, onPrincipal, permitePrincipal, compacta }: {
    pendientes: ImagenPendiente[]
    guardadas: ImagenGuardada[]
    onAgregar: (files: FileList | null) => void
    onQuitarPendiente: (key: string) => void
    onQuitarGuardada: (id: string) => void
    onPrincipal: (key: string) => void
    permitePrincipal?: boolean
    compacta?: boolean
}) {
    const alto = compacta ? 72 : 96
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {guardadas.map(g => (
                <div key={g.id} style={{ position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden', border: g.principal ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                    <img src={g.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {g.principal && <span style={{ position: 'absolute', top: 3, left: 3, background: 'var(--color-primary)', color: '#fff', borderRadius: 4, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>Principal</span>}
                    <button onClick={() => onQuitarGuardada(g.id)} title="Eliminar" style={btnSobreImg}><Trash2 size={12} /></button>
                </div>
            ))}
            {pendientes.map(img => (
                <div key={img.key} style={{ position: 'relative', width: alto, height: alto, borderRadius: 8, overflow: 'hidden', border: img.principal ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {permitePrincipal && (
                        <button onClick={() => onPrincipal(img.key)} title="Marcar como principal" style={{ ...btnSobreImg, left: 3, right: 'auto', background: img.principal ? 'var(--color-primary)' : 'rgba(15,23,42,0.55)' }}>
                            <Star size={12} fill={img.principal ? '#fff' : 'none'} />
                        </button>
                    )}
                    <button onClick={() => onQuitarPendiente(img.key)} title="Quitar" style={btnSobreImg}><X size={12} /></button>
                </div>
            ))}
            <label style={{ width: alto, height: alto, borderRadius: 8, border: '1.5px dashed var(--color-border)', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-muted)' }}>
                <input type="file" accept="image/*" multiple onChange={e => { onAgregar(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                <Plus size={compacta ? 16 : 20} />
            </label>
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StepHd({ icon: Icon, title, sub }: { icon: ComponentType<{ size?: number; strokeWidth?: number }>; title: string; sub: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={20} strokeWidth={1.6} /></div>
            <div><h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{title}</h2><div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{sub}</div></div>
        </div>
    )
}

function Resumen({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{etiqueta}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit' }}>{valor}</span>
        </div>
    )
}

function PField({ label, value, onChange, placeholder, prefix, mono, h = 40, big }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string
    prefix?: string; mono?: boolean; h?: number; big?: boolean
}) {
    return (
        <div>
            <label style={lbl}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', height: h, padding: '0 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, gap: 6 }}>
                {prefix && <span style={{ color: 'var(--color-muted)', fontSize: big ? 18 : 14, fontFamily: '"Geist Mono", monospace' }}>{prefix}</span>}
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: big ? 18 : 14, fontWeight: big ? 600 : 400, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit' }} />
            </div>
        </div>
    )
}

function TogRow({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
                {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            </div>
            <span onClick={e => { e.preventDefault(); onChange(!on) }} style={{ width: 40, height: 22, borderRadius: 11, background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', border: on ? 'none' : '1px solid var(--color-border)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.15)', transition: 'left 200ms' }} />
            </span>
        </label>
    )
}

function OpInput({ tipo, onAdd }: { tipo: string; onAdd: (v: string) => void }) {
    const [v, setV] = useState('')
    const t = tipo.toLowerCase()
    const ph = t.includes('talle') ? 'Ej: XL' : t.includes('color') ? 'Ej: Negro' : 'Nueva opción'
    const commit = () => { if (v.trim()) { onAdd(v.trim()); setV('') } }
    return (
        <input
            value={v}
            onChange={e => setV(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
            onBlur={commit}
            placeholder={ph}
            style={{ ...inputBase, height: 30, width: 120, padding: '0 10px', fontSize: 12 }}
        />
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }
const inputBase: React.CSSProperties = { boxSizing: 'border-box', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const celda: React.CSSProperties = { ...inputBase, height: 28, padding: '0 8px', fontSize: 11, fontFamily: '"Geist Mono", monospace', width: '100%' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500 }
const chipX: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
const btnSobreImg: React.CSSProperties = { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'rgba(15,23,42,0.55)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }
