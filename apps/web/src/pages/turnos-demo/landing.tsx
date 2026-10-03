// DEMO INTERNA — vista previa de la sección "Turnos y agenda" para la landing,
// dentro del marco real de la landing (PaginaV2: navbar, fondo y footer).
// La landing de verdad (pages/index.tsx) no se toca.
import { useRef, useState, type MouseEvent } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { ArrowLeft } from 'lucide-react'
import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2'
import RubrosTurnos from '@/modules/turnos/landing/RubrosTurnos'
import { ContactoDemo } from '@/modules/turnos/landing/ContactoDemo'
import { RelojTurnos, semillaReloj } from '@/modules/turnos/reloj'

// El navbar y el footer son los de la landing real y apuntan al producto de
// verdad. Adentro de la demo, lo que crea una cuenta o pide sesión se desvía a
// la pantalla equivalente de la demo; el resto (secciones del home, legales)
// sigue yendo a la landing real, que existe.
const DESVIOS: Record<string, string> = {
  '/onboarding/rubro': '/turnos-demo/onboarding',
  '/login': '/turnos-demo/panel',
}

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: { reloj: semillaReloj() } }

export default function Page({ reloj }: { reloj: number }) {
  const router = useRouter()
  // Se conserva el ?rubro= con el que se llegó, para volver al índice en el mismo rubro.
  const rubro = typeof router.query.rubro === 'string' ? router.query.rubro : undefined

  const [contacto, setContacto] = useState(false)
  // Quién abrió el formulario: al cerrarlo el foco vuelve ahí.
  const disparador = useRef<HTMLElement | null>(null)
  const abrirContacto = () => {
    disparador.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setContacto(true)
  }
  const cerrarContacto = () => {
    setContacto(false)
    disparador.current?.focus()
  }

  // Se escucha en la fase de captura, antes de que el clic llegue al link o al
  // botón: así se desvía sin tocar los componentes de la landing.
  const desviar = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.target instanceof Element ? e.target : null
    if (!el) return
    const destino = DESVIOS[el.closest('a[href]')?.getAttribute('href') ?? '']
    if (destino) {
      e.preventDefault()
      void router.push({ pathname: destino, query: rubro ? { rubro } : {} })
      return
    }
    // "Enviar consulta" del footer abre el formulario real, que manda un mail.
    if (el.closest('footer button')?.textContent?.trim() === 'Enviar consulta') {
      e.stopPropagation()
      abrirContacto()
    }
  }

  return (
    <>
      <Head><title>Landing · Turnos (local)</title></Head>
      <style>{`
        .tul-volver { position: fixed; left: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 200; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; color: #F1F5FD; background: rgba(5,8,15,0.86); border: 1px solid rgba(147,197,253,0.30); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tul-volver svg { transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tul-volver small { font-family: "Geist Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #FCD34D; padding-left: 8px; border-left: 1px solid rgba(147,197,253,0.24); }
        .tul-volver:focus-visible { outline: 2px solid #93C5FD; outline-offset: 3px; }
        @media (hover: hover) {
          .tul-volver:hover { border-color: rgba(147,197,253,0.7); box-shadow: 0 14px 36px rgba(0,0,0,0.55), 0 0 30px rgba(59,130,246,0.4); transform: translateY(-2px); }
          .tul-volver:hover svg { transform: translateX(-3px); }
        }
        @media (max-width: 480px) { .tul-volver small { display: none; } }
        @media (prefers-reduced-motion: reduce) { .tul-volver, .tul-volver svg { transition: none; transform: none !important; } }
      `}</style>
      <div onClickCapture={desviar}>
        <PaginaV2 scrollKey="/turnos-demo/landing" planeta={false}>
          {/* Aire para el navbar fijo de la landing. */}
          <div style={{ height: 72 }} />
          <RelojTurnos semilla={reloj}><RubrosTurnos onEscribir={abrirContacto} /></RelojTurnos>
        </PaginaV2>
      </div>
      {contacto && <ContactoDemo onCerrar={cerrarContacto} />}
      {/* La tira de la demo taparía el navbar fijo de la landing: acá va como botón flotante. */}
      <Link href={{ pathname: '/turnos-demo', query: rubro ? { rubro } : {} }} className="tul-volver">
        <ArrowLeft size={16} aria-hidden /> Volver a la demo <small>Vista previa local</small>
      </Link>
    </>
  )
}
