// "Sobre nosotros" — quiénes están atrás de Órbita, misión y visión.
//
// ⚠ CONTENIDO A COMPLETAR POR EL DUEÑO ⚠
//
// Dos cosas de acá no las puede inventar nadie que no sea del equipo, así que
// quedaron marcadas y hay que completarlas antes de darla por terminada:
//
//  1. EQUIPO (const EQUIPO, abajo). Está cargado solo quien se pudo confirmar.
//     Sumar el resto con nombre, puesto y, si hay, la foto en
//     apps/web/public/nosotros/<archivo>. Sin foto se muestran las iniciales,
//     que también se ve bien — no es obligatoria.
//  2. FOTOS del equipo (const FOTOS). Apenas existan los archivos en
//     apps/web/public/nosotros/, aparecen solas; mientras tanto se ve un marco
//     punteado con el nombre del archivo que falta.
//
// La misión y la visión son un PRIMER BORRADOR escrito a partir de lo que el
// producto hace hoy. Están para que el dueño las corrija con sus palabras, no
// para publicarlas tal cual sin leerlas.

import { useState } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';

interface Miembro { nombre: string; puesto: string; foto?: string; nota?: string }

const EQUIPO: Miembro[] = [
    { nombre: 'Mateo Rojas', puesto: 'Fundador y CEO', nota: 'Arrancó Órbita después de ver el mismo problema en cada negocio de conocidos: vender por Instagram y anotar todo a mano.' },
    // COMPLETAR: el resto del equipo, con su puesto real.
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
                            <h3 className="text-[17px] font-black tracking-[-0.01em] text-white">Hacia dónde vamos</h3>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {EQUIPO.map(m => (
                        <Card key={m.nombre} className="oc-card-hover h-full p-5">
                            <div className="flex items-center gap-3.5">
                                {m.foto ? (
                                    <img
                                        src={m.foto} alt={m.nombre}
                                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                                        style={{ border: '1px solid var(--oc-card-bd)' }}
                                    />
                                ) : (
                                    <span
                                        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[14px] font-black text-white"
                                        style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
                                        aria-hidden="true"
                                    >
                                        {m.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}
                                    </span>
                                )}
                                <span className="min-w-0">
                                    <span className="block truncate text-[15px] font-bold text-white">{m.nombre}</span>
                                    <span className="block truncate text-[12.5px] text-blue-300">{m.puesto}</span>
                                </span>
                            </div>
                            {m.nota && <p className="mt-3.5 text-[12.5px] leading-relaxed text-slate-400">{m.nota}</p>}
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
