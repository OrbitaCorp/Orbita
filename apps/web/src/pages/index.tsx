// Home de orbita.site.
//
// Hasta el 2026-09-07 esto era el diseño viejo (Navbar/Hero/ScrollSequence/
// PresentationSections/Footer de landing/components/layout y sections). Se
// reemplaza por el rediseño que se venía trabajando aparte en pages/home-v2.tsx
// — ese archivo se borra, esto ES el home ahora. /home-v2 queda con un redirect
// acá (ver next.config.ts) para no romper links viejos.
//
// El shell (escena espacial, navbar, footer, paleta de colores y el
// guardado/restauración de scroll) vive en PaginaV2.tsx — es el mismo que usa
// pages/nosotros.tsx.

import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { HeroCinematic } from '@/modules/landing/components/sections/HeroCinematic';
import { Modulos } from '@/modules/landing/components/v2/Modulos';
import { ComoFunciona } from '@/modules/landing/components/v2/ComoFunciona';
import { PlanetaInteractivo } from '@/modules/landing/components/v2/PlanetaInteractivo';
import { Comparativa } from '@/modules/landing/components/v2/Comparativa';
import { Rubros } from '@/modules/landing/components/v2/Rubros';
import { Avanzado } from '@/modules/landing/components/v2/Avanzado';
import { Precios, Faq, CierreCta } from '@/modules/landing/components/v2/Cierre';

export default function HomePage() {
    return (
        <PaginaV2 scrollKey="/">
            <HeroCinematic />
            <Modulos />
            <ComoFunciona />
            <PlanetaInteractivo />
            <Comparativa />
            <Rubros />
            <Avanzado />
            <Precios />
            <Faq />
            <CierreCta />
        </PaginaV2>
    );
}
