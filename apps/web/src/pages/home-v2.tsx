// Página de PROPUESTA del home rediseñado (orbita.site).
//
// Vive aparte de index.tsx a propósito: es un experimento para mirar y comparar
// contra el home actual sin tocarlo. Si la propuesta se aprueba, esto se muda a
// index.tsx y este archivo se borra.

import { useEffect, useRef } from 'react';
import { ThemeProvider } from '@/modules/landing/context/ThemeContext';
import { Navbar } from '@/modules/landing/components/layout/Navbar';
import { Footer } from '@/modules/landing/components/layout/Footer';
import { HeroCinematic } from '@/modules/landing/components/sections/HeroCinematic';
import { Modulos } from '@/modules/landing/components/v2/Modulos';
import { ComoFunciona } from '@/modules/landing/components/v2/ComoFunciona';
import { Comparativa } from '@/modules/landing/components/v2/Comparativa';
import { Rubros } from '@/modules/landing/components/v2/Rubros';
import { Precios, Faq, CierreCta } from '@/modules/landing/components/v2/Cierre';

// Estrellas de fondo para TODA la página (no solo el hero): son las que hacen
// que al scrollear se sienta que seguís en el mismo cielo y no que cambiaste de
// sitio.
//
// Se hacen con un patrón de gradientes que se repite, NO con una lista larga de
// box-shadow como en el hero: probado con ~160 sombras sobre un elemento fixed,
// el navegador dejaba de repintar bien la página al scrollear (se veían franjas
// negras y el navbar dibujado en el medio del contenido). Un background que
// tilea es barato de pintar y no tiene ese problema.
const CIELO = [
    'radial-gradient(1.2px 1.2px at 24px 38px, rgba(255,255,255,.55), transparent)',
    'radial-gradient(1px 1px at 128px 92px, rgba(255,255,255,.40), transparent)',
    'radial-gradient(1.4px 1.4px at 202px 168px, rgba(199,222,255,.50), transparent)',
    'radial-gradient(1px 1px at 76px 224px, rgba(255,255,255,.32), transparent)',
    'radial-gradient(1px 1px at 268px 44px, rgba(255,255,255,.36), transparent)',
    'radial-gradient(1.3px 1.3px at 312px 252px, rgba(255,255,255,.30), transparent)',
].join(', ');

export default function HomeV2Page() {
    const barraRef = useRef<HTMLDivElement>(null);

    // Barra de progreso de scroll: además de ser útil, mantiene la idea de
    // "trayectoria" del tema espacial de punta a punta.
    useEffect(() => {
        const actualizar = () => {
            const alto = document.documentElement.scrollHeight - window.innerHeight;
            const p = alto > 0 ? window.scrollY / alto : 0;
            if (barraRef.current) barraRef.current.style.transform = `scaleX(${p})`;
        };
        actualizar();
        window.addEventListener('scroll', actualizar, { passive: true });
        window.addEventListener('resize', actualizar);
        return () => {
            window.removeEventListener('scroll', actualizar);
            window.removeEventListener('resize', actualizar);
        };
    }, []);

    return (
        <ThemeProvider>
            <div className="oc-page relative min-h-screen bg-black">
                <style>{`
                    /* Los anclas del navbar y de los CTA internos viajan suave. */
                    html { scroll-behavior: smooth; }
                    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

                    /* Realce al pasar el mouse: solo color, nunca transform — un
                       scale acá correría las tarjetas vecinas de la grilla. */
                    .oc-card-hover:hover {
                        border-color: rgba(147,197,253,.34) !important;
                        background: rgba(59,130,246,.055) !important;
                    }

                    .oc-faq summary::-webkit-details-marker { display: none; }
                    .oc-faq summary:hover { background: rgba(59,130,246,.06) !important; }
                    .oc-faq summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
                    .oc-faq-chevron { transition: transform 220ms ease; }
                    .oc-faq[open] .oc-faq-chevron { transform: rotate(180deg); }

                    /* Sin animación: es un elemento fijo a pantalla completa, y
                       animarle la opacidad obliga al navegador a recomponer TODO
                       el viewport en cada frame — con el resto de la página
                       encima, dejaba de repintar al scrollear. */
                    .oc-estrellas { opacity: .7; }
                `}</style>

                {/* Progreso de scroll */}
                <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent" aria-hidden="true">
                    <div
                        ref={barraRef}
                        className="h-full origin-left"
                        style={{ background: 'linear-gradient(90deg,#3b82f6,#818cf8,#c7d2fe)', transform: 'scaleX(0)' }}
                    />
                </div>

                {/* Cielo continuo detrás de TODA la página */}
                <div
                    className="oc-estrellas pointer-events-none fixed inset-0 z-0"
                    style={{ backgroundImage: CIELO, backgroundSize: '360px 300px', backgroundRepeat: 'repeat' }}
                    aria-hidden="true"
                />

                <Navbar />

                <main className="relative">
                    <HeroCinematic />

                    {/* Transición hero → contenido: el resplandor del planeta se
                        derrama unos cientos de píxeles hacia abajo en vez de
                        cortarse de golpe en el borde de la sección. */}
                    <div className="relative">
                        <div
                            className="pointer-events-none absolute inset-x-0 -top-px z-0 h-[420px]"
                            style={{ background: 'linear-gradient(180deg, rgba(79,70,229,.20) 0%, rgba(59,130,246,.07) 38%, rgba(0,0,0,0) 100%)' }}
                            aria-hidden="true"
                        />

                        <Modulos />
                        <ComoFunciona />
                        <Comparativa />
                        <Rubros />
                        <Precios />
                        <Faq />
                        <CierreCta />
                    </div>
                </main>

                <div className="relative z-10">
                    <Footer />
                </div>
            </div>
        </ThemeProvider>
    );
}
