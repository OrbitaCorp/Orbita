// DEMO INTERNA — índice del vertical Turnos & Agenda.
// http://localhost:3001/turnos-demo — ver modules/turnos/datos.ts.
//
// Está pensado como un centro de control: arriba el día en órbita del rubro
// elegido (la misma pieza que usa el panel), en el medio las pantallas de la
// demo y abajo los 32 rubros. Cambiar de rubro acá cambia todas las pantallas,
// porque el rubro viaja en ?rubro=.
import { useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { ArrowRight, ArrowUpRight, CalendarCheck, CalendarX2, Check, Globe, LayoutDashboard, ListChecks, Megaphone, Rocket, Search, SearchX, Smartphone, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BarraDemo, SelectorRubro, useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import { FAMILIAS, RUBROS_TURNOS, MODO_LABEL, pesos, duracionTxt, recursosDe, turnosDeHoy, clientesDe, type FamiliaId } from '@/modules/turnos/datos'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { OrbitaDia } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Estrellas, Anillos } from '@/modules/turnos/_shared/orbita/Cielo'
import { RelojTurnos, fechaLarga, semillaReloj, useReloj } from '@/modules/turnos/reloj'

// Solo en localhost, igual que /propuestas: en producción no existe.
export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: { reloj: semillaReloj() } }

type Boceto = 'onboarding' | 'panel' | 'sitio' | 'simple' | 'servicios' | 'reserva' | 'mis-turnos' | 'vacio' | 'landing'

const PANTALLAS: { href: string; titulo: string; texto: string; Icon: LucideIcon; boceto: Boceto; para: string }[] = [
  { href: '/turnos-demo/onboarding', titulo: 'Alta',             texto: 'El alta única, con los pasos en órbita: se elige el módulo (Tienda o Turnos) y pide lo que ese módulo necesita.', Icon: Rocket, boceto: 'onboarding', para: 'Dueño' },
  { href: '/turnos-demo/panel',      titulo: 'Panel del negocio', texto: 'Resumen del día, agenda, clases, servicios, equipo y clientes.', Icon: LayoutDashboard, boceto: 'panel', para: 'Dueño' },
  { href: '/turnos-demo/negocio',    titulo: 'Sitio web',        texto: 'La forma completa: portada, servicios, equipo, nosotros, fotos y cómo llegar, con la marca del negocio.', Icon: Store, boceto: 'sitio', para: 'Cliente' },
  { href: '/turnos-demo/simple',     titulo: 'Página simple',    texto: 'La otra forma: una sola pantalla con la portada, el logo, el nombre, una descripción corta y el botón de reservar.', Icon: Smartphone, boceto: 'simple', para: 'Cliente' },
  { href: '/turnos-demo/negocio/servicios', titulo: 'Servicios y precios', texto: 'El catálogo del negocio, con buscador y reserva directa.', Icon: ListChecks, boceto: 'servicios', para: 'Cliente' },
  { href: '/turnos-demo/reserva',    titulo: 'Reserva pública',   texto: 'Sin registrarse: servicio, profesional, día y horario, datos, seña y confirmación.', Icon: Globe, boceto: 'reserva', para: 'Cliente' },
  { href: '/turnos-demo/mis-turnos', titulo: 'Mis turnos',        texto: 'El cliente entra con su celular: próximo turno, reprogramar, cancelar, historial.', Icon: CalendarCheck, boceto: 'mis-turnos', para: 'Cliente' },
  { href: '/turnos-demo/reserva?estado=vacio', titulo: 'Reserva sin servicios', texto: 'El estado vacío: el negocio todavía no publicó su agenda.', Icon: CalendarX2, boceto: 'vacio', para: 'Cliente' },
  { href: '/turnos-demo/landing',    titulo: 'Landing',           texto: 'La sección de Turnos para orbita.site, como adelanto.', Icon: Megaphone, boceto: 'landing', para: 'Órbita' },
]

const FAMILIA_CORTA: Record<FamiliaId, string> = { belleza: 'Belleza', salud: 'Salud', deporte: 'Deporte', clases: 'Clases' }

