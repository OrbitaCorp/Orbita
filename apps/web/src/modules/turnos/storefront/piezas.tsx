// Piezas compartidas del sitio público del negocio (portada, servicios,
// reserva, mis turnos). Todas pintan con las variables del TEMA del negocio
// (--color-*, --tu-*) que pone SitioNegocio en su raíz, así que sirven en las
// cinco plantillas sin saber cuál es.
//
// Acá vive también la firma de Órbita dentro del sitio del cliente: el motivo
// orbital (OrbitaMini, SemanaOrbita) y el sello del pie. Es firma, no marca: los
// anillos se dibujan con el color DEL NEGOCIO; el azul de Órbita aparece solo
// en el sello.
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, Gift, X } from 'lucide-react'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { arco, punto } from '@/modules/turnos/_shared/orbita/geometria'
import { clasesDe, horaTxt, pesos, recursosDe, semanaDe, type RubroTurnos } from '@/modules/turnos/datos'
import type { FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import { AHORA_DEMO, HOY_SEMANA, estadoA, tramosDelDia } from '@/modules/turnos/horario'
import { HOY as HOY_FECHA, esHoy, fechaCortaRelativa, nombreDia, nombreDiaCorto, proximosDias, sumarDias } from './reserva/calendario'
import { temaDe, type TemaNegocio } from './tema'

// ─── El "ahora" de la demo ───────────────────────────────────────────────────
// Todo el sitio cuenta la misma escena que la reserva y el panel: sábado
// 26/09/2026 a las 10:40 (horario.ts). Es una constante (no Date.now()) para
// que servidor y cliente dibujen lo mismo y react-compiler no se queje.
/** Día de hoy en t.horarios (0 = lunes): sábado. */
export const HOY = HOY_SEMANA
/** Minutos desde las 00:00. */
export const AHORA = AHORA_DEMO

// ─── Rutas ───────────────────────────────────────────────────────────────────

export type PaginaNegocio = 'inicio' | 'servicios' | 'reserva' | 'mis-turnos'

const RUTAS: Record<PaginaNegocio, string> = {
  inicio: '/turnos-demo/negocio', servicios: '/turnos-demo/negocio/servicios', reserva: '/turnos-demo/reserva', 'mis-turnos': '/turnos-demo/mis-turnos',
}

const RUTA_SIMPLE = '/turnos-demo/simple'

/**
 * Link a una página del sitio del negocio, conservando el rubro de la demo.
 *
 * Con `forma: 'simple'` en `extra`, el link se queda dentro de la página simple:
 * ahí no hay portada ni catálogo, así que "inicio" y "servicios" son la misma
 * pantalla, y la reserva y "mis turnos" se abren con el encabezado mínimo.
 */
export function ruta(pagina: PaginaNegocio, rubro: string, extra: Record<string, string | number> = {}, ancla = '') {
  const { forma, ...resto } = extra
  const simple = forma === 'simple'
  const aLaSimple = simple && (pagina === 'inicio' || pagina === 'servicios')
  const q = new URLSearchParams({ rubro, ...Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, String(v)])), ...(simple && !aLaSimple ? { forma: 'simple' } : {}) })
  return `${aLaSimple ? RUTA_SIMPLE : RUTAS[pagina]}?${q}${aLaSimple ? '' : ancla}`
}

// ─── Forma del sitio e identidad ─────────────────────────────────────────────

const FormaCtx = createContext<FormaSitio>('web')
/** Lo pone SitioNegocio: todo lo de adentro sabe si está en el sitio completo o en la página simple. */
export const FormaProvider = FormaCtx.Provider
/** La forma del sitio en la que está parada la página. Se pasa en `extra` a `ruta()` para no salirse de ella. */
export const useForma = () => useContext(FormaCtx)

/**
 * El tema del negocio. Lo que el dueño cargó en el alta y lo que guardó en
 * Configuración (plantilla, horarios) ya viene pegado al rubro (useRubroDemo).
 */
export function useTema(rubro: RubroTurnos): TemaNegocio {
  return useMemo(() => temaDe(rubro), [rubro])
}

