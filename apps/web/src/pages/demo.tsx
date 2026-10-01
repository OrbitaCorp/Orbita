// orbita.site/demo — la entrada a la demo pública (ver DemoEntrada.tsx). A
// esta vista lleva el botón "Probá la demo" del hero. `?rol=tienda|panel`
// llega con esa perspectiva ya elegida.

import { useRouter } from 'next/router';
import { Seo } from '@/modules/landing/components/Seo';
import { DemoEntrada } from '@/modules/landing/components/v2/DemoEntrada';

export default function DemoPage() {
    const { query, isReady } = useRouter();
    const rol = query.rol === 'tienda' || query.rol === 'panel' ? query.rol : null;
    return (
        <>
            <Seo
                title="Demo de Órbita — Mirala funcionando"
                description="Probá Órbita sin cuenta: entrá a una tienda de verdad como cliente o al panel como dueño, con pedidos, clientes y reportes."
                path="/demo"
            />
            {/* Espera al router para que `?rol=` llegue como estado inicial. */}
            {isReady && <DemoEntrada rolInicial={rol} />}
        </>
    );
}
