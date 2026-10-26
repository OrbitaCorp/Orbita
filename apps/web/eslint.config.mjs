import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Cada módulo es independiente (decisión de Ale, 26/10/2026): Turnos, Alquileres y
// Gimnasio no se importan entre sí ni importan el alta, y lo compartido
// (lib/reservas, design-system/reservas) no importa ningún módulo. El único que
// conoce a todos es el alta (modules/onboarding/alta). El porqué, en
// src/lib/reservas/README.md. Turnos todavía usa piezas de Tienda (ventas) y de la
// landing desde antes de esta regla: no se cortan acá.
const MENSAJE_MODULOS =
  "Cada módulo es independiente: lo compartido va en lib/reservas o design-system/reservas (ver src/lib/reservas/README.md).";
const MODULOS_DE_RESERVAS = ["turnos", "alquileres", "gimnasio"];
const independiente = (propio, ademas = []) => {
  const otros = [...MODULOS_DE_RESERVAS.filter((m) => m !== propio), "onboarding/alta", ...ademas].join("|");
  return {
    files: [`src/modules/${propio}/**`],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { regex: `^@/modules/(${otros})(/|$)`, message: MENSAJE_MODULOS },
          { regex: `^(\\.\\.?/)+(.*/)?(${otros})(/|$)`, message: MENSAJE_MODULOS },
        ],
      }],
    },
  };
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  independiente("turnos"),
  // Los módulos nuevos tampoco dependen de Tienda ni de la landing.
  independiente("alquileres", ["ventas", "landing", "onboarding"]),
  independiente("gimnasio", ["ventas", "landing", "onboarding"]),
  {
    files: ["src/lib/reservas/**", "src/design-system/reservas/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { regex: "^@/modules/", message: MENSAJE_MODULOS },
          { regex: "^(\\.\\.?/)+(.*/)?modules/", message: MENSAJE_MODULOS },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
