// Envoltorio de TODAS las páginas públicas de un negocio de turnos (inicio,
// servicios, reserva, mis turnos). Hace lo mismo que StorefrontChrome en
// Tienda: aplica la paleta y la tipografía del negocio como variables CSS en
// su raíz —las hereda todo lo de adentro—, dibuja el header y el pie, y carga
// las fuentes. Cada página solo pone su contenido.
//
// La raíz además publica la FORMA de la plantilla en atributos (data-estilo,
// data-tarjeta, data-forma, data-textura): el kit de estilos.ts los lee para
// que las mismas clases (tu-card, tu-btn, tu-hora…) dibujen distinto en cada
// negocio. El kit y las piezas viven en estilos.ts y piezas.tsx; acá se
// reexporta lo que las páginas ya importaban de este archivo.
//
// Un negocio elige entre dos formas de sitio (prop `forma`):
//  · 'web'    → sitio completo: menú con secciones, pie con columnas y barra de
//               reserva fija en celular.
//  · 'simple' → una sola página con el botón de reservar. Acá el envoltorio casi
//               desaparece: la portada no lleva encabezado (la página ES la
//               marca) y la reserva y "mis turnos" llevan uno mínimo para volver.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Menu, X, CalendarCheck, MapPin, Phone, AtSign, ArrowRight, ArrowLeft, ChevronRight, Home } from 'lucide-react'
import { cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import { CSS_SITIO } from './estilos'
import { ContactoProvider, DialogoContacto, type Contacto } from './ContactoDemo'
import { Legales, LEGALES, type Legal } from './Legales'
import { AnillosTema, FormaProvider, HorasDia, Marca, SelloOrbita, proximoLibre, ruta, useTema, type PaginaNegocio } from './piezas'
import { linkMapa } from './reserva/acciones'
import { variablesTema, type TemaNegocio } from './tema'
import { useCalendarioReserva } from './reserva/calendario'

export { ruta, useReveal, Reveal } from './piezas'
export type { PaginaNegocio } from './piezas'

interface Props {
  rubro: RubroTurnos
  pagina: PaginaNegocio
  /** Sitio completo o página simple. */
  forma?: FormaSitio
  /** El header arranca transparente sobre una foto (hero a sangre del inicio). */
  sobreFoto?: boolean
  /** Barra fija de "Reservar" abajo en celular. */
  ctaMovil?: boolean
  children: (t: TemaNegocio) => ReactNode
}

export default function SitioNegocio({ rubro, pagina, forma = 'web', sobreFoto, ctaMovil = true, children }: Props) {
  const t = useTema(rubro)
  const cal = useCalendarioReserva()
  const HOY = cal.ahora.diaSemana
  const simple = forma === 'simple'
  const [solido, setSolido] = useState(!sobreFoto)
  const [menu, setMenu] = useState(false)
  const [legal, setLegal] = useState<Legal | null>(null)
  const [contacto, setContacto] = useState<Contacto | null>(null)

  const barra = useRef<HTMLDivElement>(null)
  // Las fuentes de las plantillas de Tienda (compartidas) y, por <link>, las propias del tema.
  useEffect(() => { cargarFuentes() }, [])
  // Marca que la página ya hidrató (un efecto corre después de que React terminó
  // con todo el árbol). La vista previa del panel (VistaPrevia) espera esta marca
  // antes de vestir el sitio desde afuera: si le pisa los estilos antes, React
  // encuentra un HTML distinto del que mandó el servidor.
  useEffect(() => { document.documentElement.dataset.tuListo = 'si' }, [])
  useEffect(() => {
    // Una sola escucha para toda la página: la tarjeta bajo el mouse recibe --mx/--my.
    const mover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = (e.target as HTMLElement | null)?.closest?.('.tu-spot') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    const progreso = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      if (barra.current) barra.current.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`
      if (sobreFoto) setSolido(window.scrollY > 60)
    }
    // Primer cálculo en el próximo cuadro (no sincrónico dentro del effect).
    const raf = requestAnimationFrame(progreso)
    window.addEventListener('pointermove', mover, { passive: true })
    window.addEventListener('scroll', progreso, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', mover); window.removeEventListener('scroll', progreso) }
  }, [sobreFoto])
  useEffect(() => {
    // El menú de celular se cierra con Escape.
    if (!menu) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [menu])

  const conLocal = t.modalidades.includes('local')
  const nav: { label: string; href: string; actual?: boolean }[] = [
    { label: rubro.modo === 'cupo' ? 'Actividades' : 'Servicios', href: ruta('servicios', rubro.key), actual: pagina === 'servicios' },
    ...(rubro.modo === 'profesional' ? [{ label: 'Equipo', href: ruta('inicio', rubro.key, {}, '#equipo') }] : []),
    { label: 'Nosotros', href: ruta('inicio', rubro.key, {}, '#nosotros') },
    { label: conLocal ? 'Cómo llegar' : 'Dónde atendemos', href: ruta('inicio', rubro.key, {}, '#ubicacion') },
  ]
  const transparente = !!sobreFoto && !solido && !menu
  const reservar = rubro.modo === 'cupo' ? 'Reservar lugar' : rubro.modo === 'cancha' ? 'Reservar cancha' : 'Reservar turno'
  const prox = proximoLibre(rubro, cal)
  const fuentes = `https://fonts.googleapis.com/css2?${t.fuentes.map(f => `family=${f}`).join('&')}&display=swap`
  const barraMovil = !simple && ctaMovil && pagina !== 'reserva'

  return (
    <div
      className="tu-sitio" data-estilo={t.estilo} data-tarjeta={t.tarjeta} data-forma={t.forma} data-textura={t.textura} data-boton={t.boton}
      data-mayus={!!t.mayus} data-oscuro={t.oscuro} data-cta-movil={barraMovil} data-sitio={forma}
      style={{ ...variablesTema(t), minHeight: '100vh' } as React.CSSProperties}
    >
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* La tipografía es del negocio: cambia por tema, por eso no va en _document. */}
        <link key="tu-fuentes" rel="stylesheet" href={fuentes} />
      </Head>
      <style>{CSS_SITIO}</style>
      <div aria-hidden className="tu-textura" />
      {t.textura === 'grano' && <div aria-hidden className="tu-grano" />}

      {!simple && (
        <header className="tu-header" data-fijo={!!sobreFoto} data-transparente={transparente}>
          <div ref={barra} aria-hidden className="tu-progreso" />
          <div className="tu-cont tu-header-barra">
            <Link href={ruta('inicio', rubro.key)} className="tu-marca" aria-label={`${t.nombre}, ir al inicio`}>
              <Marca t={t} />
              <span className="tu-marca-nombre">{t.nombre}</span>
            </Link>
            <nav className="tu-nav tu-nav-desk" aria-label="Secciones">
              {nav.map(n => <Link key={n.label} href={n.href} className="tu-nav-a" aria-current={n.actual ? 'page' : undefined}>{n.label}</Link>)}
            </nav>
            <div className="tu-acciones">
              <Link href={ruta('mis-turnos', rubro.key)} className="tu-nav-a tu-nav-desk" aria-current={pagina === 'mis-turnos' ? 'page' : undefined}>
                <CalendarCheck size={16} aria-hidden /> Mis turnos
              </Link>
              {pagina !== 'reserva' && (
                <Link href={ruta('reserva', rubro.key)} className="tu-btn tu-nav-desk" style={{ height: 44, padding: '0 20px' }}>{reservar}</Link>
              )}
              <button type="button" className="tu-hamb tu-nav-movil" onClick={() => setMenu(m => !m)} aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} aria-controls="tu-menu">
                {menu ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
              </button>
            </div>
          </div>
          {menu && (
            <nav id="tu-menu" className="tu-menu tu-nav-movil tu-entra" aria-label="Menú">
              {[...nav, { label: 'Mis turnos', href: ruta('mis-turnos', rubro.key) }].map(n => (
                <Link key={n.label} href={n.href} onClick={() => setMenu(false)}>{n.label} <ChevronRight size={18} aria-hidden style={{ color: t.c.primary }} /></Link>
              ))}
              <Link href={ruta('reserva', rubro.key)} className="tu-btn tu-btn--lg" onClick={() => setMenu(false)}>{reservar} <ArrowRight size={18} aria-hidden /></Link>
            </nav>
          )}
        </header>
      )}

      {/* Página simple: la portada no lleva encabezado; la reserva y "mis turnos", uno mínimo para volver. */}
      {simple && pagina !== 'inicio' && (
        <header className="tu-header tu-header--simple">
          <div className="tu-cont tu-header-barra">
            <Link href={ruta('inicio', rubro.key, { forma })} className="tu-volver" aria-label={`Volver a ${t.nombre}`}><ArrowLeft size={18} aria-hidden /></Link>
            <Link href={ruta('inicio', rubro.key, { forma })} className="tu-marca" aria-label={`${t.nombre}, ir al inicio`}>
              <Marca t={t} />
              <span className="tu-marca-nombre">{t.nombre}</span>
            </Link>
            <div className="tu-acciones">
              {pagina === 'mis-turnos'
                ? <Link href={ruta('reserva', rubro.key, { forma })} className="tu-btn" style={{ height: 44, padding: '0 18px' }}>{reservar}</Link>
                : <Link href={ruta('mis-turnos', rubro.key, { forma })} className="tu-nav-a"><CalendarCheck size={16} aria-hidden /> Mis turnos</Link>}
            </div>
          </div>
        </header>
      )}

      {/* Los botones de WhatsApp de las páginas abren el chat simulado de acá abajo. */}
      <FormaProvider value={forma}>
        <ContactoProvider value={setContacto}><main>{children(t)}</main></ContactoProvider>
      </FormaProvider>

      {simple ? (
        <footer className="tu-pie tu-pie--simple">
          <div className="tu-cont tu-pie-base">
            {LEGALES.map(l => <button key={l.id} type="button" className="tu-link-suave" onClick={() => setLegal(l.id)}>{l.label}</button>)}
            <SelloOrbita />
          </div>
        </footer>
      ) : (
        <footer className="tu-pie">
          <AnillosTema size={560} className="tu-pie-anillos" />
          <div className="tu-cont tu-pie-cols">
            <div>
              <div className="tu-h tu-pie-nombre">{t.nombre}</div>
              <p className="tu-pie-tag">{t.tagline.replace(/\.$/, '')}.</p>
              {pagina !== 'reserva' && <Link href={ruta('reserva', rubro.key)} className="tu-btn">{reservar} <ArrowRight size={16} aria-hidden /></Link>}
            </div>
            <nav className="tu-pie-col" aria-label="Pie de página">
              <span className="tu-rotulo">El sitio</span>
              <ul>
                <li><Link href={ruta('inicio', rubro.key)} className="tu-link-suave">Inicio</Link></li>
                {nav.map(n => <li key={n.label}><Link href={n.href} className="tu-link-suave">{n.label}</Link></li>)}
                <li><Link href={ruta('mis-turnos', rubro.key)} className="tu-link-suave">Mis turnos</Link></li>
              </ul>
            </nav>
            <div className="tu-pie-col">
              <span className="tu-rotulo">{conLocal ? 'Visitanos' : 'Contacto'}</span>
              <ul>
                {conLocal && <li><a href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer" className="tu-link-suave"><MapPin size={15} aria-hidden /> {[t.direccion, t.barrio].filter(Boolean).join(', ')}</a></li>}
                {t.modalidades.includes('domicilio') && <li><span className="tu-dato"><Home size={15} aria-hidden /> A domicilio</span></li>}
                <li><span className="tu-dato"><Phone size={15} aria-hidden /> <span className="tu-num">{t.telefono}</span></span></li>
                <li><button type="button" className="tu-link-suave" onClick={() => setContacto({ canal: 'instagram' })}><AtSign size={15} aria-hidden /> {t.instagram}</button></li>
              </ul>
            </div>
            <div className="tu-pie-col">
              <span className="tu-rotulo">Horarios</span>
              {t.horarios.map(([d, h], i) => (
                <div key={d} className="tu-pie-hor" data-hoy={i === HOY} data-cerrado={!h}>
                  <span>{d}</span><HorasDia texto={h} apilado />
                </div>
              ))}
            </div>
          </div>
          <div className="tu-cont tu-pie-base">
            {LEGALES.map(l => <button key={l.id} type="button" className="tu-link-suave" onClick={() => setLegal(l.id)}>{l.label}</button>)}
            <SelloOrbita />
          </div>
        </footer>
      )}
      {/* Acá, en la raíz: el velo es fixed y no puede quedar dentro de una caja con transform. */}
      {legal && <Legales key={legal} cual={legal} t={t} onCerrar={() => setLegal(null)} />}
      {contacto && <FormaProvider value={forma}><DialogoContacto c={contacto} t={t} rubro={rubro} onCerrar={() => setContacto(null)} /></FormaProvider>}

      {barraMovil && (
        <div className="tu-movil-cta">
          <span className="tu-movil-cta-txt">
            <span className="tu-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="tu-vivo" aria-hidden /> Próximo libre</span>
            <b><span>{prox.cuando}</span> <span className="tu-num">{prox.hora}</span></b>
          </span>
          <Link href={ruta('reserva', rubro.key)} className="tu-btn"><CalendarCheck size={18} aria-hidden /> {reservar}</Link>
        </div>
      )}
    </div>
  )
}
