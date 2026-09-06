// Página de PROPUESTA del home rediseñado (orbita.site).
//
// Vive aparte de index.tsx a propósito: es un experimento para mirar y comparar
// contra el home actual sin tocarlo. Si la propuesta se aprueba, esto se muda a
// index.tsx y este archivo se borra.

import { useEffect, useRef } from 'react';
import { ThemeProvider } from '@/modules/landing/context/ThemeContext';
import { HeroCinematic } from '@/modules/landing/components/sections/HeroCinematic';
import { EscenaEspacial } from '@/modules/landing/components/v2/EscenaEspacial';
import { NavbarV2 } from '@/modules/landing/components/v2/NavbarV2';
import { FooterV2 } from '@/modules/landing/components/v2/FooterV2';
import { Modulos } from '@/modules/landing/components/v2/Modulos';
import { ComoFunciona } from '@/modules/landing/components/v2/ComoFunciona';
import { PlanetaInteractivo } from '@/modules/landing/components/v2/PlanetaInteractivo';
import { Comparativa } from '@/modules/landing/components/v2/Comparativa';
import { Rubros } from '@/modules/landing/components/v2/Rubros';
import { Avanzado } from '@/modules/landing/components/v2/Avanzado';
import { Nosotros } from '@/modules/landing/components/v2/Nosotros';
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

    // Guarda y restaura el scroll a mano, en vez de confiar en el navegador o
    // en `experimental.scrollRestoration` de Next (se probó en next.config.ts:
    // restaura en un momento demasiado temprano del pintado, antes de que el
    // alto final de una página así de larga esté calculado, y terminaba
    // "clampeando" el scroll cerca del fondo).
    //
    // Dos cosas que costó encontrar la primera vez:
    //
    //  1. localStorage, no sessionStorage. Con sessionStorage, cerrar la
    //     pestaña (no solo recargarla) borra la posición guardada — si
    //     "reiniciar la página" significa cerrar y volver a abrir, ahí
    //     quedaba en blanco siempre. localStorage sobrevive eso.
    //  2. `behavior: 'instant'` explícito. Esta página tiene
    //     `scroll-behavior: smooth` en el <html> (más abajo, para que los
    //     links del navbar se sientan bien) — sin esto, `scrollTo` HEREDA
    //     ese smooth y la restauración queda animada. Una animación de
    //     scroll se CANCELA apenas el usuario toca la rueda o el trackpad, y
    //     eso es exactamente lo que hace cualquiera que esté probando "¿ya
    //     volvió a mi posición?" — quedaba a mitad de camino, pareciendo que
    //     no hizo nada.
    //
    // Se controla también el momento exacto: se espera a que la página
    // termine de cargar y se le dan dos frames más de margen (uno para que
    // React termine de commitear todo el árbol, otro para que el navegador ya
    // haya hecho el layout con eso) antes de aplicar la posición guardada.
    useEffect(() => {
        const CLAVE = 'orbita-scroll:/home-v2';
        if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

        const restaurar = () => {
            const guardado = localStorage.getItem(CLAVE);
            if (!guardado) return;
            const y = Number(guardado);
            if (!Number.isFinite(y) || y <= 0) return;
            window.scrollTo({ top: y, left: 0, behavior: 'instant' });
        };
        const aplicar = () => requestAnimationFrame(() => requestAnimationFrame(restaurar));
        if (document.readyState === 'complete') aplicar();
        else window.addEventListener('load', aplicar, { once: true });

        // Guardado con throttle por rAF (no en cada evento de scroll suelto) y
        // al salir de la página. `pagehide` es más confiable que `beforeunload`
        // acá: también dispara con el back-forward cache del navegador.
        let guardando = false;
        const guardar = () => {
            guardando = false;
            localStorage.setItem(CLAVE, String(window.scrollY));
        };
        const onScroll = () => {
            if (guardando) return;
            guardando = true;
            requestAnimationFrame(guardar);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pagehide', guardar);

        return () => {
            window.removeEventListener('load', aplicar);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('pagehide', guardar);
        };
    }, []);

    // forceDark: se sacó el modo claro de esta página — el diseño está pensado
    // en oscuro (fondo espacial, planeta) y el claro quedaba como una versión
    // de segunda, no una alternativa real.
    return (
        <ThemeProvider forceDark>
            <div className="oc-page relative min-h-screen" style={{ background: 'var(--oc-bg)' }}>
                <style>{`
                    /* ── Paleta ───────────────────────────────────────────────
                       Todo el home v2 pinta con estas variables, así el tema claro
                       es un solo bloque de overrides y no una cacería de colores
                       por ocho componentes. Los valores claros se eligieron para
                       pasar 4.5:1 sobre el fondo (texto principal #0f172a y
                       secundario #475569 sobre #f8fafc). */
                    .oc-page {
                        --oc-bg:            #000;
                        --oc-text:          #ffffff;
                        --oc-text-2:        rgba(203,213,225,.82);
                        --oc-text-3:        #94a3b8;
                        --oc-text-4:        #64748b;
                        /* Empezó gris (#7c869b), después un azul grisáceo
                           (#7fa6dd) — pedido de subirlo: se ve más marca así,
                           el azul del logo y del resto del sitio (#3b82f6). */
                        --oc-title-2:       #3b82f6;
                        --oc-card-bg:       rgba(255,255,255,.028);
                        --oc-card-bd:       rgba(255,255,255,.075);
                        --oc-card-hover-bg: rgba(59,130,246,.055);
                        --oc-card-hover-bd: rgba(147,197,253,.34);
                        --oc-card-alt-bg:   rgba(30,58,138,.16);
                        --oc-card-alt-bd:   rgba(147,197,253,.36);
                        --oc-panel:         rgba(2,6,23,.82);
                        --oc-panel-bd:      rgba(147,197,253,.16);
                        --oc-accent:        #93c5fd;
                        --oc-accent-fuerte: #bfdbfe;
                        --oc-accent-soft:   rgba(59,130,246,.12);
                        --oc-accent-bd:     rgba(147,197,253,.20);
                        --oc-linea:         rgba(147,197,253,.42);
                        --oc-ok:            #4ade80;
                        --oc-cta-bg:        #ffffff;
                        --oc-cta-fg:        #0f172a;
                        --oc-cta-bg-hover:  #eff6ff;
                        --oc-cta-sombra:    0 10px 40px rgba(147,197,253,.22);
                        --oc-ghost-bg:      rgba(255,255,255,.04);
                        --oc-ghost-bd:      rgba(255,255,255,.16);
                        --oc-ghost-hover:   rgba(255,255,255,.10);
                    }
                    /* Este bloque queda sin efecto mientras <ThemeProvider forceDark>
                       esté activo arriba: html nunca lleva la clase "light", así
                       que esta paleta no se aplica. Se deja escrita (no se borra)
                       por si el modo claro vuelve a habilitarse más adelante — de
                       lo contrario habría que rehacer estos valores de cero. */
                    html.light .oc-page {
                        --oc-bg:            #f6f8fc;
                        --oc-text:          #0f172a;
                        --oc-text-2:        #334155;
                        --oc-text-3:        #475569;
                        --oc-text-4:        #64748b;
                        --oc-title-2:       #2563eb;
                        --oc-card-bg:       rgba(255,255,255,.86);
                        --oc-card-bd:       rgba(15,23,42,.10);
                        --oc-card-hover-bg: rgba(255,255,255,.98);
                        --oc-card-hover-bd: rgba(37,99,235,.38);
                        --oc-card-alt-bg:   rgba(219,234,254,.75);
                        --oc-card-alt-bd:   rgba(37,99,235,.32);
                        --oc-panel:         rgba(255,255,255,.94);
                        --oc-panel-bd:      rgba(15,23,42,.10);
                        --oc-accent:        #2563eb;
                        --oc-accent-fuerte: #1d4ed8;
                        --oc-accent-soft:   rgba(37,99,235,.09);
                        --oc-accent-bd:     rgba(37,99,235,.20);
                        --oc-linea:         rgba(37,99,235,.38);
                        --oc-ok:            #15803d;
                        --oc-cta-bg:        #0f172a;
                        --oc-cta-fg:        #ffffff;
                        --oc-cta-bg-hover:  #1e293b;
                        --oc-cta-sombra:    0 10px 30px rgba(15,23,42,.16);
                        --oc-ghost-bg:      rgba(255,255,255,.75);
                        --oc-ghost-bd:      rgba(15,23,42,.14);
                        --oc-ghost-hover:   rgba(15,23,42,.06);
                    }

                    /* Clases de texto de Tailwind usadas en el home v2, mapeadas a
                       la paleta. Se hace acá y no clase por clase en cada archivo
                       para no tener que duplicar cada color en dos temas. */
                    .oc-page .text-white   { color: var(--oc-text) !important; }
                    .oc-page .text-slate-200,
                    .oc-page .text-slate-300 { color: var(--oc-text-2) !important; }
                    .oc-page .text-slate-400 { color: var(--oc-text-3) !important; }
                    .oc-page .text-slate-500,
                    .oc-page .text-slate-600 { color: var(--oc-text-4) !important; }
                    .oc-page .text-blue-200,
                    .oc-page .text-blue-300,
                    .oc-page .text-blue-300\\/70,
                    .oc-page .text-blue-300\\/80,
                    .oc-page .text-blue-100\\/80 { color: var(--oc-accent) !important; }
                    html.light .oc-page .text-slate-300\\/85 { color: var(--oc-text-2) !important; }

                    /* Botones: se pintan por clase y no por utilidades de Tailwind,
                       porque el CTA invierte entre temas (blanco sobre negro /
                       negro sobre claro) y con clases fijas habría que duplicar
                       cada botón. */
                    .oc-page .oc-cta {
                        background: var(--oc-cta-bg) !important;
                        color: var(--oc-cta-fg) !important;
                        box-shadow: var(--oc-cta-sombra);
                    }
                    .oc-page .oc-cta:hover { background: var(--oc-cta-bg-hover) !important; }
                    .oc-page .oc-ghost {
                        background: var(--oc-ghost-bg) !important;
                        border-color: var(--oc-ghost-bd) !important;
                        color: var(--oc-text) !important;
                    }
                    .oc-page .oc-ghost:hover { background: var(--oc-ghost-hover) !important; }

                    /* Los anclas del navbar y de los CTA internos viajan suave. */
                    html { scroll-behavior: smooth; }
                    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

                    /* Realce al pasar el mouse: solo color, nunca transform — un
                       scale acá correría las tarjetas vecinas de la grilla. */
                    .oc-card-hover:hover {
                        border-color: var(--oc-card-hover-bd) !important;
                        background: var(--oc-card-hover-bg) !important;
                    }

                    .oc-faq summary::-webkit-details-marker { display: none; }
                    .oc-faq summary:hover { background: var(--oc-card-hover-bg) !important; }
                    .oc-faq summary:focus-visible { outline: 2px solid var(--oc-accent); outline-offset: 2px; }
                    .oc-faq-chevron { transition: transform 220ms ease; }
                    .oc-faq[open] .oc-faq-chevron { transform: rotate(180deg); }
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

                <NavbarV2 />

                <main className="relative">
                    <HeroCinematic />
                    <Modulos />
                    <ComoFunciona />
                    <PlanetaInteractivo />
                    <Comparativa />
                    <Rubros />
                    <Avanzado />
                    {/* "Sobre nosotros" va acá, después de que quedó claro qué es
                        el producto y antes del precio: es lo que baja la guardia
                        justo antes de pedir plata. */}
                    <Nosotros />
                    <Precios />
                    <Faq />
                    <CierreCta />
                </main>

                <FooterV2 />
            </div>
        </ThemeProvider>
    );
}
