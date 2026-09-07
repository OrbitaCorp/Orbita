// "Sobre nosotros" — quiénes están atrás de Órbita, misión y visión.
//
// Vive en su propia página (pages/nosotros.tsx) desde el 2026-09-06, separada
// del home: antes era una sección más de home-v2.tsx.
//
// Los cuatro integrantes y sus fotos (public/nosotros/) los dio el dueño; no
// hay nada inventado acá.
//
// Ninguno lleva `nota` (el campo sigue existiendo y se renderiza si se carga).
// Mateo tenía una contando el origen de Órbita, pero decía casi lo mismo que
// la bajada de la sección, y al ser el único con texto largo estiraba a las
// otras tres tarjetas dejándolas medio vacías. Si se suman notas, que sea
// para los cuatro o para ninguno.
//
// La misión y la visión son un PRIMER BORRADOR escrito a partir de lo que el
// producto hace hoy. Están para que el dueño las corrija con sus palabras, no
// para publicarlas tal cual sin leerlas.

import { useState } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

/**
 * `zoom`, `foco` y `encuadre` acomodan cada foto adentro del recuadro de la
 * tarjeta. Son fotos sacadas en cualquier lado, no retratos de estudio: sin
 * esto, en las más abiertas la cara terminaba chiquita y descentrada.
 *
 *   · `encuadre` es el object-position (qué parte de la foto se ve).
 *   · `foco` es el transform-origin: el punto que NO se mueve al agrandarla,
 *     o sea la cara.
 *   · `zoom` cuánto se acerca.
 *
 * Los valores no salieron a ojo: se simuló con sharp el recorte exacto que
 * hace el navegador (cover + scale sobre ese origen) y se miró foto por foto.
 * OJO: dependen del alto del recuadro. Si se cambia el aspect-[5/4] de abajo,
 * hay que volver a mirarlos — con el recuadro anterior (4/5, más alto) estos
 * mismos zooms cortaban cabezas.
 *
 * La de Alexander ya venía de frente y de cerca, por eso no lleva zoom; solo
 * se le baja el encuadre para que el pelo no quede al ras del borde.
 */
interface Miembro { nombre: string; sigla: string; puesto: string; foto?: string; zoom?: number; foco?: string; encuadre?: string; nota?: string }

const EQUIPO: Miembro[] = [
    { nombre: 'Mateo Rojas',      sigla: 'CEO', puesto: 'Chief Executive Officer y fundador',         foto: '/nosotros/ceo.jpg', zoom: 1.15, foco: '43% 35%' },
    { nombre: 'Alexander Ibarra', sigla: 'CPO', puesto: 'Chief Product Officer',                       foto: '/nosotros/cpo.jpg', zoom: 1,    foco: '50% 39%', encuadre: '50% 40%' },
    { nombre: 'Alan Vega',        sigla: 'CTO', puesto: 'Chief Technology Officer',                    foto: '/nosotros/cto.jpg', zoom: 1.05, foco: '55% 45%' },
    // La sigla de Milagros es en castellano, así que su significado también.
    { nombre: 'Milagros Lucchi',  sigla: 'RMC', puesto: 'Responsable de Marketing y Comunicaciones',   foto: '/nosotros/rmc.jpg', zoom: 1.3,  foco: '55% 41%' },
];

const FOTOS = [
    { src: '/nosotros/equipo-1.jpg', alt: 'El equipo de Órbita trabajando', clase: 'aspect-[4/5]' },
    { src: '/nosotros/equipo-2.jpg', alt: 'Órbita en el día a día', clase: 'aspect-square' },
];

const MISION = 'Que cualquier negocio chico pueda vender online en serio, con catálogo, stock y cobros de verdad, sin pagar comisiones por venta y sin depender de alguien que sepa de tecnología.';
const VISION = 'Que abrir la tienda de tu negocio sea tan simple como abrir una cuenta en una red social, y que el panel donde la manejás entienda tu rubro en vez de obligarte a adaptarte vos.';

