// Lo que Órbita ofrece hoy: los precios de lista vigentes y la campaña pública
// de precio que esté prendida, si hay una.
//
// Se pide en el navegador y no en el build: cambiar un precio, o prender,
// apagar o editar una campaña desde el superadmin (o que se le acabe el cupo),
// tiene que verse sin volver a desplegar. Mientras carga, y si la API no
// responde, devuelve los precios por defecto de planesDatos.ts y ninguna
// campaña: nunca se promete un precio rebajado que después el alta no va a
// cobrar.

import { useEffect, useMemo, useState } from 'react';
import { getOfertaPublica, type OfertaPublica } from '@/lib/api';
import { TARJETAS, PERIODOS, tarjetasCon, periodosCon, type Campania, type Tarjeta, type Periodo } from './planesDatos';

export interface Oferta {
    campania: Campania | null;
    tarjetas: Tarjeta[];
    periodos: Periodo[];
}

export function useOferta(): Oferta {
    const [oferta, setOferta] = useState<OfertaPublica | null>(null);

    useEffect(() => {
        let vivo = true;
        getOfertaPublica()
            .then(o => { if (vivo) setOferta(o); })
            .catch(() => { /* sin oferta: quedan los precios por defecto */ });
        return () => { vivo = false; };
    }, []);

    return useMemo(() => ({
        campania: oferta?.campaign ?? null,
        tarjetas: oferta?.plans ? tarjetasCon(oferta.plans) : TARJETAS,
        periodos: oferta?.plans ? periodosCon(oferta.plans) : PERIODOS,
    }), [oferta]);
}
