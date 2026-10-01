// Apariencia del sitio de reservas: el editor de la identidad del negocio.
//
// Arriba de todo, el riel de plantillas (cada una es una identidad completa,
// con miniatura fiel). Abajo, el editor a la izquierda y la vista previa en
// vivo a la derecha. Elegir una plantilla trae sus valores de fábrica (paleta,
// par tipográfico, bordes, botón y tipo de portada) y después cada cosa se
// ajusta por separado. La plantilla puede venir elegida desde Avanzado →
// Plantillas por ?plantilla=.
//
// Antes que todo eso va el tipo de página: sitio web completo o página simple.
// A diferencia del resto (que es una demo y se "guarda" en memoria), eso SÍ se
// aplica: vive en el negocio de la demo (demo/negocioDemo.ts) y es lo que abre
// el link del negocio.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import {
  Sparkles, Droplets, Type, Square, Image as ImageIcon, LayoutTemplate, PanelsTopLeft, AlignLeft,
  Check, Upload, GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lock, Eye, X, Trash2, Info, RotateCcw, ArrowUpRight,
  MonitorSmartphone, Smartphone, type LucideIcon,
} from 'lucide-react'
import { useNegocioDemo, type FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import { cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import { temaDe } from '@/modules/turnos/storefront/tema'
import {
  PLANTILLAS, PLANTILLA_DE_FAMILIA, plantillaPorId, plantillasPara, plantillaRecomendada, temaConPlantilla, paletaCon,
  TIPOGRAFIAS, tipografiaPorId, RADIOS, radioDeTema, ESTILOS_BOTON, seccionesIniciales, fotosPara,
  botonesSugeridos, esHex, iniciales, subdominioDe, vozDe, type Radio, type EstiloBoton, type PlantillaSitio,
} from './datos'
import { useBorrador, Encabezado, SecCard, Rotulo, Switch, Campo, Chip, BarraGuardar, Boton, type PropsTab } from './ui'
import VistaPrevia, { armarPisar } from './VistaPrevia'
import { MiniSitio, TarjetaPlantilla, datosMini } from './MiniSitio'

interface Ap {
  plantilla: string
  color: string
  tipo: string
  radio: Radio
  estiloBoton: EstiloBoton
  logo: string | null
  monograma: boolean
  foto: string
  hero: 'sangre' | 'partido'
  secciones: { id: string; on: boolean }[]
  nombre: string
  frase: string
  boton: string
}

const FORMAS: { id: FormaSitio; Icon: LucideIcon; titulo: string; texto: string }[] = [
  { id: 'web', Icon: PanelsTopLeft, titulo: 'Sitio web completo', texto: 'Portada, servicios y precios, equipo, nosotros, fotos y cómo llegar. El botón de reservar acompaña toda la página.' },
  { id: 'simple', Icon: Smartphone, titulo: 'Página simple', texto: 'Una sola pantalla: tu portada, tu logo, el nombre, una descripción corta y el botón. Se toca y se reserva, paso a paso.' },
]
// Lo que muestra la página simple, que no tiene secciones para ordenar.
const EN_SIMPLE = ['Foto de portada', 'Logo y nombre', 'Descripción corta', 'Botón de reservar', 'Dónde y cuándo atendés', 'Beneficios de la cuenta, si los ofrecés']

/** Los valores de fábrica que trae una plantilla: lo que se pisa al elegirla. */
const deFabrica = (p: PlantillaSitio) => ({ plantilla: p.id, color: p.c.primary, tipo: p.tipo, radio: radioDeTema(p.radio), estiloBoton: p.boton, hero: p.hero })

export default function Apariencia({ rubro, avisar }: PropsTab) {
  const router = useRouter()
  const pedida = plantillaPorId(typeof router.query.plantilla === 'string' ? router.query.plantilla : undefined)
  const voz = vozDe(rubro)

  // El tipo de página. null = sin tocar: vale lo guardado en el negocio de la
  // demo (que llega del navegador recién después de hidratar, por eso no se copia
  // a un estado al montar).
  const { demo, guardar: guardarDemo } = useNegocioDemo()
  const [formaBorrador, setFormaBorrador] = useState<FormaSitio | null>(null)
  const forma = formaBorrador ?? demo.forma
  const formaDirty = formaBorrador !== null && formaBorrador !== demo.forma
  const simple = forma === 'simple'
  const metaSecciones = useMemo(() => seccionesIniciales(rubro), [rubro])
  const orden = useMemo(() => plantillasPara(rubro), [rubro])

  // Lo "publicado" es la plantilla de la familia; si se llegó con una plantilla
  // pedida, el borrador arranca con esa y ya queda como cambio sin guardar.
  const b = useBorrador<Ap>(() => {
    const t = temaDe(rubro)
    const base = plantillaPorId(PLANTILLA_DE_FAMILIA[rubro.familia]) ?? PLANTILLAS[0]
    return {
      ...deFabrica(base), logo: null, monograma: true, foto: t.fotoHero,
      secciones: metaSecciones.map(s => ({ id: s.id, on: s.on })),
      nombre: t.nombre, frase: t.tagline, boton: botonesSugeridos(rubro)[0],
    }
  }, pedida ? g => ({ ...g, ...deFabrica(pedida) }) : undefined)
  const ap = b.valor
  const plantilla = plantillaPorId(ap.plantilla) ?? PLANTILLAS[0]
  const tipo = tipografiaPorId(ap.tipo)
  const radioPx = RADIOS.find(r => r.id === ap.radio)?.px ?? 8
  const color = esHex(ap.color) ? ap.color : plantilla.c.primary
  const paleta = useMemo(() => paletaCon(plantilla.c, color), [plantilla, color])
  const [previewAbierta, setPreviewAbierta] = useState(false)
  const [fotosSubidas, setFotosSubidas] = useState<string[]>([])
  const riel = useRef<HTMLDivElement>(null)
  // Sección que se está arrastrando (con mouse); en celular se ordena con las flechas.
  const [arrastra, setArrastra] = useState<string | null>(null)
  const soltarEn = (destino: number) => {
    const desde = ap.secciones.findIndex(s => s.id === arrastra)
    setArrastra(null)
    if (desde < 0 || desde === destino) return
    const lista = [...ap.secciones]
    const [movida] = lista.splice(desde, 1)
    lista.splice(destino, 0, movida)
    b.set('secciones', lista)
  }

  // Las fuentes de las plantillas (Cormorant, Oswald, Outfit…) para las
  // muestras de tipografía y las miniaturas.
  useEffect(() => { cargarFuentes() }, [])

  const tocada = ap.color !== plantilla.c.primary || ap.tipo !== plantilla.tipo || ap.radio !== radioDeTema(plantilla.radio) || ap.estiloBoton !== plantilla.boton || ap.hero !== plantilla.hero
  const elegir = (p: PlantillaSitio) => b.setValor(v => ({ ...v, ...deFabrica(p) }))

  const pisar = useMemo(() => armarPisar(rubro, plantilla, { color, tipo: tipo.id, radio: radioPx, foto: ap.foto }), [rubro, plantilla, color, tipo.id, radioPx, ap.foto])

  // Lo que ve la miniatura de la plantilla en uso: el negocio con todos los ajustes del editor.
  const temaActual = useMemo(() => ({ ...temaConPlantilla(rubro, plantilla), c: paleta, fh: tipo.fh, fb: tipo.fb, mayus: tipo.mayus, radio: radioPx, hero: ap.hero }), [rubro, plantilla, paleta, tipo, radioPx, ap.hero])
  const datos = useMemo(() => datosMini(rubro, temaDe(rubro), { nombre: ap.nombre || 'Tu negocio', frase: ap.frase || 'Tu frase principal', boton: ap.boton || 'Reservar', foto: ap.foto, logo: ap.logo }), [rubro, ap.nombre, ap.frase, ap.boton, ap.foto, ap.logo])

  const subdominio = subdominioDe(ap.nombre)
  const dirty = b.dirty || formaDirty
  const guardar = () => {
    b.guardar()
    if (formaDirty) guardarDemo({ forma })
    setFormaBorrador(null)
    avisar('Apariencia guardada', formaDirty ? `Tu link ahora abre ${simple ? 'la página simple' : 'el sitio web completo'}. El resto es una demo.` : 'Es una demo: tu sitio no cambia de verdad.')
  }
  const descartar = () => { b.descartar(); setFormaBorrador(null) }
  const fotos = [...fotosSubidas, ...fotosPara(temaDe(rubro))]
  const correr = (d: -1 | 1) => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    riel.current?.scrollBy({ left: d * Math.max(280, riel.current.clientWidth * 0.8), behavior: quieto ? 'auto' : 'smooth' })
  }
  const irAGaleria = () => {
    const { tab: _t, plantilla: _p, ...resto } = router.query
    void _t; void _p
    void router.replace({ pathname: router.pathname, query: { ...resto, vista: 'avanzado', funcion: 'plantillas' } }, undefined, { shallow: true })
  }

  const preview = (alto: string, celular?: boolean) => (
    // key = forma: la página simple está pensada para el celular, así que al elegirla la vista previa arranca en celular.
    <VistaPrevia key={forma} rubroKey={rubro.key} pisar={pisar} alto={alto} subdominio={subdominio} forma={forma} dispositivoInicial={celular || simple ? 'celular' : 'escritorio'} />
  )
  const muestraBoton = (estilo: EstiloBoton, texto: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 38, padding: '0 18px', borderRadius: radioPx, fontFamily: tipo.fb, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box',
      transition: 'border-radius 240ms ease, background 200ms ease, color 200ms ease',
      ...(estilo === 'relleno' ? { background: paleta.primary, color: paleta.onPrimary } : estilo === 'borde' ? { border: `2px solid ${paleta.primary}`, color: paleta.primary } : { background: paleta.primaryBg, color: paleta.primary }),
    }}>{texto}</span>
  )

  return (
    <div className="panel-page panel-page--editor">
      <Encabezado
        rotulo="Tu sitio"
        titulo="Apariencia"
        bajada="La identidad de tu sitio de reservas: elegí una plantilla y ajustala a tu marca. Cada cambio se ve al instante en la vista previa."
        acciones={<>
          <Chip tono={dirty ? 'aviso' : 'ok'}>{dirty ? <><span aria-hidden className="tuo-late" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />Cambios sin guardar</> : <><Check size={12} strokeWidth={3} aria-hidden />Publicado</>}</Chip>
          <span className="tuc-solo-angosto"><Boton variant="outline" icon={<Eye size={15} aria-hidden />} onClick={() => setPreviewAbierta(true)}>Ver vista previa</Boton></span>
          <span className="tuc-solo-ancho"><Boton variant="primary" disabled={!dirty} onClick={guardar}>Guardar cambios</Boton></span>
        </>}
      />

      {/* ── Tipo de página ─────────────────────────────────────────────────── */}
      <section aria-labelledby="tuc-forma-tit" className="tuc-forma-zona">
        <h2 id="tuc-forma-tit" className="tuo-h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MonitorSmartphone size={16} aria-hidden style={{ color: 'var(--color-primary)' }} />Tipo de página</h2>
        <p className="tuc-card-bajada">Lo que ven tus {voz.clientes} al entrar a tu link. Las dos llevan tus colores y el botón de reservar, y en las dos se reserva sin registrarse.</p>
        <div role="radiogroup" aria-labelledby="tuc-forma-tit" className="tuc-grid-2 tuc-formas">
          {FORMAS.map(f => {
            const a = forma === f.id
            return (
              <button key={f.id} type="button" role="radio" aria-checked={a} onClick={() => setFormaBorrador(f.id)} className="tuc-opcion tuc-forma">
                <span className="tuc-opcion-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>
                <span className="tuc-forma-ico" aria-hidden><f.Icon size={19} strokeWidth={1.7} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="tuc-forma-tit">{f.titulo}</span>
                  <span className="tuc-forma-txt">{f.texto}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Riel de plantillas ─────────────────────────────────────────────── */}
      <section aria-label="Plantilla" className="tuc-riel-zona">
        <div className="tuc-riel-cab">
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <h2 className="tuo-h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} aria-hidden style={{ color: 'var(--color-primary)' }} />Plantilla</h2>
            <p className="tuc-card-bajada">El punto de partida: {PLANTILLAS.length} identidades completas. Las que mejor le quedan a {rubro.label.toLowerCase()} van primero.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {tocada && <button type="button" className="tuc-link" onClick={() => elegir(plantilla)}><RotateCcw size={13} aria-hidden />Volver a los valores de {plantilla.nombre}</button>}
            <button type="button" className="tuc-link" onClick={irAGaleria}>Ver la galería<ArrowUpRight size={13} aria-hidden /></button>
            <span className="tuc-riel-flechas">
              <button type="button" className="tuo-btn tuo-btn--sm tuo-btn--icono" aria-label="Plantillas anteriores" onClick={() => correr(-1)}><ChevronLeft size={16} aria-hidden /></button>
              <button type="button" className="tuo-btn tuo-btn--sm tuo-btn--icono" aria-label="Plantillas siguientes" onClick={() => correr(1)}><ChevronRight size={16} aria-hidden /></button>
            </span>
          </div>
        </div>
        <div ref={riel} role="radiogroup" aria-label="Plantilla del sitio" className="tuc-riel">
          {orden.map((p, i) => {
            const activa = p.id === ap.plantilla
            return (
              <div key={p.id} className="tuc-riel-item">
                <TarjetaPlantilla p={p} i={i} activa={activa} recomendada={plantillaRecomendada(p, rubro)} onClick={() => elegir(p)}
                  tema={activa ? temaActual : temaConPlantilla(rubro, p)} datos={datos} boton={activa ? ap.estiloBoton : p.boton} />
              </div>
            )
          })}
        </div>
      </section>

      <div className="tuc-ap-split">
        <div className="tuc-pila">

          <SecCard titulo="Colores" Icon={Droplets} bajada={`La paleta de ${plantilla.nombre}, con el acento que elijas para botones, links y detalles.`}>
            <div role="radiogroup" aria-label="Paleta de colores" className="tuc-paletas">
              {plantilla.acentos.map((c, i) => {
                const a = c.toLowerCase() === ap.color.toLowerCase()
                const pl = paletaCon(plantilla.c, c)
                return (
                  <button key={c} type="button" role="radio" aria-checked={a} aria-label={`Paleta con acento ${c}${i === 0 ? ', la de fábrica' : ''}`} title={c} onClick={() => b.set('color', c)} className="tuc-paleta">
                    <span aria-hidden className="tuc-paleta-muestra" style={{ background: pl.bg, borderColor: pl.border }}>
                      <span style={{ height: 5, width: '58%', borderRadius: 3, background: pl.text }} />
                      <span style={{ height: 4, width: '80%', borderRadius: 3, background: pl.muted, opacity: 0.7 }} />
                      <span style={{ display: 'flex', gap: 5, marginTop: 'auto', alignItems: 'center' }}>
                        <span style={{ height: 14, flex: '0 0 46%', borderRadius: Math.min(radioPx, 7), background: pl.primary }} />
                        <span style={{ height: 14, flex: 1, borderRadius: Math.min(radioPx, 7), background: pl.surfaceAlt }} />
                      </span>
                    </span>
                    <span className="tuc-paleta-pie"><span className="tuc-mono">{c}</span>{a && <Check size={12} strokeWidth={3} aria-hidden />}</span>
                  </button>
                )
              })}
            </div>
            <div className="tuc-color-fila" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginTop: 18 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <Rotulo htmlFor="tuc-hex">Acento personalizado</Rotulo>
                <div className="tuc-field tuc-field--fila tuc-field--mono" style={{ paddingLeft: 7 }}>
                  <input type="color" aria-label="Elegir el color con el selector" value={color} onChange={e => b.set('color', e.target.value.toUpperCase())} className="tuc-color-pozo" />
                  <input id="tuc-hex" value={ap.color} maxLength={7} spellCheck={false} onChange={e => b.set('color', e.target.value.toUpperCase())} aria-invalid={!esHex(ap.color)} aria-describedby={esHex(ap.color) ? undefined : 'tuc-hex-error'} />
                </div>
              </div>
              <div role="img" aria-label="Muestra del botón con este color" style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 66, borderRadius: 12, background: paleta.bg, border: `1px solid ${paleta.border}`, padding: '0 12px', transition: 'background 240ms ease' }}>
                {muestraBoton(ap.estiloBoton, ap.boton || 'Reservar')}
              </div>
            </div>
            {!esHex(ap.color) && <div id="tuc-hex-error" role="alert" style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8 }}>Escribilo como #RRGGBB, por ejemplo #C9A36A. Mientras tanto se usa el color de la plantilla.</div>}
          </SecCard>

          <SecCard titulo="Tipografía" Icon={Type} bajada="Un par de letras: una para títulos y otra para textos. Cada muestra está escrita con su propia letra.">
            <div role="radiogroup" aria-label="Tipografía" className="tuc-grid-2">
              {TIPOGRAFIAS.map(t => {
                const a = t.id === ap.tipo
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={a} onClick={() => b.set('tipo', t.id)} className="tuc-opcion" aria-label={`${t.nombre}: ${t.titulo} para títulos y ${t.texto} para textos`}>
                    <span className="tuc-opcion-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>
                    <span style={{ display: 'block', fontFamily: t.fh, fontSize: 23, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, textTransform: t.mayus ? 'uppercase' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 24 }}>{ap.nombre || 'Tu negocio'}</span>
                    <span style={{ display: 'block', fontFamily: t.fb, fontSize: 12.5, color: 'var(--color-body)', marginTop: 7, lineHeight: 1.45 }}>Elegí día y horario en segundos, desde el celular.</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: a ? 'var(--color-primary)' : 'var(--color-text)' }}>{t.nombre}</span>
                      <span className="tuo-rotulo" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{t.titulo} + {t.texto}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </SecCard>

          <SecCard titulo="Bordes y botones" Icon={Square} bajada="Qué tan redondeados se ven botones, tarjetas y fotos, y cómo se dibuja el botón de reservar.">
            <Rotulo>Bordes</Rotulo>
            <div role="radiogroup" aria-label="Bordes" className="tuc-grid-4">
              {RADIOS.map(r => {
                const a = r.id === ap.radio
                return (
                  <button key={r.id} type="button" role="radio" aria-checked={a} onClick={() => b.set('radio', r.id)} className="tuc-opcion tuc-opcion--centro">
                    <span aria-hidden className="tuc-borde-muestra" style={{ borderRadius: Math.min(r.px * 0.9, 20), background: paleta.surface, borderColor: paleta.border }}>
                      <span style={{ height: 22, borderRadius: Math.min(r.px * 0.6, 12), background: paleta.surfaceAlt }} />
                      <span style={{ height: 12, width: '64%', borderRadius: Math.min(r.px, 6), background: paleta.primary }} />
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: a ? 700 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)' }}>{r.label}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ height: 18 }} />
            <Rotulo>Estilo del botón</Rotulo>
            <div role="radiogroup" aria-label="Estilo del botón" className="tuc-grid-3">
              {ESTILOS_BOTON.map(e => {
                const a = e.id === ap.estiloBoton
                return (
                  <button key={e.id} type="button" role="radio" aria-checked={a} onClick={() => b.set('estiloBoton', e.id)} className="tuc-opcion tuc-opcion--centro">
                    <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '100%', minHeight: 62, borderRadius: 10, background: paleta.bg, border: `1px solid ${paleta.border}`, padding: '0 8px', boxSizing: 'border-box' }}>{muestraBoton(e.id, 'Reservar')}</span>
                    <span>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: a ? 700 : 600, color: a ? 'var(--color-primary)' : 'var(--color-text)' }}>{e.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-muted)' }}>{e.ayuda}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </SecCard>

          <SecCard titulo="Logo" Icon={ImageIcon} bajada="Va en el encabezado del sitio y en los mensajes de WhatsApp.">
            <Logo ap={ap} tipoFh={tipo.fh} color={paleta.primary} sobre={paleta.onPrimary} onLogo={v => b.set('logo', v)} onMonograma={v => b.set('monograma', v)} />
          </SecCard>

          <SecCard titulo="Portada" Icon={LayoutTemplate} bajada="Lo primero que ven al entrar: la foto grande y el botón para reservar.">
            {/* La página simple tiene una sola composición: la foto arriba y todo lo demás debajo. */}
            {!simple && <Rotulo>Diseño de la portada</Rotulo>}
            <div role="radiogroup" aria-label="Diseño de la portada" className="tuc-grid-2" style={{ marginBottom: 18, ...(simple ? { display: 'none' } : null) }}>
              {([['sangre', 'A sangre', 'Foto de fondo, texto encima'], ['partido', 'Partida', 'Texto a un lado, foto al otro']] as const).map(([id, titulo, ayuda]) => {
                const a = ap.hero === id
                return (
                  <button key={id} type="button" role="radio" aria-checked={a} onClick={() => b.set('hero', id)} className="tuc-opcion tuc-opcion--mini">
                    <span className="tuc-opcion-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>
                    <span className="tuc-opcion-marco"><MiniSitio tema={{ ...temaActual, hero: id }} datos={datos} boton={ap.estiloBoton} /></span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: a ? 'var(--color-primary)' : 'var(--color-text)', marginTop: 10 }}>{titulo}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-muted)' }}>{ayuda}</span>
                  </button>
                )
              })}
            </div>
            <Rotulo ayuda="Horizontal y de al menos 1600 px de ancho se ve mejor.">Foto de portada</Rotulo>
            <div role="radiogroup" aria-label="Foto de portada" className="tuc-fotos">
              <label className="tuc-subir">
                <Upload size={17} aria-hidden />Subir foto
                <input type="file" accept="image/*" className="tuc-sr" onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const url = URL.createObjectURL(f)
                  setFotosSubidas(s => [url, ...s])
                  b.set('foto', url)
                }} />
              </label>
              {fotos.map((f, i) => {
                const a = f === ap.foto
                return (
                  <button key={f} type="button" role="radio" aria-checked={a} aria-label={`Foto ${i + 1}`} onClick={() => b.set('foto', f)} className="tuc-foto">
                    <img src={f} alt="" loading="lazy" />
                    <span className="tuc-foto-tilde" aria-hidden><Check size={12} strokeWidth={3} /></span>
                  </button>
                )
              })}
            </div>
          </SecCard>

          {simple && (
            <SecCard titulo="Qué muestra tu página" Icon={Smartphone} bajada="La página simple es una sola pantalla: no tiene secciones para prender ni ordenar.">
              <ul className="tuc-simple-lista">
                {EN_SIMPLE.map(x => <li key={x}><Check size={14} strokeWidth={2.6} aria-hidden />{x}</li>)}
              </ul>
            </SecCard>
          )}

          <SecCard titulo="Secciones de la página" Icon={PanelsTopLeft} bajada="Prendé, apagá y ordená lo que se muestra debajo de la portada: arrastrando o con las flechas." style={simple ? { display: 'none' } : undefined}
            badge={<Chip tono="primario"><span className="tuo-num">{ap.secciones.filter(s => s.on).length}/{ap.secciones.length}</span> visibles</Chip>}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--color-surface)', border: '1px dashed var(--color-border-strong)' }}>
                <Lock size={15} aria-hidden style={{ color: 'var(--color-subtle)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>Portada</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Siempre va primero</div>
                </div>
              </li>
              {ap.secciones.map((s, i) => {
                const m = metaSecciones.find(x => x.id === s.id)
                if (!m) return null
                const mover = (d: -1 | 1) => {
                  const lista = [...ap.secciones]
                  const j = i + d
                  if (j < 0 || j >= lista.length) return
                  ;[lista[i], lista[j]] = [lista[j], lista[i]]
                  b.set('secciones', lista)
                }
                return (
                  <li key={s.id} className="tuc-renglon tuc-seccion" data-on={s.on} data-arrastra={arrastra === s.id || undefined} draggable
                    onDragStart={e => { setArrastra(s.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id) }}
                    onDragOver={e => { if (arrastra) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
                    onDrop={e => { e.preventDefault(); soltarEn(i) }}
                    onDragEnd={() => setArrastra(null)}>
                    <GripVertical size={16} aria-hidden style={{ color: 'var(--color-subtle)', flexShrink: 0 }} />
                    <span className="tuc-fila-ico" aria-hidden style={s.on ? { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' } : undefined}><m.Icon size={15} strokeWidth={1.7} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                      <div className="tuc-seccion-ayuda">{m.ayuda}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <BotonFlecha label={`Subir ${m.label}`} disabled={i === 0} onClick={() => mover(-1)}><ChevronUp size={15} /></BotonFlecha>
                      <BotonFlecha label={`Bajar ${m.label}`} disabled={i === ap.secciones.length - 1} onClick={() => mover(1)}><ChevronDown size={15} /></BotonFlecha>
                    </div>
                    <Switch on={s.on} label={`Mostrar ${m.label}`} onChange={v => b.set('secciones', ap.secciones.map(x => x.id === s.id ? { ...x, on: v } : x))} />
                  </li>
                )
              })}
            </ol>
          </SecCard>

          <SecCard titulo="Textos" Icon={AlignLeft} bajada="Lo que dice la portada. Cortito se lee mejor en el celular.">
            <Campo label="Nombre visible" value={ap.nombre} onChange={v => b.set('nombre', v)} maxLength={40} ayuda="Puede ser distinto de la razón social." />
            <Campo label={simple ? 'Descripción corta' : 'Frase principal'} value={ap.frase} onChange={v => b.set('frase', v)} maxLength={90} area />
            <Campo label="Texto del botón principal" value={ap.boton} onChange={v => b.set('boton', v)} maxLength={24} style={{ marginBottom: 8 }} />
            <div role="group" aria-label="Textos sugeridos para el botón" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {botonesSugeridos(rubro).map(t => (
                <button key={t} type="button" aria-pressed={ap.boton === t} onClick={() => b.set('boton', t)} className="tuc-pastilla">{t}</button>
              ))}
            </div>
          </SecCard>
        </div>

        <aside className="tuc-ap-preview" aria-label="Vista previa">
          {preview('calc(100vh - 170px)')}
          <NotaAproximada />
        </aside>
      </div>

      <BarraGuardar dirty={dirty} onDescartar={descartar} onGuardar={guardar} />

      {previewAbierta && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa del sitio" className="tuc-velo" onClick={() => setPreviewAbierta(false)}
          onKeyDown={e => { if (e.key === 'Escape') setPreviewAbierta(false) }}
          style={{ display: 'flex', flexDirection: 'column', padding: 12, placeItems: 'stretch' }}>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--tuo-fh)', fontSize: 15, fontWeight: 600, color: '#fff' }}>Vista previa · {plantilla.nombre}</span>
              <button type="button" onClick={() => setPreviewAbierta(false)} aria-label="Cerrar vista previa" autoFocus className="tuc-cerrar-claro"><X size={18} aria-hidden /></button>
            </div>
            {preview('100%', true)}
          </div>
        </div>
      )}
    </div>
  )
}

function NotaAproximada() {
  return (
    <p style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: 'var(--color-muted)', margin: '12px 2px 0', lineHeight: 1.5 }}>
      <Info size={13} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <span>Vista previa aproximada: refleja la plantilla, los colores, la tipografía, los bordes y la foto de portada. El diseño de la portada, el estilo del botón, los textos, el logo y el orden de las secciones se ven en las miniaturas y al publicar.</span>
    </p>
  )
}