/** La marca del negocio en chico: su logo si lo cargó; si no, el monograma con las iniciales. */
export function Marca({ t, className = 'tu-mono' }: { t: TemaNegocio; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- logo en data URL, cargado en el alta
  if (t.logo) return <span className={`${className} tu-mono--logo`} aria-hidden><img src={t.logo} alt="" /></span>
  return <span className={className} aria-hidden>{t.nombre.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
}

// ─── Ventanas ────────────────────────────────────────────────────────────────

/**
 * Lo que comparte toda ventana del sitio (legales, fotos en grande): al abrir,
 * el foco entra a la caja; al cerrar, vuelve a lo que la abrió. Tab da la
 * vuelta adentro y Escape la cierra.
 */
export function useDialogo<T extends HTMLElement>(onCerrar: () => void) {
  const caja = useRef<T>(null)
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    caja.current?.focus()
    return () => antes?.focus?.()
  }, [])
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onCerrar(); return }
    if (e.key !== 'Tab' || !caja.current) return
    const f = Array.from(caja.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')).filter(el => el.tabIndex >= 0)
    if (!f.length) return
    const foco = document.activeElement
    if (e.shiftKey && (foco === f[0] || foco === caja.current)) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && foco === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }
  return { caja, teclas }
}

/**
 * Ventana con título y botón de cerrar. Hay que montarla fuera de Reveal y de
 * cualquier caja con transform: el velo es position: fixed.
 */
