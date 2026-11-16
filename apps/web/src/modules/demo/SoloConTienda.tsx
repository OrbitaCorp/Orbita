// ─── Demo: funciones que necesitan una cuenta real ───────────────────────────
//
// En la demo pública (visitante anónimo, ver lib/demo/modo.ts) hay pantallas que
// no se pueden probar: conectar WhatsApp Business o Instagram (Difusión) pide la
// cuenta y el número del negocio, y el login con Meta. En vez del botón de
// conectar, el visitante ve qué se puede hacer, un video si lo hay, y que es
// solo para quienes tienen su tienda en Órbita.
//
// Los videos: id de 11 caracteres de YouTube en VIDEOS. Vacío = no se muestra el
// recuadro del video (queda la explicación).

import { Check, PlayCircle } from 'lucide-react'
import { apexUrl } from '@/lib/tenant'

export type FuncionSoloConTienda = 'whatsapp' | 'difusion'

const VIDEOS: Record<FuncionSoloConTienda, string> = {
  whatsapp: '',
  difusion: '',
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
      'Elegís un producto, mirás cómo queda la publicación y la subís a Instagram sin salir de Órbita.',
      'Orbi te sugiere qué publicar, y lo dejás programado en el calendario.',
      'Leés y respondés los mensajes directos y los comentarios en un solo lugar.',
      'Ves cuánta gente ve y reacciona a lo que publicás.',
    ],
    porQue: 'Para conectarlo hace falta tu cuenta profesional de Instagram y entrar con Meta, así que en la demo no se puede probar.',
  },
}

export function SoloConTienda({ funcion }: { funcion: FuncionSoloConTienda }) {
  const t = TEXTOS[funcion]
  const video = VIDEOS[funcion]
  return (
    <section className="sct" aria-labelledby={`sct-${funcion}`}>
      <style>{CSS}</style>
      <h2 id={`sct-${funcion}`} className="sct-titulo">{t.titulo}</h2>
      <p className="sct-bajada">{t.bajada}</p>

      {/^[\w-]{11}$/.test(video) && (
        <div className="sct-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video}?rel=0`}
            title={t.titulo}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}

      <ul className="sct-puntos">
        {t.puntos.map(p => (
          <li key={p}><Check size={18} strokeWidth={2.2} aria-hidden /> <span>{p}</span></li>
        ))}
      </ul>

      <div className="sct-aviso">
        <p><strong>Solo está disponible para quienes tienen su tienda en Órbita.</strong> {t.porQue}</p>
        <a className="sct-boton" href={apexUrl('/onboarding/rubro')} target="_top">
          <PlayCircle size={18} strokeWidth={2} aria-hidden /> Crear mi espacio
        </a>
      </div>
    </section>
  )
}

const CSS = `
  .sct { max-width: 760px; margin: 18px auto 0; padding: 28px 30px; box-sizing: border-box; border-radius: 16px;
    background: var(--color-surface); border: 1px solid var(--color-border); }
  .sct-titulo { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
  .sct-bajada { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--color-muted); }
  .sct-video { position: relative; margin-top: 20px; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #000; }
  .sct-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .sct-puntos { list-style: none; margin: 20px 0 0; padding: 0; display: grid; gap: 12px; }
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
  @media (max-width: 640px) { .sct { padding: 22px 18px; } }
  @media (prefers-reduced-motion: reduce) { .sct-boton { transition: none; } }
`