function BotonFlecha({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="tuc-icono">{children}</button>
}

function Logo({ ap, tipoFh, color, sobre, onLogo, onMonograma }: { ap: Ap; tipoFh: string; color: string; sobre: string; onLogo: (v: string | null) => void; onMonograma: (v: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="tuc-logo" style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        {ap.logo ? (
          <div className="tuc-renglon" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
            <img src={ap.logo} alt="Tu logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: 'var(--color-surface)' }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-body)' }}>Logo cargado</div>
            <button type="button" onClick={() => input.current?.click()} className="tuc-link">Cambiar</button>
            <button type="button" aria-label="Quitar logo" title="Quitar logo" onClick={() => onLogo(null)} className="tuc-icono tuc-icono--peligro"><Trash2 size={15} aria-hidden /></button>
          </div>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="tuc-subir" style={{ width: '100%', minHeight: 108, aspectRatio: 'auto' }}>
            <Upload size={18} aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Subí tu logo</span>
            <span style={{ fontSize: 11.5, fontWeight: 400 }}>PNG o SVG con fondo transparente, hasta 2 MB</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="tuc-sr" aria-label="Archivo del logo" tabIndex={-1}
          onChange={e => { const f = e.target.files?.[0]; if (f) onLogo(URL.createObjectURL(f)) }} />
      </div>
      <div className="tuc-renglon" style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
        <span aria-hidden style={{ width: 50, height: 50, borderRadius: '50%', background: color, color: sobre, display: 'grid', placeItems: 'center', fontFamily: tipoFh, fontSize: 19, fontWeight: 700, flexShrink: 0, opacity: ap.monograma || ap.logo ? 1 : 0.4, transition: 'opacity 200ms ease, background 240ms ease' }}>{iniciales(ap.nombre)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Monograma</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4 }}>{ap.logo ? 'Se usa como ícono de la pestaña' : 'Mientras no tengas logo, tus iniciales'}</div>
        </div>
        <Switch on={ap.monograma} onChange={onMonograma} label="Usar monograma" />
      </div>
    </div>
  )
}

// Estilos propios de esta pantalla. Van en ConfiguracionTurnos (una sola vez):
// ver CSS_CONFIG ahí.
export const CSS_APARIENCIA = `
  .tuc-forma-zona { margin: 0 0 26px; min-width: 0; }
  .tuc-formas { margin-top: 12px; max-width: 900px; }
  .tuc-forma { display: flex; align-items: flex-start; gap: 12px; text-align: left; padding: 14px 46px 14px 14px; }
  .tuc-forma-ico { width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center; color: var(--color-primary); background: var(--color-primary-bg); }
  .tuc-forma-tit { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); transition: color 160ms ease; }
  .tuc-forma[aria-checked='true'] .tuc-forma-tit { color: var(--color-primary); }
  .tuc-forma-txt { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
  .tuc-simple-lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; font-size: 13px; color: var(--color-body); }
  .tuc-simple-lista li { display: flex; align-items: flex-start; gap: 8px; line-height: 1.45; }
  .tuc-simple-lista svg { flex-shrink: 0; margin-top: 3px; color: var(--color-success); }
  .tuc-riel-zona { margin: 0 0 26px; min-width: 0; }
  .tuc-riel-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .tuc-riel-flechas { display: inline-flex; gap: 6px; }
  /* El riel scrollea de costado adentro suyo: la página nunca. El padding de arriba deja lugar a la tarjeta que se eleva. */
  .tuc-riel { display: flex; gap: 16px; overflow-x: auto; overflow-y: hidden; padding: 8px 4px 20px; margin: 0 -4px; scroll-snap-type: x proximity; scroll-padding: 0 4px; scrollbar-width: thin;
    scrollbar-color: var(--color-border-strong) transparent; -webkit-overflow-scrolling: touch; }
  .tuc-riel-item { flex: 0 0 min(312px, 80%); scroll-snap-align: start; display: flex; min-width: 0; }
  .tuc-riel-item > .tuc-plantilla { width: 100%; }

  .tuc-ap-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 28px; align-items: start; }
  .tuc-ap-preview { position: sticky; top: 16px; min-width: 0; }
  .tuc-solo-angosto { display: none; }
  .tuc-solo-ancho { display: inline-flex; }
  .tuc-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .tuc-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .tuc-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .tuc-opcion--centro { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 12px 10px; }
  .tuc-opcion--mini { padding: 8px 8px 12px; }
  .tuc-opcion-marco { display: block; border-radius: 9px; overflow: hidden; border: 1px solid var(--color-border); }
  .tuc-opcion--mini .tuc-opcion-tilde { z-index: 3; top: 14px; right: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .tuc-borde-muestra { width: 100%; max-width: 92px; box-sizing: border-box; padding: 8px; border: 1px solid; display: flex; flex-direction: column; gap: 7px; transition: border-radius 240ms ease; }

  .tuc-paletas { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
  .tuc-paleta { padding: 6px 6px 8px; border-radius: 14px; border: 1.5px solid var(--color-border); background: var(--color-bg); cursor: pointer; font-family: inherit; color: var(--color-muted); min-width: 0;
    transition: border-color 160ms ease, box-shadow 220ms ease, transform 220ms var(--tuo-ease, ease); }
  .tuc-paleta-muestra { display: flex; flex-direction: column; gap: 5px; height: 66px; box-sizing: border-box; padding: 9px; border-radius: 9px; border: 1px solid; }
  .tuc-paleta-pie { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 7px; font-size: 11px; font-weight: 500; }
  .tuc-paleta[aria-checked='true'] { border-color: var(--color-primary); color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }
  .tuc-paleta:focus-visible, .tuc-foto:focus-visible, .tuc-subir:focus-visible, .tuc-subir:focus-within, .tuc-cerrar-claro:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .tuc-color-pozo { width: 30px; height: 30px; flex: none !important; border: none; padding: 0; background: transparent; cursor: pointer; border-radius: 8px; }

  .tuc-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .tuc-subir { aspect-ratio: 4 / 3; border-radius: 12px; border: 1.5px dashed var(--color-border-strong); background: var(--color-surface); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    cursor: pointer; color: var(--color-muted); font-family: inherit; font-size: 11.5px; font-weight: 600; text-align: center; padding: 8px; box-sizing: border-box; transition: border-color 160ms ease, color 160ms ease, background 160ms ease; }
  .tuc-subir > svg { color: var(--color-primary); transition: transform 240ms var(--tuo-ease, ease); }
  .tuc-foto { position: relative; aspect-ratio: 4 / 3; border-radius: 12px; overflow: hidden; padding: 0; border: none; cursor: pointer; background: var(--color-surface-alt); transition: box-shadow 200ms ease; }
  .tuc-foto > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 500ms var(--tuo-ease, ease), filter 200ms ease; }
  .tuc-foto[aria-checked='true'] { box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4.5px var(--color-primary); }
  .tuc-foto-tilde { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: var(--tuo-grad); color: #fff; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    opacity: 0; transform: scale(0.6); transition: opacity 180ms ease, transform 240ms var(--tuo-ease, ease); }
  .tuc-foto[aria-checked='true'] .tuc-foto-tilde { opacity: 1; transform: none; }

  .tuc-seccion { display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; }
  .tuc-seccion > *, .tuc-seccion { transition: opacity 200ms ease, border-color 160ms ease, box-shadow 200ms ease; }
  .tuc-seccion[data-on='false'] > div:nth-of-type(1), .tuc-seccion[data-on='false'] > .tuc-fila-ico { opacity: 0.55; }
  .tuc-seccion[draggable='true'] { cursor: grab; }
  .tuc-seccion[data-arrastra='true'] { opacity: 0.5; border-style: dashed; border-color: var(--color-primary); }
  .tuc-seccion-ayuda { font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tuc-cerrar-claro { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.14); border: none; color: #fff; cursor: pointer; display: grid; place-items: center; transition: background 150ms ease; }

  @media (hover: hover) {
    .tuc-paleta:not([aria-checked='true']):hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
    .tuc-foto:hover > img { transform: scale(1.07); }
    .tuc-subir:hover { border-color: var(--color-primary); color: var(--color-text); background: var(--color-primary-bg); }
    .tuc-subir:hover > svg { transform: translateY(-2px); }
    .tuc-opcion--mini:hover .tuc-mini-lienzo { transform: scale(1.05); }
    .tuc-cerrar-claro:hover { background: rgba(255,255,255,0.26); }
  }
  @media (max-width: 1100px) {
    .tuc-ap-split { grid-template-columns: minmax(0, 1fr); }
    .tuc-ap-preview { display: none; }
    .tuc-solo-angosto { display: inline-flex; }
  }
  @media (max-width: 768px) {
    .tuc-solo-ancho { display: none; }
    .tuc-riel-flechas { display: none; }
    .tuc-seccion-ayuda { display: none; }
    .tuc-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .tuc-simple-lista { grid-template-columns: minmax(0, 1fr); }
    .tuc-grid-2 { grid-template-columns: minmax(0, 1fr); }
    .tuc-grid-3 { grid-template-columns: minmax(0, 1fr); }
    .tuc-grid-3 > .tuc-opcion--centro { flex-direction: row; text-align: left; }
    .tuc-grid-3 > .tuc-opcion--centro > span:first-child { width: 132px; flex-shrink: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tuc-paleta, .tuc-foto > img, .tuc-foto-tilde, .tuc-subir > svg, .tuc-borde-muestra { transition: none !important; }
    .tuc-paleta:hover, .tuc-foto:hover > img, .tuc-subir:hover > svg, .tuc-opcion--mini:hover .tuc-mini-lienzo { transform: none !important; }
    .tuc-riel { scroll-behavior: auto; }
  }
`