// Para buscar sin que importen los acentos ni las mayúsculas ("estetica" encuentra "Estética").
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const CSS_INDICE = `
  .tui { min-height: calc(100vh - 40px); background: var(--color-surface); color: var(--color-body); }
  .tui-ancho { max-width: 1240px; margin: 0 auto; padding: 0 24px; }

  /* ── Hero ── */
  .tui-hero { padding: 56px 0 64px; border-bottom: 1px solid rgba(147,197,253,0.16); }
  .tui-hero-in { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 56px; align-items: center; }
  .tui-titulo { font-family: var(--tuo-fh); font-size: clamp(32px, 4.6vw, 56px); line-height: 1.04; font-weight: 700; letter-spacing: -0.04em; color: var(--color-text); margin: 18px 0 0; text-wrap: balance; }
  .tui-titulo em { font-style: normal; background: linear-gradient(100deg, #60A5FA 0%, #818CF8 55%, #93C5FD 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tui-bajada { font-size: 15.5px; line-height: 1.6; color: var(--color-body); margin: 18px 0 0; max-width: 56ch; }
  .tui-datos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 30px 0 0; padding: 0; list-style: none; max-width: 520px; border: 1px solid var(--color-border); border-radius: 14px; background: rgba(11,16,29,0.55); }
  .tui-datos li { padding: 14px 16px; border-left: 1px solid var(--color-border); min-width: 0; }
  .tui-datos li:first-child { border-left: none; }
  .tui-datos b { display: block; font-family: var(--tuo-fh); font-size: 26px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); font-variant-numeric: tabular-nums; }
  .tui-datos span { display: block; margin-top: 7px; }
  .tui-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 28px; }
  .tui-flecha { transition: transform 220ms var(--tuo-ease); }

  /* Marco del dial: vidrio oscuro con resplandor, como una ventana del producto. */
  .tui-marco { position: relative; border-radius: 24px; border: 1px solid var(--color-border); background: linear-gradient(180deg, rgba(21,29,49,0.72), rgba(11,16,29,0.72)); box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px rgba(3,6,14,0.6), 0 0 90px rgba(59,130,246,0.16); padding: 18px 20px 20px; transition: box-shadow 300ms ease, border-color 300ms ease; }
  .tui-marco::before { content: ''; position: absolute; left: 28px; right: 28px; top: -1px; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.8), transparent); pointer-events: none; }
  .tui-marco-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .tui-marco-dial { display: grid; place-items: center; padding: 22px 14px 12px; }
  .tui-leyenda { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 4px 0 0; padding: 0; list-style: none; }
  .tui-leyenda li { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--color-border); font-size: 12px; color: var(--color-body); white-space: nowrap; transition: border-color 180ms ease, background 180ms ease; }
  .tui-leyenda i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  /* ── Secciones ── */
  .tui-seccion { padding: 52px 0 0; }
  .tui-seccion:last-child { padding-bottom: 72px; }
  .tui-seccion-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 22px; }
  .tui-h2 { font-family: var(--tuo-fh); font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text); margin: 10px 0 0; }

  /* ── Tarjetas de pantalla ── */
  .tui-pantallas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .tui-pantalla { display: flex; flex-direction: column; text-decoration: none; overflow: hidden; }
  .tui-boceto { position: relative; display: block; border-bottom: 1px solid var(--color-border); background: radial-gradient(260px 120px at 80% -10%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 70%), var(--color-surface); color: var(--color-primary); border-radius: calc(var(--tuo-r) - 1px) calc(var(--tuo-r) - 1px) 0 0; overflow: hidden; }
  .tui-boceto svg { display: block; width: 100%; height: auto; transition: transform 420ms var(--tuo-ease); transform-origin: 50% 100%; }
  .tui-boceto .tui-luz { transition: opacity 260ms ease; opacity: 0.55; }
  .tui-para { position: absolute; top: 10px; right: 10px; }
  .tui-pantalla-cuerpo { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px 18px; flex: 1; }
  .tui-pantalla-icono { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: var(--tuo-grad-suave); border: 1px solid var(--tuo-anillo); color: var(--color-primary); transition: background 220ms ease, color 220ms ease, box-shadow 220ms ease; }
  .tui-abrir { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 13px; font-weight: 600; color: var(--color-primary); }

  /* ── Rubros ── */
  .tui-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .tui-seg-scroll { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .tui-seg-scroll::-webkit-scrollbar { display: none; }
  .tui-grupo + .tui-grupo { margin-top: 30px; }
  .tui-familia { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
  .tui-familia::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--color-border), transparent); }
  .tui-rubros { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .tui-rubro { display: block; width: 100%; padding: 16px; }
  .tui-rubro-icono { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); transition: background 220ms ease, color 220ms ease, transform 260ms var(--tuo-ease), box-shadow 220ms ease; }
  .tui-rubro[aria-pressed='true'] { background: linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 9%, var(--color-bg)), var(--color-bg)); }
  .tui-rubro[aria-pressed='true'] .tui-rubro-icono { background: var(--tuo-grad); color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
  .tui-tilde { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--tuo-grad); color: #fff; box-shadow: 0 0 0 3px var(--color-bg); animation: tuiTilde 320ms var(--tuo-ease) both; }
  @keyframes tuiTilde { from { transform: scale(0.4); opacity: 0 } to { transform: none; opacity: 1 } }
  /* Van como <span> y no como lista: adentro de un <button> solo entra contenido de frase. */
  .tui-servicios { display: block; margin: 12px 0 0; padding: 10px 0 0; border-top: 1px dashed var(--color-border); font-size: 12.5px; line-height: 1.75; color: var(--color-body); }
  .tui-servicios > span { display: flex; justify-content: space-between; gap: 10px; }
  .tui-servicios > span > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tui-vacio { display: grid; place-items: center; gap: 10px; padding: 48px 20px; text-align: center; border: 1px dashed var(--color-border-strong); border-radius: var(--tuo-r); color: var(--color-muted); }

  @media (hover: hover) {
    .tui-pantalla:hover .tui-boceto svg { transform: scale(1.045); }
    .tui-pantalla:hover .tui-luz { opacity: 1; }
    .tui-pantalla:hover .tui-pantalla-icono { background: var(--tuo-grad); color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
    .tui-pantalla:hover .tui-flecha, .tuo-btn:hover .tui-flecha { transform: translateX(4px); }
    .tui-rubro:hover { box-shadow: var(--shadow-card-hover), 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent), 0 14px 34px color-mix(in srgb, var(--color-primary) 14%, transparent); }
    .tui-rubro:hover .tui-rubro-icono { transform: rotate(-6deg) scale(1.06); }
    .tui-marco:hover { border-color: var(--color-border-strong); box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 80px rgba(3,6,14,0.6), 0 0 120px rgba(59,130,246,0.26); }
    .tui-leyenda li:hover { border-color: var(--color-border-strong); background: rgba(147,197,253,0.06); }
  }

  @media (max-width: 1100px) { .tui-pantallas { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 960px) {
    .tui-hero { padding: 40px 0 48px; }
    .tui-hero-in { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  }
  @media (max-width: 640px) {
    .tui-ancho { padding: 0 16px; }
    .tui-hero { padding: 32px 0 40px; }
    .tui-datos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tui-datos li:nth-child(3) { border-left: none; }
    .tui-datos li:nth-child(n + 3) { border-top: 1px solid var(--color-border); }
    .tui-acciones > * { flex: 1 1 100%; }
    .tui-acciones .tuo-btn { height: 48px; }
    .tui-marco { padding: 14px 12px 16px; border-radius: 20px; }
    .tui-marco-dial { padding: 18px 6px 10px; }
    .tui-pantallas { grid-template-columns: minmax(0, 1fr); }
    .tui-seccion { padding-top: 40px; }
    .tui-filtros, .tui-filtros .tuo-buscar { width: 100%; max-width: none; }
    /* Targets de 44px y 16px en el campo: con menos, iOS hace zoom al enfocar. */
    .tui .tuo-buscar > input { height: 46px; font-size: 16px; }
    .tui .tuo-seg > button { height: 44px; }
    .tui-rubros { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tui-boceto svg, .tui-luz, .tui-flecha, .tui-rubro-icono, .tui-pantalla-icono, .tui-marco, .tui-leyenda li { transition: none !important; transform: none !important; }
    .tui-tilde { animation: none; }
  }
`

