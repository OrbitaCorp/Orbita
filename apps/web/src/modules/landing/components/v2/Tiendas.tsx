// Directorio de tiendas (orbita.site/tiendas): las tiendas de Órbita, con su
// logo, su nombre, su descripción y un link a cada una.
//
// Existe por dos motivos. Para quien visita la landing, es la prueba de que hay
// negocios reales vendiendo con Órbita. Y para Google: es el link que lo lleva a
// cada tienda nueva, que es lo que hace que aparezcan solas (ver directorio.ts).
//
// Todo sale de lo que el dueño ya cargó (nombre, descripción del pie, logo): no
// hay nada escrito a mano ni inventado. Una tienda sin descripción se muestra
// sin ella, no con una frase de relleno.

import Link from 'next/link';
import type { DirectorioDeTiendas } from '@/lib/storefront/api';
import { direccionLegible, inicialDe, rutaDePagina, totalDePaginas, urlDeTienda } from '@/lib/storefront/directorio';
import { Card, Encabezado, Reveal, Seccion } from './Reveal';

function Logo({ nombre, url }: { nombre: string; url: string | null }) {
    const caja = { width: 48, height: 48 } as const;
    return url ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos de cada negocio, de un host propio de Órbita (Supabase)
        <img src={url} alt={`Logo de ${nombre}`} width={48} height={48} loading="lazy" decoding="async"
            className="shrink-0 rounded-xl object-cover" style={{ ...caja, background: 'var(--oc-card-alt-bg)' }} />
    ) : (
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ ...caja, background: 'var(--oc-card-alt-bg)', border: '1px solid var(--oc-card-bd)' }}>
            {inicialDe(nombre)}
        </span>
    );
}

export function Tiendas({ directorio, error = false }: { directorio: DirectorioDeTiendas; error?: boolean }) {
    const { stores, page } = directorio;
    const paginas = totalDePaginas(directorio);

    return (
        <Seccion id="tiendas">
            <Encabezado
                eyebrow="Tiendas en Órbita"
                titulo="Negocios que ya venden"
                resalte="con Órbita."
                nivel="h1"
                bajada="Cada tienda tiene su propia dirección. Entrá, mirá su catálogo y comprales directo."
            />

            {error ? (
                <p className="mt-12 text-center text-[15px] text-slate-400">No pudimos cargar las tiendas en este momento. Probá de nuevo en unos minutos.</p>
            ) : stores.length === 0 ? (
                <p className="mt-12 text-center text-[15px] text-slate-400">Todavía no hay tiendas para mostrar.</p>
            ) : (
                <Reveal delay={120}>
                    <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {stores.map(t => (
                            <li key={t.subdomain}>
                                {/* Todo el recuadro es el link: un blanco de toque grande en el celular. */}
                                <a
                                    href={urlDeTienda(t)}
                                    className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                                >
                                    <Card className="h-full p-5 transition-colors group-hover:border-blue-400/40">
                                        <div className="flex items-center gap-4">
                                            <Logo nombre={t.name} url={t.logoUrl} />
                                            <div className="min-w-0">
                                                <h3 className="truncate text-[15px] font-bold text-white">{t.name}</h3>
                                                <p className="truncate font-mono text-[12px] text-slate-500">{direccionLegible(t)}</p>
                                            </div>
                                        </div>
                                        {t.description && (
                                            <p className="mt-4 line-clamp-2 text-[14px] leading-relaxed text-slate-400">{t.description}</p>
                                        )}
                                        <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-300 group-hover:text-blue-200">
                                            Ver tienda <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                                        </span>
                                    </Card>
                                </a>
                            </li>
                        ))}
                    </ul>
                </Reveal>
            )}

            {paginas > 1 && (
                <nav aria-label="Páginas del directorio" className="mt-12 flex items-center justify-center gap-6 text-[14px]">
                    {page > 1
                        ? <Link href={rutaDePagina(page - 1)} rel="prev" className="inline-flex min-h-[44px] items-center text-blue-300 hover:text-blue-200">← Anterior</Link>
                        : <span className="inline-flex min-h-[44px] items-center text-slate-600">← Anterior</span>}
                    <span className="text-slate-400">Página {page} de {paginas}</span>
                    {page < paginas
                        ? <Link href={rutaDePagina(page + 1)} rel="next" className="inline-flex min-h-[44px] items-center text-blue-300 hover:text-blue-200">Siguiente →</Link>
                        : <span className="inline-flex min-h-[44px] items-center text-slate-600">Siguiente →</span>}
                </nav>
            )}
        </Seccion>
    );
}
