// Footer de la propuesta de home.
//
// Es propio y no el Footer viejo por dos razones:
//
// 1. Aquel tiene fondo opaco (bg-slate-950) y linkea a secciones que esta página
//    no tiene. El fondo opaco cortaba en seco la escena espacial justo cuando el
//    planeta vuelve a asomar — que es lo que el dueño pidió evitar: "que el
//    footer sea parte". Este es transparente: el planeta se ve a través.
// 2. El viejo enterraba "Hecho por emprendedores, para emprendedores" en la
//    línea de copyright, en gris chico. Acá es lo primero que se lee del bloque,
//    porque es la frase que explica de dónde sale Órbita.

import { useState } from 'react';
import { LegalModal } from '@/modules/landing/components/ui/LegalModal';
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo';

type LegalKey = 'terminos' | 'privacidad' | 'cookies';

const COLUMNAS = [
    {
        titulo: 'La plataforma',
        links: [
            { label: 'Qué incluye',   href: '#modulos'       },
            { label: 'Cómo funciona', href: '#como-funciona' },
            { label: 'Rubros',        href: '#rubros'        },
            { label: 'Paquete avanzado', href: '#avanzado'   },
        ],
    },
    {
        titulo: 'Empezar',
        links: [
            { label: 'Precio',            href: '#precios' },
            { label: 'Preguntas frecuentes', href: '#faq'  },
            { label: 'Crear tu espacio',  href: '/onboarding/rubro', externo: true },
            { label: 'Iniciar sesión',    href: '/login', externo: true },
        ],
    },
];

const LEGALES: { label: string; key: LegalKey }[] = [
    { label: 'Términos de uso', key: 'terminos'   },
    { label: 'Privacidad',      key: 'privacidad' },
    { label: 'Cookies',         key: 'cookies'    },
];

export function FooterV2() {
    const [legal, setLegal] = useState<LegalKey | null>(null);

    return (
        <>
            <footer className="relative z-10 px-6 pb-12 pt-16">
                <div className="mx-auto max-w-6xl">
                    {/* La frase va arriba y grande: es la carta de presentación,
                        no una nota al pie. */}
                    <div
                        className="rounded-2xl px-6 py-8 sm:px-10 sm:py-10"
                        style={{ background: 'var(--oc-panel)', border: '1px solid var(--oc-card-bd)' }}
                    >
                        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-[380px]">
                                <div className="flex items-center gap-2.5">
                                    <OrbitaLogo size={26} animated={false} />
                                    <span className="text-[17px] font-black tracking-[-0.02em] text-white">Órbita</span>
                                </div>
                                <p
                                    className="mt-5 font-black tracking-[-0.02em] text-white"
                                    style={{ fontSize: 'clamp(19px, 2.4vw, 26px)', lineHeight: 1.2 }}
                                >
                                    Hecho por emprendedores,<br />
                                    <span style={{ color: 'var(--oc-title-2)' }}>para emprendedores.</span>
                                </p>
                                <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                                    Sabemos lo que es arrancar con un cuaderno y un Instagram. Órbita es la herramienta
                                    que nos hubiera gustado tener el primer día.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-10 sm:gap-16">
                                {COLUMNAS.map(col => (
                                    <div key={col.titulo}>
                                        <h4 className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                            {col.titulo}
                                        </h4>
                                        <ul className="space-y-2.5">
                                            {col.links.map(l => (
                                                <li key={l.label}>
                                                    <a
                                                        href={l.href}
                                                        className="cursor-pointer text-[13.5px] text-slate-400 transition-colors duration-200 hover:text-white"
                                                    >
                                                        {l.label}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <span className="text-[12.5px] text-slate-500">© 2026 Órbita. Todos los derechos reservados.</span>
                        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            {LEGALES.map(l => (
                                <li key={l.key}>
                                    <button
                                        onClick={() => setLegal(l.key)}
                                        className="cursor-pointer text-[12.5px] text-slate-500 transition-colors duration-200 hover:text-slate-300"
                                    >
                                        {l.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </footer>

            <LegalModal isOpen={legal !== null} contentKey={legal} onClose={() => setLegal(null)} />
        </>
    );
}
