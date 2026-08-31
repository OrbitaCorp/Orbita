# syntax=docker/dockerfile:1

# Imagen de Node con glibc (no alpine): argon2, sharp y onnxruntime-node usan
# binarios nativos prebuilt para linux-x64-glibc — alpine (musl) puede forzar
# compilación desde fuente o directamente fallar para onnxruntime-node.
ARG NODE_VERSION=22-slim

# ---------- deps: instala TODAS las dependencias (dev incluidas) ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Sin el binario "openssl" instalado, "prisma generate" no puede detectar la
# versión de libssl del sistema y cae a un default (openssl-1.1.x) que NO
# coincide con la libssl3 real de node:22-slim (Debian bookworm) — el motor
# de Prisma que se descarga queda para la versión equivocada. Lo instalamos
# ANTES de "pnpm install" para que la detección sea correcta desde el vamos.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Solo lo necesario para resolver e instalar deps primero (cache de capas).
# El schema de Prisma tiene que estar presente porque "postinstall" corre
# "prisma generate" automáticamente.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

# ---------- build: compila TypeScript -> dist/ ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ---------- prod-deps: poda devDependencies del node_modules ya armado ----------
# OJO: NO se hace un "pnpm install --prod" desde cero acá. El "postinstall"
# del package.json corre "prisma generate", y ese comando requiere el CLI de
# "prisma" — que es (correctamente) una devDependency. Con --prod ese
# binario no se instala y el postinstall revienta ("prisma: not found").
# En cambio, reusamos el node_modules de "deps" (ya con el cliente de Prisma
# generado) y solo lo podamos con "pnpm prune", que no vuelve a correr
# scripts de instalación.
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# --ignore-scripts: "pnpm prune" vuelve a correr el "postinstall" de la raíz
# (prisma generate) después de podar — y como recién sacamos el CLI de
# prisma (devDependency), falla ("prisma: not found"). No hace falta
# regenerar nada acá: el cliente ya quedó generado en la etapa "deps" y
# "prune" no toca esos archivos, solo remueve paquetes.
RUN pnpm prune --prod --ignore-scripts

# ---------- runtime: imagen final, liviana ----------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production

# El motor de Prisma (libquery_engine) linkea contra libssl en runtime, no
# solo en generate-time — sin esto el arranque puede fallar con "libssl.so.3:
# cannot open shared object file" en algunas variantes de la imagen slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Usuario no-root (buena práctica de seguridad en contenedores).
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER nestjs

# Cloud Run inyecta $PORT (por defecto 8080); main.ts ya lee process.env.PORT.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/main.js"]
