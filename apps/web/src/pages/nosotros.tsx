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
//
// Va sin planeta: acá el arco celeste del horizonte cruzaba justo por arriba
// de las tarjetas de misión y visión y no se podían leer. Quedan solo las
// estrellas, que sobre negro no molestan el contraste.

import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { Nosotros } from '@/modules/landing/components/v2/Nosotros';
import { Seo } from '@/modules/landing/components/Seo';

export default function NosotrosPage() {
    return (
        <PaginaV2 scrollKey="/nosotros" planeta={false}>
            <Seo
                title="Sobre nosotros — Órbita"
                description="Conocé al equipo detrás de Órbita y la misión de darle a cualquier emprendedor las herramientas para vender online sin fricción."
                path="/nosotros"
            />
            <Nosotros />
        </PaginaV2>
    );
}
