// ─── Demo: funciones que necesitan una cuenta real ───────────────────────────
//
// En la demo pública (visitante anónimo, ver lib/demo/modo.ts) hay pantallas que
// no se pueden probar: conectar WhatsApp Business o Instagram (Difusión) pide la
// cuenta y el número del negocio, y el login con Meta. En vez del botón de
// conectar, el visitante ve un video de cómo funciona, qué se puede hacer, y que
// es solo para quienes tienen su tienda en Órbita.
//
// Los videos NO están en YouTube: viven en Cloudflare R2 (bucket de producción,
// carpeta demo/videos/, URL pública de R2_PUBLIC_URL). Si un archivo no carga
// (todavía no se subió, o falla la red), el reproductor no se muestra y queda la
// explicación: nunca un recuadro roto.

import { useState } from 'react'
import { ArrowRight, Check, Play } from 'lucide-react'
import { apexUrl } from '@/lib/tenant'

export type FuncionSoloConTienda = 'whatsapp' | 'difusion'

const R2 = 'https://pub-4c590787fd69461f8d464b91d826c1b4.r2.dev/demo/videos'

const VIDEOS: Record<FuncionSoloConTienda, { src: string; portada: string; duracion: string }> = {
  whatsapp: { src: `${R2}/whatsapp-en-tu-panel.mp4`, portada: `${R2}/whatsapp-en-tu-panel.jpg`, duracion: '1:01' },
  difusion: { src: `${R2}/difusion.mp4`, portada: `${R2}/difusion.jpg`, duracion: '1:08' },
}

const TEXTOS: Record<FuncionSoloConTienda, { titulo: string; bajada: string; puntos: string[]; porQue: string }> = {
  whatsapp: {
    titulo: 'WhatsApp en tu panel',
    bajada: 'Conectás tu WhatsApp Business y atendés tus chats desde Órbita, con el mismo aspecto de WhatsApp Web y por tu propio número.',
    puntos: [
      'Respondés desde el panel y seguís usando la app en el celular: lo que escribís en un lado aparece en el otro.',
      'Usás respuestas guardadas para no escribir lo mismo cada vez.',
      'Con el paquete Avanzado, Orbi atiende tu número por vos: contesta con IA, con un menú de opciones o con las dos cosas.',
    ],
    porQue: 'Para conectarlo hace falta tu número y tu cuenta de WhatsApp Business, así que en la demo no se puede probar.',
  },
  difusion: {
    titulo: 'Difusión: tu Instagram desde Órbita',
    bajada: 'Conectás tu cuenta profesional de Instagram y mostrás tus productos en redes desde el mismo panel donde vendés.',
    puntos: [
      'Elegís un producto, mirás cómo queda la publicación y la subís a Instagram sin salir de Órbita. Orbi te escribe el texto.',
      'Orbi te sugiere qué publicar y cuándo, y lo dejás programado en el calendario.',
      'Respondés los mensajes directos y los comentarios en un solo lugar, con respuestas que te sugiere Orbi.',
      'Con el paquete Avanzado, Orbi también atiende tus mensajes directos por vos: contesta, toma pedidos y te avisa cuando hace falta una persona.',
      'Ves cuánta gente ve y reacciona a lo que publicás, explicado en palabras simples.',
    ],
    porQue: 'Para conectarlo hace falta tu cuenta profesional de Instagram y entrar con Meta, así que en la demo no se puede probar.',
  },
}

function VideoDemo({ titulo, video }: { titulo: string; video: (typeof VIDEOS)[FuncionSoloConTienda] }) {
  const [estado, setEstado] = useState<'portada' | 'reproduciendo' | 'error'>('portada')
  if (estado === 'error') return null
  return (
    <div className="sct-video">
      {estado === 'portada' ? (
        <button type="button" className="sct-portada" onClick={() => setEstado('reproduciendo')} aria-label={`Ver el video: ${titulo} (${video.duracion})`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.portada} alt="" onError={() => setEstado('error')} />
          <span className="sct-velo" aria-hidden />
          <span className="sct-play" aria-hidden><Play size={30} strokeWidth={0} fill="currentColor" /></span>
          <span className="sct-pie" aria-hidden>
            <span className="sct-pie-titulo">{titulo}</span>
            <span className="sct-pie-duracion">{video.duracion}</span>
          </span>
        </button>
      ) : (
        <video
          src={video.src}
          poster={video.portada}
          controls
          autoPlay
          playsInline
          preload="auto"
          onError={() => setEstado('error')}
        />
      )}
    </div>
  )
}

