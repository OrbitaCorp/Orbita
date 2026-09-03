import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
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
            raíz del repo). Vale para landing, panel y onboarding. Las tiendas
            con favicon propio (Apariencia) lo pisan desde _app.tsx: su <link>
            queda después en el head y el navegador toma ese. */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
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
