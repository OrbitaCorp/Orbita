// La campaña pública de precio congelado que esté prendida, si hay una.
//
// Se pide en el navegador y no en el build: prender, apagar o editar una
// campaña desde el superadmin (o que se le acabe el cupo) tiene que verse sin
// volver a desplegar. Mientras carga, y si la API no responde, devuelve null y
// las pantallas muestran el precio de lista: nunca se promete un precio
// rebajado que después el alta no va a cobrar.

import { useEffect, useState } from 'react';
import { getOfertaPublica } from '@/lib/api';
import type { Campania } from './planesDatos';

export function useOferta(): Campania | null {
    const [campania, setCampania] = useState<Campania | null>(null);

    useEffect(() => {
        let vivo = true;
        getOfertaPublica()
            .then(o => { if (vivo) setCampania(o.campaign); })
            .catch(() => { /* sin oferta: queda el precio de lista */ });
        return () => { vivo = false; };
    }, []);

    return campania;
}
