import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  // Next toma control del scroll apenas se activa el router del cliente
  // (pone `history.scrollRestoration = 'manual'` por su cuenta) — eso rompe
  // también la restauración NATIVA del navegador al recargar la página (F5):
  // sin esto, cualquier página vuelve al tope al refrescar, en vez de quedar
  // donde estaba. Con esta flag, Next se encarga de guardar y restaurar la
  // posición él mismo (recarga y navegación con atrás/adelante incluidas).
  experimental: {
    scrollRestoration: true,
  },
  // Subdominios de tienda en desarrollo: Next 16 bloquea recursos de dev
  // (/_next/*) servidos a orígenes distintos de localhost salvo que se listen
  // acá. Agregar cada tienda de prueba usada en local.
  allowedDevOrigins: [
    'orbita.local',
    'tienda1.orbita.local',
    'tienda2.orbita.local',
  ],
};

export default nextConfig;
