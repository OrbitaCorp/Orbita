// "Sobre nosotros" — quiénes están atrás de Órbita, misión y visión.
//
// Vive en su propia página (pages/nosotros.tsx) desde el 2026-09-06, separada
// del home: antes era una sección más de home-v2.tsx.
//
// Los cuatro integrantes y sus fotos (public/nosotros/) los dio el dueño; no
// hay nada inventado acá.
//
// Orden de la página, pensado para que lo importante se lea primero:
//   1. Misión y visión, en dos tarjetas grandes lado a lado.
//   2. Las dos fotos del equipo, del mismo tamaño y la misma proporción.
//   3. El equipo, en un acordeón: al pasar el cursor la tarjeta se agranda.
// Antes las fotos iban a la izquierda y la misión/visión en tarjetas chicas a
// la derecha: como las fotos originales tienen proporciones distintas
// (equipo-1 es vertical y equipo-2 horizontal) y se las forzaba a 4/5 y a
// cuadrada —una además bajada 32px—, la sección se veía desprolija.
//
// La misión y la visión son un PRIMER BORRADOR escrito a partir de lo que el
// producto hace hoy. Están para que el dueño las corrija con sus palabras, no
// para publicarlas tal cual sin leerlas.

import { useState, type ReactNode } from 'react';
import { TarjetaContacto } from './Contacto';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

/**
 * `zoom`, `foco` y `encuadre` acomodan cada foto adentro de su tarjeta. Son
 * fotos sacadas en cualquier lado, no retratos de estudio: sin esto, en las más
 * abiertas la cara terminaba chiquita y descentrada.
 *
 *   · `encuadre` es el object-position (qué parte de la foto se ve).
 *   · `foco` es el transform-origin: el punto que NO se mueve al agrandarla,
 *     o sea la cara.
 *   · `zoom` cuánto se acerca.
 *
 * OJO: dependen de la PROPORCIÓN de la tarjeta. Se calibraron para una tarjeta
 * cercana a 4/5 (la del acordeón en reposo, ~280×400). Si se cambia el alto o
 * la cantidad de integrantes hay que volver a mirar las cuatro caras, sobre
 * todo con la tarjeta abierta, que es la más ancha.
 *
 * La de Alexander ya viene de frente y de cerca, por eso no lleva zoom.
 */
interface Miembro { nombre: string; sigla: string; puesto: string; foto?: string; zoom?: number; foco?: string; encuadre?: string }

const EQUIPO: Miembro[] = [
    { nombre: 'Mateo Rojas',       sigla: 'CEO', puesto: 'Fundador y director ejecutivo',               foto: '/nosotros/ceo.jpg', zoom: 1.35, foco: '43% 35%' },
    { nombre: 'Alexander Ibarra',  sigla: 'CPO', puesto: 'Fundador y director de producto',             foto: '/nosotros/cpo.jpg', zoom: 1,    foco: '50% 39%' },
    { nombre: 'Alan Vega',         sigla: 'CTO', puesto: 'Fundador y director de tecnología',           foto: '/nosotros/cto.jpg', zoom: 1.2,  foco: '55% 45%' },
    { nombre: 'Milagros Lucchi',   sigla: 'RMC', puesto: 'Responsable de Marketing y Comunicaciones',   foto: '/nosotros/rmc.jpg', zoom: 1.55, foco: '55% 41%' },
];

/**
 * Las dos fotos del equipo comparten proporción (16/10 en escritorio, 4/3 en
 * celular). `encuadre` decide qué parte queda: en equipo-1, que es vertical y de
 * cuerpo entero, se muestra de las caras a la cintura; equipo-2 es horizontal y
 * casi no se recorta.
 */
const FOTOS = [
    { src: '/nosotros/equipo-1.jpg', alt: 'El equipo de Órbita trabajando', encuadre: '50% 30%' },
    { src: '/nosotros/equipo-2.jpg', alt: 'Órbita en el día a día',         encuadre: '50% 45%' },
];

const MISION = 'Que cualquier negocio pueda vender online en serio, con catálogo, stock y cobros de verdad, sin pagar comisiones por venta y sin depender de alguien que sepa de tecnología.';
const VISION = 'Que abrir la tienda de tu negocio sea tan simple como abrir una cuenta en una red social, y que el panel donde la manejás entienda tu rubro en vez de obligarte a adaptarte vos.';

const ICONO_MISION = (
    <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>
);
const ICONO_VISION = (
    <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>
);

export function Nosotros() {
    return (
        <Seccion id="nosotros">
            <Encabezado
                eyebrow="Sobre nosotros"
                titulo="Detrás de Órbita"
                resalte="hay gente que también emprende."
                bajada="No somos una empresa grande vendiéndole software a comercios. Empezamos como compañeros de la facultad y hoy somos el equipo detrás de Órbita. Nos cansamos de ver a los negocios de al lado perder ventas por no tener dónde mostrarlas."
            />

            {/* Misión y visión: lo primero y lo más grande de la sección. */}
            <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Pilar icono={ICONO_MISION} titulo="Nuestra misión" texto={MISION} desde="izquierda" />
                <Pilar icono={ICONO_VISION} titulo="Nuestra visión" texto={VISION} desde="derecha" delay={110} />
            </div>

            {/* Fotos: mismo tamaño y misma proporción, alineadas con las tarjetas. */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FOTOS.map((f, i) => (
                    <Reveal key={f.src} desde="abajo" delay={i * 110}>
                        <Foto {...f} />
                    </Reveal>
                ))}
            </div>

            {/* Equipo */}
            <Reveal delay={140} className="mt-14">
                <h3 className="mb-5 text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Quiénes lo hacemos
                </h3>
                <EquipoAcordeon />
            </Reveal>

            <Reveal delay={200} className="mt-14">
                <TarjetaContacto
                    titulo="¿Querés hablar con nosotros?"
                    texto="Escribinos por cualquier duda, sugerencia o problema. Te respondemos por mail."
                />
            </Reveal>
        </Seccion>
    );
}

