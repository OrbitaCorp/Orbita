// Página "Planes" del rediseño (orbita.site/planes).
//
// Compara Base vs Base + Avanzado y muestra qué sale cada período. Se llega
// desde el "Ver más detalle" de las dos tarjetas de precio del home. Antes
// esta comparación era un modal adentro de la sección de precios (ver el
// comentario al principio de Planes.tsx).
//
// Mismo shell que home-v2 y /nosotros (PaginaV2: escena espacial, navbar,
// footer, paleta y guardado/restauración de scroll), con su propia clave de
// scroll para no pisar la posición guardada de las otras.
//
// Va sin planeta, por la misma razón que /nosotros: el arco celeste del
// horizonte cruza por arriba de las tarjetas y les come el contraste. Quedan
// solo las estrellas, que sobre negro no molestan.

import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { Planes } from '@/modules/landing/components/v2/Planes';

export default function PlanesPage() {
    return (
        <PaginaV2 scrollKey="/planes" planeta={false}>
            <Planes />
        </PaginaV2>
    );
}