// Bocetos esquemáticos de cada pantalla: no son capturas, son el "plano" de lo
// que hay adentro. Pintan con los tokens del sistema, así salen bien en claro
// y en oscuro; lo que lleva la clase tui-luz se enciende al pasar el mouse.
function BocetoPantalla({ tipo }: { tipo: Boceto }) {
  const linea = 'var(--color-border-strong)'
  const bloque = 'var(--color-surface-alt)'
  const hoja = 'var(--color-bg)'
  return (
    <svg viewBox="0 0 240 108" aria-hidden focusable="false">
      {tipo === 'onboarding' && (
        <>
          <path d="M 30 62 Q 120 -6 210 62" fill="none" stroke={linea} strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
          <path className="tui-luz" d="M 30 62 Q 62 36 96 29" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {[[30, 62], [62, 41], [96, 29], [144, 29], [178, 41], [210, 62]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 2 ? 5.5 : 3.5} fill={i < 2 ? 'currentColor' : hoja} stroke={i <= 2 ? 'currentColor' : linea} strokeWidth="1.5" />
          ))}
          <circle className="tui-luz" cx="96" cy="29" r="10" fill="currentColor" opacity="0.2" />
          <rect x="52" y="76" width="64" height="20" rx="6" fill={hoja} stroke="currentColor" strokeWidth="1.2" />
          <rect x="124" y="76" width="64" height="20" rx="6" fill={hoja} stroke={linea} />
        </>
      )}
      {tipo === 'panel' && (
        <>
          <rect x="14" y="14" width="212" height="94" rx="8" fill={hoja} stroke={linea} />
          <rect x="14" y="14" width="46" height="94" rx="8" fill={bloque} />
          {[28, 40, 52, 64].map((y, i) => <rect key={y} x="22" y={y} width={i === 0 ? 30 : 24} height="5" rx="2.5" fill={i === 0 ? 'currentColor' : linea} className={i === 0 ? 'tui-luz' : undefined} />)}
          <circle cx="108" cy="66" r="30" fill="none" stroke={bloque} strokeWidth="6" />
          <path className="tui-luz" d="M 86.8 87.2 A 30 30 0 0 1 108 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <circle cx="108" cy="66" r="18" fill="none" stroke={bloque} strokeWidth="5" />
          <path className="tui-luz" d="M 108 48 A 18 18 0 0 1 126 66" fill="none" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" />
          <rect x="152" y="28" width="62" height="24" rx="6" fill={bloque} />
          <rect x="152" y="58" width="62" height="24" rx="6" fill={bloque} />
          <rect x="159" y="35" width="26" height="4" rx="2" fill={linea} /><rect className="tui-luz" x="159" y="43" width="16" height="4" rx="2" fill="currentColor" />
          <rect x="159" y="65" width="30" height="4" rx="2" fill={linea} /><rect className="tui-luz" x="159" y="73" width="20" height="4" rx="2" fill="#10B981" />
        </>
      )}
      {tipo === 'sitio' && (
        <>
          <rect x="14" y="14" width="212" height="94" rx="8" fill={hoja} stroke={linea} />
          <rect className="tui-luz" x="14" y="14" width="212" height="46" rx="8" fill="currentColor" opacity="0.16" />
          <rect x="28" y="26" width="84" height="7" rx="3.5" fill="var(--color-text)" opacity="0.8" />
          <rect x="28" y="38" width="56" height="4" rx="2" fill={linea} />
          <rect className="tui-luz" x="28" y="47" width="40" height="9" rx="4.5" fill="currentColor" />
          {[28, 94, 160].map(x => <rect key={x} x={x} y="70" width="54" height="30" rx="6" fill={bloque} />)}
        </>
      )}
      {tipo === 'simple' && (
        <>
          <rect x="76" y="10" width="88" height="98" rx="10" fill={hoja} stroke={linea} />
          <path className="tui-luz" d="M76 20a10 10 0 0 1 10-10h68a10 10 0 0 1 10 10v24H76z" fill="currentColor" opacity="0.16" />
          <circle cx="120" cy="44" r="10" fill={hoja} stroke="currentColor" strokeWidth="1.5" />
          <rect x="98" y="60" width="44" height="6" rx="3" fill="var(--color-text)" opacity="0.8" />
          <rect x="104" y="71" width="32" height="4" rx="2" fill={linea} />
          <rect className="tui-luz" x="88" y="82" width="64" height="13" rx="6.5" fill="currentColor" />
          <rect x="102" y="101" width="36" height="3" rx="1.5" fill={bloque} />
        </>
      )}
      {tipo === 'servicios' && (
        <>
          <rect x="24" y="16" width="192" height="18" rx="9" fill={hoja} stroke={linea} />
          <circle cx="37" cy="25" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {[42, 64, 86].map((y, i) => (
            <g key={y}>
              <rect x="24" y={y} width="192" height="17" rx="6" fill={hoja} stroke={i === 0 ? 'currentColor' : linea} className={i === 0 ? 'tui-luz' : undefined} />
              <rect x="34" y={y + 6.5} width={[70, 54, 82][i]} height="4" rx="2" fill={linea} />
              <rect x="174" y={y + 4.5} width="32" height="8" rx="4" fill={i === 0 ? 'currentColor' : bloque} className={i === 0 ? 'tui-luz' : undefined} />
            </g>
          ))}
        </>
      )}
      {tipo === 'reserva' && (
        <>
          <rect x="22" y="14" width="124" height="86" rx="8" fill={hoja} stroke={linea} />
          {[0, 1, 2, 3].map(f => [0, 1, 2, 3, 4, 5].map(c => {
            const sel = f === 1 && c === 3
            return <circle key={`${f}-${c}`} cx={38 + c * 18.5} cy={32 + f * 17.5} r={sel ? 6.5 : 4} fill={sel ? 'currentColor' : f === 0 && c < 2 ? 'transparent' : bloque} stroke={f === 0 && c < 2 ? linea : 'none'} className={sel ? 'tui-luz' : undefined} />
          }))}
          {[18, 40, 62, 84].map((y, i) => <rect key={y} x="158" y={y} width="60" height="16" rx="8" fill={i === 1 ? 'currentColor' : hoja} stroke={i === 1 ? 'none' : linea} className={i === 1 ? 'tui-luz' : undefined} />)}
        </>
      )}
      {tipo === 'mis-turnos' && (
        <>
          <rect x="40" y="12" width="160" height="88" rx="10" fill={hoja} stroke={linea} />
          <line x1="40" y1="40" x2="200" y2="40" stroke={linea} strokeDasharray="3 4" />
          <rect x="54" y="22" width="62" height="6" rx="3" fill="var(--color-text)" opacity="0.8" />
          <rect className="tui-luz" x="152" y="20" width="36" height="10" rx="5" fill="#10B981" opacity="0.8" />
          {/* QR esquemático: los tres ojos y algo de trama */}
          <g fill="var(--color-text)">
            {[[56, 50], [84, 50], [56, 78]].map(([x, y]) => <path key={`${x}-${y}`} fillRule="evenodd" d={`M${x} ${y}h12v12h-12z M${x + 3} ${y + 3}v6h6v-6z`} />)}
            {[[72, 50], [76, 58], [72, 66], [80, 66], [88, 70], [72, 78], [80, 82], [92, 78], [88, 86], [76, 74], [92, 66]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />)}
          </g>
          <rect x="114" y="54" width="70" height="5" rx="2.5" fill={linea} />
          <rect x="114" y="66" width="50" height="5" rx="2.5" fill={linea} />
          <rect className="tui-luz" x="114" y="80" width="58" height="11" rx="5.5" fill="currentColor" />
        </>
      )}
      {tipo === 'vacio' && (
        <>
          <rect x="40" y="16" width="160" height="80" rx="10" fill="none" stroke={linea} strokeDasharray="4 5" />
          <circle className="tui-luz" cx="120" cy="46" r="15" fill="currentColor" opacity="0.18" />
          <path d="M113 40h14v13h-14z M113 44h14 M116 38v4 M124 38v4 M117.5 47l5 4 M122.5 47l-5 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="88" y="70" width="64" height="5" rx="2.5" fill={linea} />
          <rect x="100" y="81" width="40" height="4" rx="2" fill={bloque} />
        </>
      )}
      {tipo === 'landing' && (
        <>
          <rect x="14" y="14" width="212" height="94" rx="8" fill="#05080F" stroke={linea} />
          {[[30, 26], [200, 34], [176, 22], [60, 92], [214, 84], [96, 20]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#BFDBFE" opacity="0.7" />)}
          <rect x="30" y="38" width="88" height="7" rx="3.5" fill="#F1F5FD" />
          <rect className="tui-luz" x="30" y="50" width="62" height="7" rx="3.5" fill="#3B82F6" />
          <rect x="30" y="64" width="76" height="4" rx="2" fill="#5E6A86" />
          <rect x="30" y="78" width="40" height="12" rx="6" fill="#F1F5FD" />
          <circle cx="176" cy="64" r="30" fill="none" stroke="rgba(147,197,253,0.25)" strokeDasharray="2 5" />
          <circle cx="176" cy="64" r="20" fill="none" stroke="rgba(147,197,253,0.18)" strokeWidth="5" />
          <path className="tui-luz" d="M 161.9 78.1 A 20 20 0 0 1 176 44" fill="none" stroke="#60A5FA" strokeWidth="5" strokeLinecap="round" />
          <circle className="tui-luz" cx="197.2" cy="42.8" r="3.5" fill="#BFDBFE" />
        </>
      )}
    </svg>
  )
}

