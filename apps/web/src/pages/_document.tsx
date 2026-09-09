import { Html, Head, Main, NextScript, type DocumentProps } from 'next/document';

export default function Document(props: DocumentProps) {
  // Favicon: el de Órbita es para la landing, el panel y el onboarding. Una
  // tienda con favicon propio (o, si no cargó uno, con logo) va con el suyo,
  // que _app.tsx inyecta con next/head. Ese <link> queda ANTES de estos en el
  // head, y los navegadores toman el último rel="icon" que les sirve — así
  // que acá, cuando la tienda ya tiene el suyo, no se ponen los de Órbita.
  const pageProps = props.__NEXT_DATA__?.props?.pageProps as { __storeMeta?: { favicon?: string | null } | null } | undefined
  const tiendaConFavicon = Boolean(pageProps?.__storeMeta?.favicon)
  return (
    <Html lang="es">
      <Head>
        {/* El <meta name="viewport"> va en _app.tsx, no acá: Next (pages router)
            pisa el de _document con su default `width=device-width`, así que
            este nunca llegaba a mandar de verdad (y encima quedaban dos tags).
            Ver el <Head> de _app.tsx. */}
        {/* Favicon de Órbita (logo sin fondo, generado desde favicon.png de la
            raíz del repo). Solo cuando la tienda no tiene el suyo — ver arriba. */}
        {!tiendaConFavicon && (
          <>
            <link rel="icon" href="/favicon.ico" sizes="48x48" />
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
            <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          </>
        )}
        <meta name="google-site-verification" content="BZgmwBTk6SqxB_EmWi9TyoQA5eX1fLqdnpxc2uIt754" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Sora:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
