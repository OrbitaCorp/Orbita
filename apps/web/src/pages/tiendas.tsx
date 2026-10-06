// Directorio público de tiendas (orbita.site/tiendas).
//
// Es lo que hace que cada tienda de Órbita, con subdominio o con dominio propio,
// llegue sola a Google: Google solo lee el sitemap y el robots.txt de una tienda
// después de haber entrado a ella, y entrar requiere un link. Esta página enlaza
// a todas las tiendas que corresponde mostrar (las mismas que se indexan), se
// arma sola y está en el footer de toda la landing y en el sitemap de Órbita.
// Ver lib/storefront/directorio.ts.
//
// Mismo shell que el resto de la landing (PaginaV2) y sin planeta, como
// "Sobre nosotros": solo las estrellas.

import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { PaginaV2 } from '@/modules/landing/components/v2/PaginaV2';
import { Tiendas } from '@/modules/landing/components/v2/Tiendas';
import { Seo } from '@/modules/landing/components/Seo';
import { SEO_CANONICAL_HOST } from '@/lib/tenant';
import { getDirectorioTiendas, type DirectorioDeTiendas } from '@/lib/storefront/api';
import { jsonLdDirectorio, rutaDePagina, totalDePaginas } from '@/lib/storefront/directorio';
import { serializarJsonLd } from '@/lib/storefront/seo';

type Props = { directorio: DirectorioDeTiendas; error: boolean };

const VACIO: DirectorioDeTiendas = { total: 0, page: 1, perPage: 48, lastChange: null, stores: [] };

export const getServerSideProps: GetServerSideProps<Props> = async ({ query, res }) => {
    const pedida = Math.min(Math.max(parseInt(String(query.pagina ?? '1'), 10) || 1, 1), 1000);
    try {
        const directorio = await getDirectorioTiendas(pedida);
        // Una página que no existe (más allá de la última) es un 404 de verdad.
        if (pedida > 1 && pedida > totalDePaginas(directorio)) return { notFound: true };
        // La lista cambia cuando se suma una tienda, no en cada visita: unos
        // minutos de caché en el borde alcanzan y no le pegan a la API de más.
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
        return { props: { directorio, error: false } };
    } catch {
        // Con la API caída se responde 503: Google vuelve a intentar, en vez de
        // guardar una lista vacía como si fuera la real.
        res.statusCode = 503;
        res.setHeader('Retry-After', '300');
        return { props: { directorio: VACIO, error: true } };
    }
};

export default function TiendasPage({ directorio, error }: Props) {
    const path = rutaDePagina(directorio.page);
    return (
        <PaginaV2 scrollKey="/tiendas" planeta={false}>
            <Seo
                title="Tiendas en Órbita — negocios que ya venden online"
                description="Mirá las tiendas de los negocios que venden con Órbita. Cada una tiene su propia dirección y su catálogo: entrá y comprales directo."
                path={path}
            />
            {!error && directorio.stores.length > 0 && (
                <Head>
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdDirectorio(directorio, `https://${SEO_CANONICAL_HOST}${path}`)) }}
                    />
                </Head>
            )}
            <Tiendas directorio={directorio} error={error} />
        </PaginaV2>
    );
}