export default function Page({ reloj }: { reloj: number }) {
  return <RelojTurnos semilla={reloj}><TurnosDemoIndice /></RelojTurnos>
}

function TurnosDemoIndice() {
  const ahora = useReloj()
  const [rubro, setRubro] = useRubroDemo()
  const [busqueda, setBusqueda] = useState('')
  const [familia, setFamilia] = useState<'todas' | FamiliaId>('todas')

  const recursos = useMemo(() => recursosDe(rubro), [rubro])
  const turnos = useMemo(() => turnosDeHoy(rubro, ahora), [rubro, ahora])
  const clientes = useMemo(() => clientesDe(rubro), [rubro])
  const nombreCliente = (id: string) => clientes.find(c => c.id === id)?.nombre ?? 'Cliente'
  const activos = turnos.filter(t => t.estado !== 'cancelado')

  const visibles = useMemo(() => {
    const q = plano(busqueda.trim())
    return RUBROS_TURNOS.filter(r =>
      (familia === 'todas' || r.familia === familia) &&
      (!q || plano(`${r.label} ${r.descripcion} ${MODO_LABEL[r.modo]} ${r.servicios.map(s => s.nombre).join(' ')}`).includes(q)))
  }, [busqueda, familia])

  const conRubro = (href: string) => `${href}${href.includes('?') ? '&' : '?'}rubro=${rubro.key}`

  return (
    <>
      <Head><title>Turnos · Vista previa local</title></Head>
      <EstiloTurnos />
      <style>{CSS_INDICE}</style>
      <BarraDemo />
      <main className="tuo tui">
        {/* ── Hero: qué es esto + el día en órbita del rubro elegido ── */}
        <section className="tuo-espacio tui-hero" aria-labelledby="tui-titulo">
          <Estrellas cantidad={60} />
          <Anillos size={620} lado="izquierda" opacidad={0.55} />
          <div className="tui-ancho tui-hero-in">
            <div>
              <div className="tuo-eyebrow tuo-entra">Turnos &amp; Agenda · Centro de control</div>
              <h1 id="tui-titulo" className="tui-titulo tuo-entra" style={{ ['--i' as string]: 1 }}>Tu día, <em>en órbita.</em></h1>
              <p className="tui-bajada tuo-entra" style={{ ['--i' as string]: 2 }}>
                Esta es la vista previa del vertical de turnos. Todo es visual y con datos de ejemplo: no llama a la API ni guarda nada.
                Elegí un rubro y cada pantalla se arma con sus servicios y su forma de agendar.
              </p>
              <ul className="tui-datos tuo-entra" style={{ ['--i' as string]: 3 }}>
                <li><b>{RUBROS_TURNOS.length}</b><span className="tuo-rotulo">Rubros</span></li>
                <li><b>{FAMILIAS.length}</b><span className="tuo-rotulo">Familias</span></li>
                <li><b>{Object.keys(MODO_LABEL).length}</b><span className="tuo-rotulo">Modos</span></li>
                <li><b>{PANTALLAS.length}</b><span className="tuo-rotulo">Pantallas</span></li>
              </ul>
              <div className="tui-acciones tuo-entra" style={{ ['--i' as string]: 4 }}>
                <Link href={conRubro('/turnos-demo/panel')} className="tuo-btn tuo-btn--primario tuo-btn--lg">
                  Abrir el panel <ArrowRight size={17} className="tui-flecha" aria-hidden />
                </Link>
                <Link href={conRubro('/turnos-demo/reserva')} className="tuo-btn tuo-btn--lg">
                  Reservar como cliente <ArrowUpRight size={17} className="tui-flecha" aria-hidden />
                </Link>
              </div>
            </div>

            <div className="tui-marco tuo-entra" style={{ ['--i' as string]: 2 }}>
              <div className="tui-marco-cab">
                <div style={{ minWidth: 0 }}>
                  <div className="tuo-rotulo">Agenda · hoy</div>
                  <div className="tuo-h2" style={{ marginTop: 4 }}>{fechaLarga(ahora.fecha)}</div>
                </div>
                <SelectorRubro valor={rubro.key} onChange={setRubro} />
              </div>
              <div className="tui-marco-dial">
                <OrbitaDia recursos={recursos} turnos={turnos} ahora={ahora.minutos} nombreCliente={nombreCliente} pie={`${activos.length} turnos hoy`} size={360} />
              </div>
              <ul className="tui-leyenda" aria-label={`Anillos del dial: ${MODO_LABEL[rubro.modo].toLowerCase()}`}>
                {recursos.map(r => (
                  <li key={r.id}>
                    <i style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} aria-hidden />
                    {r.nombre}
                    <span className="tuo-num" style={{ color: 'var(--color-muted)' }}>{activos.filter(t => t.recursoId === r.id).length}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Pantallas ── */}
        <section className="tui-ancho tui-seccion" aria-labelledby="tui-pantallas">
          <div className="tui-seccion-cab">
            <div>
              <div className="tuo-eyebrow">Pantallas</div>
              <h2 id="tui-pantallas" className="tui-h2">Recorré la demo</h2>
              <p className="tuo-bajada">Se abren con <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{rubro.label}</strong> ({MODO_LABEL[rubro.modo].toLowerCase()}{rubro.sena ? `, seña del ${rubro.sena}%` : ', sin seña'}).</p>
            </div>
          </div>
          <div className="tui-pantallas">
            {PANTALLAS.map((p, i) => (
              <Link key={p.href} href={conRubro(p.href)} className="tuo-card tuo-card--accion tuo-entra tui-pantalla" style={{ ['--i' as string]: i }}>
                <span className="tui-boceto">
                  <BocetoPantalla tipo={p.boceto} />
                  <span className="tuo-chip tuo-chip--borde tui-para" style={{ height: 22, fontSize: 11, background: 'var(--color-bg)' }}>{p.para}</span>
                </span>
                <span className="tui-pantalla-cuerpo">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tui-pantalla-icono"><p.Icon size={18} strokeWidth={1.8} aria-hidden /></span>
                    <span className="tuo-h2">{p.titulo}</span>
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-muted)', flex: 1 }}>{p.texto}</span>
                  <span className="tui-abrir">Abrir <ArrowRight size={14} className="tui-flecha" aria-hidden /></span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Rubros ── */}
        <section className="tui-ancho tui-seccion" aria-labelledby="tui-rubros">
          <div className="tui-seccion-cab">
            <div>
              <div className="tuo-eyebrow">Rubros</div>
              <h2 id="tui-rubros" className="tui-h2">Elegí con qué negocio mirar <span className="tuo-num" style={{ fontSize: 15, color: 'var(--color-muted)', fontWeight: 500 }}>{visibles.length}/{RUBROS_TURNOS.length}</span></h2>
              <p className="tuo-bajada">Tocá uno y se usa en todas las pantallas.</p>
            </div>
            <div className="tui-filtros">
              <label className="tuo-buscar">
                <Search size={16} aria-hidden />
                <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar rubro o servicio" aria-label="Buscar rubro o servicio" />
              </label>
              <div className="tui-seg-scroll">
                <div className="tuo-seg" role="group" aria-label="Filtrar por familia">
                  <button type="button" aria-pressed={familia === 'todas'} onClick={() => setFamilia('todas')}>Todas</button>
                  {FAMILIAS.map(f => <button key={f.id} type="button" aria-pressed={familia === f.id} onClick={() => setFamilia(f.id)}>{FAMILIA_CORTA[f.id]}</button>)}
                </div>
              </div>
            </div>
          </div>

          <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {visibles.length} rubros. Activo: {rubro.label}.
          </p>

          {visibles.length === 0 ? (
            <div className="tui-vacio">
              <SearchX size={26} strokeWidth={1.6} aria-hidden />
              <div className="tuo-h2">No hay rubros con “{busqueda.trim()}”</div>
              <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => { setBusqueda(''); setFamilia('todas') }}>Ver todos</button>
            </div>
          ) : FAMILIAS.map(f => {
            const lista = visibles.filter(r => r.familia === f.id)
            if (!lista.length) return null
            return (
              <div key={f.id} className="tui-grupo">
                <h3 className="tui-familia tuo-rotulo"><f.Icon size={14} strokeWidth={1.8} aria-hidden /> {f.label} · {lista.length}</h3>
                <div className="tui-rubros">
                  {lista.map((r, i) => {
                    const sel = r.key === rubro.key
                    return (
                      <button key={r.key} type="button" onClick={() => setRubro(r.key)} aria-pressed={sel}
                        className={`tuo-card tuo-card--accion tuo-entra tui-rubro${sel ? ' tuo-card--sel' : ''}`} style={{ ['--i' as string]: Math.min(i, 8) }}>
                        {sel && <span className="tui-tilde" aria-hidden><Check size={13} strokeWidth={3} /></span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: sel ? 28 : 0 }}>
                          <span className="tui-rubro-icono"><r.Icon size={18} strokeWidth={1.8} aria-hidden /></span>
                          <span style={{ minWidth: 0 }}>
                            <span className="tuo-h2" style={{ display: 'block', fontSize: 15 }}>{r.label}</span>
                            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{MODO_LABEL[r.modo]}{r.sena ? ` · seña ${r.sena}%` : ''}</span>
                          </span>
                        </span>
                        <span className="tui-servicios">
                          {r.servicios.slice(0, 3).map(s => (
                            <span key={s.nombre}>
                              <span>{s.nombre}</span>
                              <span className="tuo-num" style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap', fontSize: 11.5 }}>{duracionTxt(s.duracion)} · {pesos(s.precio)}</span>
                            </span>
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      </main>
    </>
  )
}
