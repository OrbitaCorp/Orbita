// "Probá la demo": la entrada a la demo pública desde la landing. Dos roles,
// sin cuenta: la tienda (como cliente) y el panel (como dueño). La demo vive
// en el subdominio `demo` (ver lib/demo/modo.ts); lo que el visitante cambia
// queda solo en su navegador.

import { useEffect, useState } from 'react';
import { Reveal, Seccion, Encabezado, Card } from './Reveal';
import { ROOT_DOMAIN, tenantUrl } from '@/lib/tenant';
import { DEMO_SLUG } from '@/lib/demo/modo';

// En el server no hay window para saber protocolo y puerto: arranca con la
// URL de producción y se corrige al montar (dev: http y :3001).
const urlInicial = (path: string) => `https://${DEMO_SLUG}.${ROOT_DOMAIN}${path}`;

const ROLES = [
    {
        id: 'tienda',
        rol: 'Como cliente',
        titulo: 'La tienda',
        texto: 'Recorré Nébula Tech: catálogo, fichas con video, descuentos, carrito y un checkout completo con pago simulado.',
        cta: 'Ver la tienda',
        path: '/',
    },
    {
        id: 'panel',
        rol: 'Como dueño',
        titulo: 'El panel',
        texto: 'Dashboard, pedidos, productos, clientes, descuentos y reportes, con tres meses de ventas cargadas.',
        cta: 'Ver el panel',
        path: '/panel',
    },
] as const;

export function Demo() {
    const [urls, setUrls] = useState<Record<string, string>>(() => Object.fromEntries(ROLES.map(r => [r.id, urlInicial(r.path)])));
    useEffect(() => {
        setUrls(Object.fromEntries(ROLES.map(r => [r.id, tenantUrl(DEMO_SLUG, r.path)])));
    }, []);

    return (
        <Seccion id="demo">
            <Encabezado
                eyebrow="Demo"
                titulo="Mirala funcionando"
                resalte="antes de crear la tuya."
                bajada="Una tienda de verdad, con pedidos, clientes y reportes. Entrá como cliente o como dueño: sin cuenta y sin tarjeta."
            />

            <Reveal className="mt-10">
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {ROLES.map((r, i) => (
                        <Card key={r.id} destacada={i === 1} className="oc-card-hover flex h-full flex-col p-6 sm:p-7">
                            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{r.rol}</span>
                            <h3 className="mt-2 text-[22px] font-black tracking-[-0.02em] text-white">{r.titulo}</h3>
                            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-slate-400">{r.texto}</p>
                            <a
                                href={urls[r.id]}
                                className={`${i === 1 ? 'oc-cta' : 'oc-ghost text-white/90 hover:bg-white/10'} mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold transition-colors duration-200 sm:w-auto sm:self-start`}
                                style={{ minHeight: 48, ...(i === 1 ? {} : { border: '1px solid var(--oc-ghost-bd)' }) }}
                            >
                                {r.cta}
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </Card>
                    ))}
                </div>
                <p className="mt-5 text-center text-[12.5px] text-slate-500">
                    Lo que cambies en la demo queda solo en tu navegador: no se toca nada real.
                </p>
            </Reveal>
        </Seccion>
    );
}
