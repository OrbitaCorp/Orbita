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
        {/* Sin esto, los navegadores móviles (Safari/Chrome) renderizan la
            página como si fuera de escritorio (~980px) y la escalan para
            que entre en la pantalla — nunca hubo un viewport meta tag en
            todo el proyecto. Causaba justamente el síntoma reportado: una
            franja sin contenido en un borde de la pantalla en mobile (el
            resultado visual típico de esa escala), y en general que las
            media queries `max-width` del resto del sitio corrieran contra
            un ancho de layout que no es el ancho real del dispositivo. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