/** Tarjeta grande de misión o visión. El texto va en 18px y más claro que el resto de la página. */
function Pilar({ icono, titulo, texto, desde, delay = 0 }: {
    icono: ReactNode; titulo: string; texto: string; desde: 'izquierda' | 'derecha'; delay?: number;
}) {
    return (
        <Reveal desde={desde} delay={delay} className="h-full">
            <Card destacada className="h-full p-7 sm:p-9">
                <span
                    className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl"
                    style={{ background: 'var(--oc-accent-soft)', border: '1px solid var(--oc-accent-bd)' }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--oc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        style={{ width: 22, height: 22 }} aria-hidden="true">
                        {icono}
                    </svg>
                </span>
                <h3 className="text-[22px] font-black tracking-[-0.02em] text-white sm:text-[26px]">{titulo}</h3>
                <p className="mt-3.5 text-[16px] leading-[1.7] text-slate-300 sm:text-[18px]">{texto}</p>
            </Card>
        </Reveal>
    );
}

/**
 * Hilera del equipo. En escritorio es un acordeón: las cuatro tarjetas comparten
 * el ancho y la que tiene el cursor (o el foco del teclado) crece, mientras las
 * otras se achican y se oscurecen un poco. En celular no hay cursor, así que es
 * una grilla de 2×2 con el puesto siempre visible.
 *
 * La expansión anima `flex-grow`, no transform: es la única forma de que las
 * vecinas cedan lugar sin superponerse. Son 4 elementos, no pesa.
 */
function EquipoAcordeon() {
    const [activo, setActivo] = useState<number | null>(null);

    return (
        <div className="grid grid-cols-2 gap-3 lg:flex lg:h-[400px]" onMouseLeave={() => setActivo(null)}>
            {EQUIPO.map((m, i) => {
                const esActivo = activo === i;
                const apagado = activo !== null && !esActivo;

                return (
                    <div
                        key={m.nombre}
                        tabIndex={0}
                        onMouseEnter={() => setActivo(i)}
                        onFocus={() => setActivo(i)}
                        onBlur={() => setActivo(null)}
                        className="relative aspect-[4/5] min-w-0 overflow-hidden rounded-2xl outline-none transition-[flex-grow,border-color,box-shadow] duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] focus-visible:ring-2 focus-visible:ring-blue-400/70 motion-reduce:transition-none lg:aspect-auto lg:flex-1 lg:basis-0"
                        style={{
                            flexGrow: esActivo ? 1.7 : 1,
                            border: `1px solid ${esActivo ? 'var(--oc-accent-bd)' : 'var(--oc-card-bd)'}`,
                            boxShadow: esActivo ? '0 24px 60px -24px var(--oc-accent-soft)' : 'none',
                        }}
                    >
                        {m.foto ? (
                            <img
                                src={m.foto} alt={m.nombre}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
                                style={{
                                    objectPosition: m.encuadre ?? 'center',
                                    transform: `scale(${(m.zoom ?? 1) * (esActivo ? 1.06 : 1)})`,
                                    transformOrigin: m.foco ?? 'center',
                                }}
                            />
                        ) : (
                            <div
                                className="absolute inset-0 grid place-items-center text-[28px] font-black text-white"
                                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
                                aria-hidden="true"
                            >
                                {m.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                            </div>
                        )}

                        {/* Oscurece las tarjetas que no tienen el cursor. */}
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-500 motion-reduce:transition-none"
                            style={{ opacity: apagado ? 0.5 : 0 }}
                        />

                        {/* Nombre y cargo sobre la foto. Degradado inline para no
                            depender del nombre de la utilidad entre versiones de Tailwind. */}
                        <div
                            className="absolute inset-x-0 bottom-0 p-4 pt-20"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,.5) 55%, transparent)' }}
                        >
                            <span className="block truncate text-[16px] font-bold leading-tight text-white">{m.nombre}</span>
                            <span className="mt-1 block text-[12px] font-black tracking-[0.12em] text-blue-300">{m.sigla}</span>

                            {/* En escritorio el puesto aparece recién con la tarjeta
                                abierta; grid-rows 0fr→1fr lo despliega sin saltos.
                                Sin truncate: los puestos largos bajan de renglón. */}
                            <div
                                className={`grid transition-[grid-template-rows,opacity] duration-500 motion-reduce:transition-none ${
                                    esActivo ? 'lg:grid-rows-[1fr] lg:opacity-100' : 'lg:grid-rows-[0fr] lg:opacity-0'
                                }`}
                            >
                                <span className="min-h-0 overflow-hidden pt-1 text-[12px] leading-snug text-slate-300">{m.puesto}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Foto con reemplazo: mientras el archivo no exista en public/, muestra un marco
 * punteado con el nombre que le falta, en vez de un ícono roto del navegador.
 * Las dos fotos usan la misma caja para que queden parejas.
 */
function Foto({ src, alt, encuadre }: { src: string; alt: string; encuadre: string }) {
    const [falla, setFalla] = useState(false);
    const caja = 'aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden rounded-2xl';

    if (falla) {
        return (
            <div
                className={`${caja} grid place-items-center px-4 text-center`}
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
        <div className={`group ${caja}`} style={{ border: '1px solid var(--oc-card-bd)' }}>
            <img
                src={src} alt={alt}
                onError={() => setFalla(true)}
                className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
                style={{ objectPosition: encuadre }}
            />
        </div>
    );
}