export function Dialogo({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const { caja, teclas } = useDialogo<HTMLDivElement>(onCerrar)
  const id = useId()
  return (
    <div className="tu-velo" onClick={onCerrar} onKeyDown={teclas}>
      <div ref={caja} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="tu-dialogo" onClick={e => e.stopPropagation()}>
        <div className="tu-dialogo-cab">
          <h2 id={id} className="tu-h">{titulo}</h2>
          <button type="button" className="tu-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Revelado al hacer scroll ────────────────────────────────────────────────

/**
 * Revela el elemento cuando entra en pantalla.
 *
 * El estado de partida es VISIBLE: el HTML del servidor no esconde nada. Recién
 * en el cliente, y solo si el elemento está debajo del pliegue, la pestaña está
 * a la vista y la persona no pidió menos movimiento, se lo esconde (.tu-pre)
 * para animarlo al entrar. Si JS no corre, o el observer nunca dispara, el
 * contenido se ve igual: por eso además hay un respaldo por tiempo.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (document.visibilityState !== 'visible') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
    el.classList.add('tu-pre')
    const ver = () => { el.classList.remove('tu-pre'); el.classList.add('tu-on') }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ver(); io.disconnect() } }, { rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    const respaldo = setTimeout(ver, 4000)
    return () => { io.disconnect(); clearTimeout(respaldo); el.classList.remove('tu-pre') }
  }, [])
  return ref
}

export function Reveal({ children, delay = 0, className = '', style }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties }) {
  const ref = useReveal<HTMLDivElement>()
  return <div ref={ref} className={`tu-reveal ${className}`} style={{ ['--tu-d' as string]: `${delay}ms`, ...style }}>{children}</div>
}

// ─── Números y precios ───────────────────────────────────────────────────────

/** Precio en mono con números tabulares. Un servicio de $0 es "Sin cargo". */
export function Precio({ valor, size = 18, color, style }: { valor: number; size?: number; color?: string; style?: CSSProperties }) {
  return <span className="tu-num" style={{ fontSize: size, fontWeight: 600, color: color ?? 'var(--color-text)', whiteSpace: 'nowrap', ...style }}>{valor ? pesos(valor) : 'Sin cargo'}</span>
}

// ─── Tarjeta de sellos ───────────────────────────────────────────────────────

/**
 * La tarjeta de fidelidad del negocio: un sello por turno y, al completarla, un
 * premio. `total` lo define el dueño en Configuración. Se lee como texto
 * ("2 de 6 sellos"): los círculos acompañan.
 */
export function TarjetaSellos({ total, hechos, nombre, compacta }: { total: number; hechos: number; nombre: string; compacta?: boolean }) {
  const n = Math.min(Math.max(total, 1), 12)
  const h = Math.min(Math.max(hechos, 0), n)
  return (
    <div className="tu-sellos" data-compacta={!!compacta} role="img" aria-label={`Tarjeta de sellos de ${nombre}: ${h} de ${n} sellos`}>
      <div className="tu-sellos-cab" aria-hidden>
        <span className="tu-sellos-nombre">{nombre}</span>
        <span className="tu-num tu-sellos-cuenta">{h}/{n}</span>
      </div>
      <ul className="tu-sellos-fila" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="tu-sello-ficha" data-hecho={i < h} data-premio={i === n - 1}>
            {i === n - 1 ? <Gift size={compacta ? 14 : 17} /> : i < h ? <Check size={compacta ? 14 : 17} strokeWidth={2.6} /> : <span className="tu-num">{i + 1}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Fotos ───────────────────────────────────────────────────────────────────

/**
 * Foto dentro de su marco: recorta, hace el zoom suave al pasar el mouse y deja
 * un color de respaldo si el archivo faltara (nunca un cuadro roto).
 */
export function Foto({ src, alt, className = '', style, prioridad, children }: { src: string; alt: string; className?: string; style?: CSSProperties; prioridad?: boolean; children?: ReactNode }) {
  return (
    <span className={`tu-foto tu-zoom ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public, sin optimizador */}
      <img src={src} alt={alt} loading={prioridad ? 'eager' : 'lazy'} decoding="async" />
      {children}
    </span>
  )
}

// ─── Encabezado de sección ───────────────────────────────────────────────────

export function Encabezado({ eyebrow, titulo, bajada, accion, centro }: { eyebrow: string; titulo: ReactNode; bajada?: ReactNode; accion?: { label: string; href: string }; centro?: boolean }) {
  return (
    <div className="tu-enc" data-centro={!!centro}>
      <div className="tu-enc-txt">
        <div className="tu-eyebrow tu-eyebrow--raya">{eyebrow}</div>
        <h2 className="tu-h tu-h2">{titulo}</h2>
        {bajada && <p className="tu-bajada">{bajada}</p>}
      </div>
      {accion && <Link href={accion.href} className="tu-link">{accion.label} <ArrowRight size={16} aria-hidden /></Link>}
    </div>
  )
}

// ─── Abierto / cerrado ───────────────────────────────────────────────────────

/**
 * Estado del local a la hora de la demo, leído de los horarios del tema: abierto
 * (y hasta qué hora) o cerrado (y a qué hora vuelve a abrir hoy, si vuelve). Con
 * el día partido, "cierra" es el cierre de la mañana o el de la tarde.
 */
export const estadoLocal = (t: TemaNegocio) => estadoA(tramosDelDia(t.horarios, HOY), AHORA)

/** "Abierto ahora · cierra 13:00" o "Cerrado ahora · abre 16:00": punto que late + texto (el estado no depende del color). */
export function Abierto({ t, corto, style }: { t: TemaNegocio; corto?: boolean; style?: CSSProperties }) {
  const e = estadoLocal(t)
  return (
    <span className="tu-abierto" data-abierto={e.abierto} style={style}>
      <span className={e.abierto ? 'tu-vivo' : 'tu-vivo tu-vivo--off'} aria-hidden />
      <span>{e.abierto ? 'Abierto ahora' : 'Cerrado ahora'}</span>
      {!corto && e.abierto && <span className="tu-num tu-abierto-hora">cierra {e.cierra}</span>}
      {!corto && !e.abierto && e.abre && <span className="tu-num tu-abierto-hora">abre {e.abre}</span>}
    </span>
  )
}

/**
 * El horario de un día: cada turno de atención (la mañana, la tarde) es un tramo
 * que no se parte. En una columna ancha van en un renglón, separados por un
 * punto; en celular, o con `apilado` (columnas angostas como el pie), uno abajo
 * del otro.
 */
export function HorasDia({ texto, apilado }: { texto: string; apilado?: boolean }) {
  if (!texto) return <>Cerrado</>
  return <span className="tu-horas-dia tu-num" data-apilado={!!apilado}>{texto.split('·').map(p => <span key={p}>{p.trim()}</span>)}</span>
}

// ─── Motivo orbital ──────────────────────────────────────────────────────────

/**
 * La órbita en chico: planeta, anillo y un satélite dando la vuelta. Marca los
 * momentos "en vivo" del sitio (próximo turno libre, cierre). Decorativa.
 */
export function OrbitaMini({ size = 64, color = 'var(--color-primary)', lento }: { size?: number; color?: string; lento?: boolean }) {
  return (
    <svg aria-hidden className="tu-orbita-mini" viewBox="0 0 64 64" width={size} height={size} style={{ flexShrink: 0, display: 'block', color, overflow: 'visible' }}>
      <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" strokeDasharray="1.5 4.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" />
      <circle cx="32" cy="32" r="12" fill="currentColor" opacity=".14" />
      <circle cx="32" cy="32" r="6.5" fill="currentColor" />
      <g className="tu-orbita-gira" style={{ transformOrigin: '32px 32px', animationDuration: lento ? '14s' : '7s' }}>
        <circle cx="32" cy="5" r="6" fill="currentColor" opacity=".22" />
        <circle cx="32" cy="5" r="3" fill="currentColor" />
      </g>
      <g className="tu-orbita-gira tu-orbita-gira--rev" style={{ transformOrigin: '32px 32px', animationDuration: lento ? '22s' : '11s' }}>
        <circle cx="49" cy="32" r="1.8" fill="currentColor" opacity=".8" />
      </g>
    </svg>
  )
}

export interface Proximo { rotulo: string; cuando: string; hora: string; detalle: string; otros: number[]; extra: Record<string, string | number> }

/**
 * Próximo hueco de la agenda, según cómo agenda el rubro. Sale del horario del
 * negocio (semanaDe), igual que el calendario de la reserva: si ahora está en el
 * corte del mediodía, el próximo es el primero de la tarde.
 */
export function proximoLibre(rubro: RubroTurnos): Proximo {
  if (rubro.modo === 'cupo') {
    const rotulo = 'Próxima clase con lugar'
    const conLugar = clasesDe(rubro).filter(c => c.cupo > c.anotados)
    // Hoy, lo que queda del día; después, día por día hasta dar con una clase con lugar.
    for (let k = 0; k < 7; k++) {
      const dia = (HOY + k) % 7
      const c = conLugar.filter(x => x.dia === dia && (k > 0 || x.inicio >= AHORA)).sort((a, b) => a.inicio - b.inicio)[0]
      if (c) return { rotulo, cuando: fechaCortaRelativa(sumarDias(HOY_FECHA, k)), hora: horaTxt(c.inicio), detalle: `${c.nombre} · ${c.cupo - c.anotados} lugares`, otros: [], extra: { clase: c.id } }
    }
    return { rotulo, cuando: 'Pronto', hora: '—', detalle: rubro.servicios[0].nombre, otros: [], extra: {} }
  }
  const recursos = recursosDe(rubro)
  const quien = recursos[1] ?? recursos[0]
  const detalle = rubro.modo === 'profesional' ? `con ${quien.nombre.split(' ')[0]}` : `en ${quien.nombre}`
  const rotulo = rubro.modo === 'cancha' ? 'Próxima cancha libre' : 'Próximo turno libre'
  const extra = { con: quien.id }
  const dia = proximosDias(semanaDe(rubro), rubro.servicios[0]?.duracion ?? 30, 14).find(d => d.libres > 0)
  if (!dia) return { rotulo, cuando: 'Pronto', hora: '—', detalle, otros: [], extra }
  const libres = dia.grilla.filter(g => g.libre).map(g => g.m)
  return { rotulo, cuando: fechaCortaRelativa(dia.f), hora: horaTxt(libres[0]), detalle, otros: libres.slice(1, 4), extra }
}

/**
 * Tarjeta "próximo turno libre": la órbita a la izquierda, la hora en mono y
 * los horarios que siguen como atajos. `vidrio` la deja translúcida para
 * flotar sobre una foto.
 */
export function ProximoLibre({ rubro, vidrio, style }: { rubro: RubroTurnos; vidrio?: boolean; style?: CSSProperties }) {
  const p = proximoLibre(rubro)
  const forma = useForma()
  return (
    <div className="tu-prox tu-spot" data-vidrio={!!vidrio} style={style}>
      <Link href={ruta('reserva', rubro.key, { ...p.extra, forma })} className="tu-prox-main" aria-label={`${p.rotulo}: ${p.cuando} a las ${p.hora}, ${p.detalle}. Reservar`}>
        <OrbitaMini size={60} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="tu-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="tu-vivo" aria-hidden /> {p.rotulo}</span>
          <span className="tu-prox-hora"><span className="tu-prox-cuando">{p.cuando}</span><span className="tu-num">{p.hora}</span></span>
          <span className="tu-prox-det">{p.detalle}</span>
        </span>
        <span className="tu-prox-ir" aria-hidden><ArrowUpRight size={18} /></span>
      </Link>
      {p.otros.length > 0 && (
        <div className="tu-prox-otros">
          <span className="tu-rotulo">También {p.cuando.toLowerCase()}</span>
          {p.otros.map(h => <Link key={h} href={ruta('reserva', rubro.key, { ...p.extra, forma })} className="tu-hora" aria-label={`Reservar ${p.cuando.toLowerCase()} a las ${horaTxt(h)}`}>{horaTxt(h)}</Link>)}
        </div>
      )}
    </div>
  )
}

// Los próximos siete días, contados igual que el calendario de Reserva (salen
// del mismo horario del negocio): el día que no abre figura cerrado y el
// miércoles 30 ya no tiene lugar.
export interface DiaSemana { corto: string; largo: string; n: number; libres: number; total: number; primero?: number; cerrado?: boolean; hoy?: boolean }

/** Cómo se nombra el día que cae a `k` días de hoy. */
function rotulosDia(k: number) {
  const f = sumarDias(HOY_FECHA, k)
  const hoy = esHoy(f)
  return { corto: nombreDiaCorto(f), largo: hoy ? `Hoy, ${nombreDia(f).toLowerCase()} ${f.dia}` : `${nombreDia(f)} ${f.dia}`, n: f.dia, hoy }
}

/** La semana de un negocio que da turnos: cuántos horarios le quedan a cada día y cuál es el primero. */
function semanaDeTurnos(rubro: RubroTurnos): DiaSemana[] {
  return proximosDias(semanaDe(rubro), rubro.servicios[0]?.duracion ?? 30, 7).map((d, k) => ({
    ...rotulosDia(k), libres: d.libres, total: d.grilla.length, primero: d.grilla.find(g => g.libre)?.m, cerrado: d.cerrado,
  }))
}

/**
 * La semana de un rubro con cupo sale de su grilla de clases (no del calendario
 * de turnos): cuántas clases quedan con lugar cada día y a qué hora es la primera.
 */
function semanaDeClases(rubro: RubroTurnos): DiaSemana[] {
  const clases = clasesDe(rubro)
  return Array.from({ length: 7 }, (_, k) => {
    const d = rotulosDia(k)
    const dia = (HOY + k) % 7
    const delDia = clases.filter(c => c.dia === dia && (!d.hoy || c.inicio >= AHORA))
    const conLugar = delDia.filter(c => c.cupo > c.anotados).sort((a, b) => a.inicio - b.inicio)
    return { ...d, cerrado: delDia.length === 0 && !d.hoy, libres: conLugar.length, total: delDia.length, primero: conLugar[0]?.inicio }
  })
}

const estadoDia = (d: DiaSemana, cupo: boolean) => d.cerrado ? 'Cerrado' : d.libres === 0 ? 'Completo'
  : cupo ? `${d.libres} ${d.libres === 1 ? 'clase' : 'clases'} con lugar` : `${d.libres} ${d.libres === 1 ? 'horario libre' : 'horarios libres'}`

/**
 * La semana en órbita: siete tramos de anillo, uno por día. Cuanto más lleno de
 * color el tramo, más lugar queda ese día. Al lado, la misma información en
 * texto (es la que se lee y se navega; el anillo acompaña).
 */
export function SemanaOrbita({ rubro }: { rubro: RubroTurnos }) {
  const [foco, setFoco] = useState<number | null>(null)
  const cupo = rubro.modo === 'cupo'
  const dias = cupo ? semanaDeClases(rubro) : semanaDeTurnos(rubro)
  const C = 170, R = 118, PASO = 360 / 7, HUECO = 9
  // Sin nada señalado, el centro muestra el primer día con lugar (casi siempre, hoy).
  const d = dias[foco ?? Math.max(0, dias.findIndex(x => x.primero !== undefined))]
  return (
    <div className="tu-semana">
      <svg aria-hidden viewBox="0 0 340 340" className="tu-semana-svg" data-con-foco={foco !== null}>
        <circle cx={C} cy={C} r={84} fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="1.5 6" strokeLinecap="round" />
        <g className="tu-orbita-gira" style={{ transformOrigin: `${C}px ${C}px`, animationDuration: '26s' }}>
          <circle cx={C} cy={C - 84} r="7" fill="var(--color-primary)" opacity=".2" />
          <circle cx={C} cy={C - 84} r="3.5" fill="var(--color-primary)" />
        </g>
        {dias.map((x, i) => {
          const a1 = -90 + i * PASO + HUECO / 2
          const a2 = a1 + PASO - HUECO
          const lleno = x.total ? x.libres / x.total : 0
          const [tx, ty] = punto(C, C, R + 30, (a1 + a2) / 2)
          return (
            <g key={x.corto} className="tu-semana-dia" data-foco={foco === i} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
              {/* Zona de contacto ancha e invisible, para que el tramo sea fácil de señalar. */}
              <path d={arco(C, C, R, a1, a2)} fill="none" stroke="transparent" strokeWidth={46} />
              <path d={arco(C, C, R, a1, a2)} fill="none" stroke="var(--color-surface-alt)" strokeWidth={13} strokeLinecap="round" strokeDasharray={x.cerrado ? '1 9' : undefined} />
              {lleno > 0 && <path className="tu-semana-tramo" d={arco(C, C, R, a1, a1 + (a2 - a1) * lleno)} fill="none" stroke="var(--color-primary)" strokeWidth={13} strokeLinecap="round" opacity={x.hoy ? 1 : 0.72} />}
              <text x={tx} y={ty - 6} textAnchor="middle" dominantBaseline="central" className="tu-semana-rot" data-hoy={!!x.hoy}>{x.corto.toUpperCase()}</text>
              <text x={tx} y={ty + 8} textAnchor="middle" dominantBaseline="central" className="tu-semana-num">{x.n}</text>
            </g>
          )
        })}
        <text x={C} y={C - 30} textAnchor="middle" className="tu-semana-rot">{foco === null ? (cupo ? 'PRÓXIMA CLASE' : 'PRÓXIMO LIBRE') : d.largo.toUpperCase()}</text>
        <text x={C} y={C + 10} textAnchor="middle" className="tu-semana-hora">{d.primero !== undefined ? horaTxt(d.primero) : '—'}</text>
        <text x={C} y={C + 34} textAnchor="middle" className="tu-semana-pie">{foco === null ? d.largo : estadoDia(d, cupo)}</text>
      </svg>

      <ul className="tu-semana-lista">
        {dias.map((x, i) => {
          const sin = x.cerrado || x.libres === 0
          const fila = (
            <>
              <span className="tu-semana-fecha"><span className="tu-num">{String(x.n).padStart(2, '0')}</span><span>{x.corto}</span></span>
              <span className="tu-semana-est">{estadoDia(x, cupo)}{x.hoy && <span className="tu-chip-hoy">Hoy</span>}</span>
              <span className="tu-num tu-semana-desde">{x.primero !== undefined ? `desde ${horaTxt(x.primero)}` : ''}</span>
              {!sin && <ArrowRight size={16} aria-hidden className="tu-semana-ir" />}
            </>
          )
          return (
            <li key={x.corto} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
              {sin
                ? <div className="tu-semana-fila" data-sin="true" data-foco={foco === i}>{fila}</div>
                : <Link href={ruta('reserva', rubro.key)} className="tu-semana-fila" data-foco={foco === i} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}>{fila}</Link>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Anillos concéntricos con satélites, en el color que herede (currentColor). Fondo decorativo. */
export function AnillosTema({ size = 520, style, className = '' }: { size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 400" width={size} height={size} className={`tu-anillos ${className}`} style={style}>
      <circle cx="200" cy="200" r="196" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1" strokeDasharray="2 8" strokeLinecap="round" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="1" />
      <circle cx="200" cy="200" r="104" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="1" />
      <circle cx="200" cy="200" r="58" fill="currentColor" opacity=".08" />
      <g className="tu-orbita-gira" style={{ transformOrigin: '200px 200px', animationDuration: '38s' }}>
        <circle cx="200" cy="50" r="10" fill="currentColor" opacity=".2" />
        <circle cx="200" cy="50" r="4.5" fill="currentColor" />
      </g>
      <g className="tu-orbita-gira tu-orbita-gira--rev" style={{ transformOrigin: '200px 200px', animationDuration: '24s' }}>
        <circle cx="304" cy="200" r="3.5" fill="currentColor" opacity=".8" />
      </g>
    </svg>
  )
}

/**
 * Sello del pie: "Reservas con Órbita". Es el único lugar del sitio del
 * negocio donde aparece el azul de Órbita (por eso fija --color-primary).
 */
export function SelloOrbita() {
  return (
    <a href="https://orbita.site" target="_blank" rel="noopener noreferrer" className="tu-sello" aria-label="Reservas con Órbita (se abre en otra pestaña)">
      <span style={{ ['--color-primary' as string]: '#3B82F6', display: 'inline-flex' }}><OrbitaLogo size={26} /></span>
      <span className="tu-sello-txt">
        <span className="tu-sello-rot">Reservas con</span>
        <span className="tu-sello-marca">Órbita</span>
      </span>
    </a>
  )
}