export function Nosotros() {
    return (
        <Seccion id="nosotros">
            <Encabezado
                eyebrow="Sobre nosotros"
                titulo="Detrás de Órbita"
                resalte="hay gente que también emprende."
                bajada="No somos una empresa grande vendiéndole software a comercios. Somos un equipo chico que se cansó de ver a los negocios de al lado perder ventas por no tener dónde mostrarlas."
            />

            <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                {/* Fotos */}
                <Reveal desde="izquierda">
                    <div className="grid grid-cols-2 gap-3">
                        {FOTOS.map((f, i) => (
                            <Foto key={f.src} {...f} className={i === 0 ? 'mt-0' : 'mt-8'} />
                        ))}
                    </div>
                </Reveal>

                {/* Misión y visión */}
                <div className="grid grid-cols-1 gap-4">
                    <Reveal desde="derecha">
                        <Card className="h-full p-6 sm:p-7">
                            <span
                                className="mb-4 inline-grid h-10 w-10 place-items-center rounded-xl"
                                style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--oc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ width: 18, height: 18 }} aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                                </svg>
                            </span>
                            <h3 className="text-[17px] font-black tracking-[-0.01em] text-white">Nuestra misión</h3>
                            <p className="mt-2.5 text-[14px] leading-relaxed text-slate-400">{MISION}</p>
                        </Card>
                    </Reveal>

                    <Reveal desde="derecha" delay={110}>
                        <Card className="h-full p-6 sm:p-7">
                            <span
                                className="mb-4 inline-grid h-10 w-10 place-items-center rounded-xl"
                                style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--oc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ width: 18, height: 18 }} aria-hidden="true">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
                                </svg>
                            </span>
                            <h3 className="text-[17px] font-black tracking-[-0.01em] text-white">Nuestra visión</h3>
                            <p className="mt-2.5 text-[14px] leading-relaxed text-slate-400">{VISION}</p>
                        </Card>
                    </Reveal>
                </div>
            </div>

            {/* Equipo */}
            <Reveal delay={140} className="mt-10">
                <h3 className="mb-5 text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Quiénes lo hacemos
                </h3>
                {/* Dos columnas ya en celular: con la foto grande, una sola
                    columna eran cuatro pantallas de scroll para cuatro personas. */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {EQUIPO.map(m => (
                        <Card key={m.nombre} className="oc-card-hover flex h-full flex-col overflow-hidden p-0">
                            {m.foto ? (
                                <div className="aspect-[5/4] w-full overflow-hidden" style={{ borderBottom: '1px solid var(--oc-card-bd)' }}>
                                    <img
                                        src={m.foto} alt={m.nombre}
                                        className="h-full w-full object-cover"
                                        style={{
                                            objectPosition: m.encuadre ?? 'center',
                                            transform: `scale(${m.zoom ?? 1})`,
                                            transformOrigin: m.foco ?? 'center',
                                        }}
                                    />
                                </div>
                            ) : (
                                <div
                                    className="grid aspect-[5/4] w-full place-items-center text-[34px] font-black text-white"
                                    style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', borderBottom: '1px solid var(--oc-card-bd)' }}
                                    aria-hidden="true"
                                >
                                    {m.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                                </div>
                            )}

                            <div className="flex flex-1 flex-col p-4">
                                <span className="text-[15px] font-bold leading-tight text-white">{m.nombre}</span>
                                {/* La sigla es lo que se lee de un vistazo; abajo, en
                                    chico, qué quiere decir. Sin truncate: "Responsable de
                                    Marketing y Comunicaciones" no entra en un renglón y
                                    quedaba cortado con puntos suspensivos. */}
                                <span className="mt-2 text-[13px] font-black tracking-[0.10em] text-blue-300">{m.sigla}</span>
                                <span className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{m.puesto}</span>
                                {m.nota && <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">{m.nota}</p>}
                            </div>
                        </Card>
                    ))}
                </div>
            </Reveal>
        </Seccion>
    );
}

/**
 * Foto con reemplazo: mientras el archivo no exista en public/, muestra un marco
 * punteado con el nombre que le falta, en vez de un ícono roto del navegador.
 */
function Foto({ src, alt, clase, className = '' }: { src: string; alt: string; clase: string; className?: string }) {
    const [falla, setFalla] = useState(false);

    if (falla) {
        return (
            <div
                className={`${clase} ${className} grid place-items-center rounded-2xl px-4 text-center`}
                style={{ border: '1px dashed var(--oc-card-bd)', background: 'var(--oc-card-bg)' }}
            >
                <div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--oc-text-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        className="mx-auto" style={{ width: 26, height: 26 }} aria-hidden="true">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3.5" />
                    </svg>
                    <p className="mt-2.5 text-[11.5px] font-semibold text-slate-500">Falta la foto</p>
                    <p className="mt-1 text-[10.5px] text-slate-600">public{src}</p>
                </div>
            </div>
        );
    }

    return (
        <img
            src={src} alt={alt}
            onError={() => setFalla(true)}
            className={`${clase} ${className} w-full rounded-2xl object-cover`}
            style={{ border: '1px solid var(--oc-card-bd)' }}
        />
    );
}
