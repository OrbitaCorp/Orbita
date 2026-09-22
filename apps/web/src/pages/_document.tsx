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
        {/* Preconnects a Google Fonts: las fuentes base (Geist, Sora) ya son
            self-hosted, pero las tiendas siguen cargando fuentes custom por
            Google Fonts vía ssrFontsHref en _app.tsx. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Geist (body) se precarga: es la fuente del elemento LCP ("Órbita"
            en PageLoader, font-weight 700). El preload le dice al navegador
            que empiece a bajarla ANTES de parsear el CSS, recortando ~200ms
            del render delay del LCP. Solo el subset latin (el de Sora y Geist
            Mono no es crítico para el primer pintado). */}
        <link
          rel="preload"
          href="/fonts/geist-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Fonts self-hosted (antes: <link rel="stylesheet"> a Google Fonts,
            636ms render-blocking). Ahora los woff2 viven en public/fonts/ y
            se sirven desde el mismo CDN de Vercel — cero requests externas.
            Las fuentes son variables (un solo archivo cubre todos los pesos),
            con unicode-range para que el navegador solo baje latin/latin-ext
            (los subsets que usa una app en español). */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/geist-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
          @font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/geist-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
          @font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/geist-mono-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
          @font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/geist-mono-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
          @font-face{font-family:'Sora';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/sora-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
          @font-face{font-family:'Sora';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/sora-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
        `}} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
