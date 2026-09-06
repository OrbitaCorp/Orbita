// Página "Sobre nosotros" del rediseño (orbita.site/nosotros).
//
// Antes era una sección más de home-v2.tsx, entre Avanzado y Precios. Se
// separó a su propia ruta el 2026-09-06 para que tuviera su propia URL y no
// compitiera con las secciones que sí empujan a la conversión — el navbar
// (NavbarV2.tsx) la deja como último link, después de Preguntas.
//
// Usa el mismo shell que home-v2 (PaginaV2.tsx: escena espacial, navbar,
// footer, paleta y guardado/restauración de scroll), con su propia clave de
// scroll para no pisar la posición guardada del home.

import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { Nosotros } from '@/modules/landing/components/v2/Nosotros';

export default function NosotrosPage() {
    return (
        <PaginaV2 scrollKey="/nosotros">
            <Nosotros />
        </PaginaV2>
    );
}
