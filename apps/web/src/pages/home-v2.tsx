// Página de PROPUESTA del home rediseñado (orbita.site).
//
// Vive aparte de index.tsx a propósito: es un experimento para mirar y comparar
// contra el home actual sin tocarlo. Si la propuesta se aprueba, esto se muda a
// index.tsx y este archivo se borra.
//
// El shell (escena espacial, navbar, footer, paleta de colores y el
// guardado/restauración de scroll) vive en PaginaV2.tsx — es el mismo que usa
// la página de "Sobre nosotros" (pages/nosotros.tsx), separada del home el
// 2026-09-06 para que tuviera su propia URL en vez de ser una sección más acá.

import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { HeroCinematic } from '@/modules/landing/components/sections/HeroCinematic';
import { Modulos } from '@/modules/landing/components/v2/Modulos';
import { ComoFunciona } from '@/modules/landing/components/v2/ComoFunciona';
import { PlanetaInteractivo } from '@/modules/landing/components/v2/PlanetaInteractivo';
import { Comparativa } from '@/modules/landing/components/v2/Comparativa';
import { Rubros } from '@/modules/landing/components/v2/Rubros';
import { Avanzado } from '@/modules/landing/components/v2/Avanzado';
import { Precios, Faq, CierreCta } from '@/modules/landing/components/v2/Cierre';

export default function HomeV2Page() {
    return (
        <PaginaV2 scrollKey="/home-v2">
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
