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
import { EscenaEspacial } from '@/modules/landing/components/v2/EscenaEspacial';
import { Modulos } from '@/modules/landing/components/v2/Modulos';
import { ComoFunciona } from '@/modules/landing/components/v2/ComoFunciona';
import { Comparativa } from '@/modules/landing/components/v2/Comparativa';
import { Rubros } from '@/modules/landing/components/v2/Rubros';
import { Precios, Faq, CierreCta } from '@/modules/landing/components/v2/Cierre';

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

                    /* Los satélites no entran en pantallas chicas sin taparle el
                       titular: queda solo el horizonte, que es lo que sostiene el
                       impacto visual. */
                    @media (max-width: 1023px) { .oc-sat-wrap { display: none !important; } }
                `}</style>

                {/* Progreso de scroll */}
                <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent" aria-hidden="true">
                    <div
                        ref={barraRef}
                        className="h-full origin-left"
                        style={{ background: 'linear-gradient(90deg,#3b82f6,#818cf8,#c7d2fe)', transform: 'scaleX(0)' }}
                    />
                </div>

                {/* Una sola escena espacial detrás de TODA la página: estrellas,
                    planeta, anillos y satélites. El hero ya no tiene fondo propio,
                    así que no hay corte entre la primera pantalla y el resto. */}
                <EscenaEspacial />

                <Navbar />

                <main className="relative">
                    <HeroCinematic />
                    <Modulos />
                    <ComoFunciona />
                    <Comparativa />
                    <Rubros />
                    <Precios />
                    <Faq />
                    <CierreCta />
                </main>

                <div className="relative z-10">
                    <Footer />
                </div>
            </div>
        </ThemeProvider>
    );
}
