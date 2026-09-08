import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Pruebas unitarias del panel: lógica pura (reducers, adaptadores API↔panel,
// helpers de fechas). Sin DOM: lo que se prueba acá no renderiza nada, así
// que no hace falta jsdom ni testing-library. Correr con `pnpm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