// El mismo video, suelto: Difusión se lo muestra a quien todavía no conectó su Instagram.
export function VideoDeFuncion({ funcion }: { funcion: FuncionSoloConTienda }) {
  return (
    <>
      <style>{CSS}</style>
      <VideoDemo titulo={TEXTOS[funcion].titulo} video={VIDEOS[funcion]} />
    </>
  )
}

export function SoloConTienda({ funcion }: { funcion: FuncionSoloConTienda }) {
  const t = TEXTOS[funcion]
  return (
    <section className="sct" aria-labelledby={`sct-${funcion}`}>
      <style>{CSS}</style>
      <h2 id={`sct-${funcion}`} className="sct-titulo">{t.titulo}</h2>
      <p className="sct-bajada">{t.bajada}</p>

      <VideoDemo titulo={t.titulo} video={VIDEOS[funcion]} />

      <ul className="sct-puntos">
        {t.puntos.map(p => (
          <li key={p}><Check size={18} strokeWidth={2.2} aria-hidden /> <span>{p}</span></li>
        ))}
      </ul>

      <div className="sct-aviso">
        <p><strong>Solo está disponible para quienes tienen su tienda en Órbita.</strong> {t.porQue}</p>
        <a className="sct-boton" href={apexUrl('/onboarding/rubro')} target="_top">
          Crear mi espacio <ArrowRight size={18} strokeWidth={2} aria-hidden />
        </a>
      </div>
    </section>
  )
}

const CSS = `
  .sct { max-width: 820px; margin: 18px auto 0; padding: 28px 30px; box-sizing: border-box; border-radius: 16px;
    background: var(--color-surface); border: 1px solid var(--color-border); }
  .sct-titulo { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
  .sct-bajada { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--color-muted); }
  .sct-video { position: relative; margin-top: 20px; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #0b1220;
    box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 12px 32px rgba(15,23,42,.14); }
  .sct-video video { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; }
  .sct-portada { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: pointer;
    display: block; color: #fff; font: inherit; text-align: left; }
  .sct-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 400ms ease; }
  .sct-velo { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(2,6,23,.05) 35%, rgba(2,6,23,.72)); }
  .sct-play { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; margin: -38px 0 0 -38px; border-radius: 50%;
    display: grid; place-items: center; background: rgba(255,255,255,.96); color: #0b1220;
    box-shadow: 0 10px 30px rgba(2,6,23,.35); transition: transform 200ms ease; }
  .sct-play svg { margin-left: 4px; }
  .sct-pie { position: absolute; left: 22px; right: 22px; bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sct-pie-titulo { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; text-shadow: 0 1px 8px rgba(0,0,0,.4); }
  .sct-pie-duracion { flex-shrink: 0; padding: 4px 10px; border-radius: 999px; background: rgba(2,6,23,.6); font-size: 13px;
    font-variant-numeric: tabular-nums; }
  .sct-portada:hover img { transform: scale(1.02); }
  .sct-portada:hover .sct-play { transform: scale(1.06); }
  .sct-portada:focus-visible { outline: 3px solid var(--color-primary); outline-offset: -3px; }
  .sct-puntos { list-style: none; margin: 22px 0 0; padding: 0; display: grid; gap: 12px; }
  .sct-puntos li { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; line-height: 1.5; color: var(--color-text); }
  .sct-puntos svg { flex-shrink: 0; margin-top: 2px; color: var(--color-success, #16a34a); }
  .sct-aviso { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--color-border); display: flex; flex-wrap: wrap;
    align-items: center; gap: 16px; justify-content: space-between; }
  .sct-aviso p { margin: 0; flex: 1 1 320px; font-size: 14px; line-height: 1.55; color: var(--color-muted); }
  .sct-aviso strong { color: var(--color-text); }
  .sct-boton { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border-radius: 10px;
    background: var(--color-primary); color: #fff; font-size: 14.5px; font-weight: 600; text-decoration: none; cursor: pointer;
    transition: opacity 150ms ease; }
  .sct-boton:hover { opacity: .9; }
  .sct-boton:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  @media (max-width: 640px) {
    .sct { padding: 22px 18px; }
    .sct-play { width: 60px; height: 60px; margin: -30px 0 0 -30px; }
    .sct-pie { left: 14px; right: 14px; bottom: 12px; }
    .sct-pie-titulo { font-size: 14px; }
  }
  @media (prefers-reduced-motion: reduce) { .sct-boton, .sct-portada img, .sct-play { transition: none; } }
`
