/**
 * Corre los casos de casos.ts contra Orbi de verdad y aplica las reglas.
 *
 *   pnpm test:evals                      # todos los casos
 *   pnpm test:evals -- --caso=rubro      # solo los que matcheen ese texto
 *   pnpm test:evals -- --repeticiones=3  # cada caso N veces (el modelo no es determinista)
 *
 * Para comparar modelos o esfuerzo de razonamiento, se pisan por env — el
 * adapter los lee de ahí (ver groq.adapter.ts):
 *
 *   ORBI_MODEL=moonshotai/kimi-k2-instruct pnpm test:evals
 *   ORBI_REASONING_EFFORT=medium pnpm test:evals
 *
 * ── Por qué esto y no promptfoo ──────────────────────────────────────────────
 * promptfoo da UI, caché y comparación lado a lado, y sigue siendo la opción
 * natural si esto crece. Hoy no compensa: es una devDependency pesada, y el
 * Dockerfile del backend instala TODAS las dependencias en la etapa de build
 * (recién poda con `pnpm prune --prod` al final), así que cada deploy pagaría
 * ese peso. Lo que importa de una suite de evals no es el runner: son los casos
 * y las reglas, y los dos están en archivos aparte, portables tal cual el día
 * que se quiera mover a promptfoo.
 *
 * OJO: esto llama a la API de Groq de verdad. Cuesta plata (poca) y tarda.
 * Por eso NO está en el CI: es una corrida a mano, antes y después de tocar un
 * prompt, para ver si mejoró o empeoró.
 */

import { resolve } from 'node:path';
import { config as cargarDotenv } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { GroqAdapter } from '../../src/orbi/llm/groq.adapter';
import type { LlmMessage } from '../../src/orbi/llm/llm-adapter.interface';
import { ContextBuilderService } from '../../src/orbi/context/context-builder.service';
import { ToolRegistryService } from '../../src/orbi/tools/tool-registry.service';
import { OrbiSurface } from '../../src/orbi/dto/orbi-chat.dto';
import {
  SuggestBusinessNameTool,
  SuggestDescriptionTool,
  SelectWizardOptionTool,
  FillWizardFieldTool,
} from '../../src/orbi/tools/definitions/wizard.tools';
import { CASOS, type Caso } from './casos';
import { evaluarTurno, verificarExpectativas, type TurnoDeOrbi, type Violacion } from './reglas';

// La GROQ_API_KEY sale del .env local. dotenv NO pisa lo que ya está en el
// entorno, así que `ORBI_MODEL=x pnpm test:evals` sigue mandando.
cargarDotenv({ path: resolve(__dirname, '../../.env') });

type Resultado = {
  caso: Caso;
  intento: number;
  turno: TurnoDeOrbi;
  violaciones: Violacion[];
  ms: number;
  error?: string;
};

// ─── Armado de las piezas reales ─────────────────────────────────────────────

// El ConfigService de Nest sobre process.env, sin levantar la app entera.
const config = new ConfigService();

const registry = new ToolRegistryService();
registry.register(new SuggestBusinessNameTool(config));
registry.register(new SuggestDescriptionTool(config));
registry.register(new SelectWizardOptionTool());
registry.register(new FillWizardFieldTool());

// En superficie wizard, buildSystemPrompt no toca la base (no hay negocio
// todavía): por eso puede recibir un Prisma que no existe.
const contextBuilder = new ContextBuilderService(null as never);
const llm = new GroqAdapter(config);

// ─── Rate limit ──────────────────────────────────────────────────────────────

/**
 * El tier gratuito de Groq corta por tokens-por-minuto, y una tanda entera de
 * casos lo toca sin esfuerzo. Sin esto, el 429 entraba al reporte como si fuera
 * una falla del modelo — que es la peor mentira posible en una herramienta de
 * medición: te hace "arreglar" un prompt que nunca estuvo roto.
 *
 * Groq dice en el mensaje cuántos segundos hay que esperar; se le hace caso.
 */
async function conReintentoPorRateLimit<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const esRateLimit = msg.includes('rate_limit_exceeded') || msg.includes('429');
      if (!esRateLimit || i >= intentos) throw error;

      const segundos = Number(/try again in ([\d.]+)s/.exec(msg)?.[1] ?? 10);
      console.log(`${GRIS}  … rate limit, esperando ${segundos.toFixed(1)}s${FIN}`);
      await new Promise(r => setTimeout(r, Math.ceil((segundos + 1) * 1000)));
    }
  }
}

// ─── Una corrida ─────────────────────────────────────────────────────────────

// Tope de vueltas del loop tool → respuesta. El controller no tiene tope (sale
// cuando el modelo deja de pedir tools); acá sí, porque una eval que se cuelga
// en un loop es una eval que nadie corre.
const MAX_VUELTAS = 4;

// El wizard no tiene negocio ni usuario todavía: las tools de este paso no
// tocan la base. Es el mismo contexto vacío que arma OrbiController.chatWizard.
// availableOptions se completa por caso: selectWizardOption lo usa para
// rechazar un key que no exista en ese paso.
const ctxDeTools = {
  businessId: '',
  userId: '',
  surface: OrbiSurface.WIZARD,
  permissions: [] as string[],
  availableOptions: undefined as Caso['availableOptions'],
};

async function correrCaso(caso: Caso, intento: number): Promise<Resultado> {
  const arrancoEn = Date.now();

  const contexto = {
    surface: OrbiSurface.WIZARD,
    stepName: caso.stepName,
    rubro: caso.rubro,
    availableOptions: caso.availableOptions,
    formState: caso.formState,
  };

  const systemPrompt = await contextBuilder.buildSystemPrompt({
    message: caso.mensaje,
    context: contexto,
  } as never);

  const tools = registry.getTools(OrbiSurface.WIZARD, [], caso.stepName);

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(caso.historial ?? []).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: caso.mensaje },
  ];

  const turno: TurnoDeOrbi = { texto: '', toolCalls: [] };

  try {
    // Se replica el loop del controller: cuando el modelo llama una tool, se
    // ejecuta de verdad, se le devuelve el resultado y se lo deja hablar otra
    // vez. Medir solo el primer turno era medir una cosa que el usuario nunca
    // ve — con este modelo la primera respuesta casi siempre es la tool sola,
    // y el texto recién aparece en la vuelta siguiente. Una eval que juzga un
    // estado intermedio del pipeline reporta fallas que en pantalla no existen,
    // y eso es peor que no medir: manda a "arreglar" prompts que están bien.
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const parcial = await conReintentoPorRateLimit(async () => {
        const p: { texto: string; llamadas: { id: string; name: string; arguments: Record<string, unknown> }[] } =
          { texto: '', llamadas: [] };
        for await (const evento of llm.streamChat({ messages, tools: tools.length ? tools : undefined })) {
          if (evento.type === 'text') p.texto += evento.chunk;
          if (evento.type === 'tool_call') p.llamadas.push(evento.call);
        }
        return p;
      });

      turno.texto += parcial.texto;
      turno.toolCalls.push(...parcial.llamadas.map(c => ({ name: c.name, arguments: c.arguments })));

      if (!parcial.llamadas.length) break;

      for (const llamada of parcial.llamadas) {
        const resultado = await registry.execute(
          llamada.name,
          llamada.arguments,
          { ...ctxDeTools, availableOptions: caso.availableOptions },
          caso.stepName,
        );
        messages.push({
          role: 'assistant',
          content: parcial.texto,
          toolCalls: [{ id: llamada.id, name: llamada.name, arguments: llamada.arguments }],
        });
        messages.push({ role: 'tool', content: JSON.stringify(resultado), toolCallId: llamada.id });
      }
    }
  } catch (error) {
    return {
      caso, intento, turno, ms: Date.now() - arrancoEn,
      violaciones: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  turno.texto = turno.texto.trim();

  const escenario = {
    stepName: caso.stepName,
    availableOptions: caso.availableOptions,
    toolsAutorizadas: tools.map(t => t.name),
    topeDeLargo: caso.topeDeLargo,
  };

  return {
    caso,
    intento,
    turno,
    ms: Date.now() - arrancoEn,
    violaciones: [
      ...evaluarTurno(turno, escenario),
      ...verificarExpectativas(turno, caso.expectativas),
    ],
  };
}

// ─── Reporte ─────────────────────────────────────────────────────────────────

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const GRIS = '\x1b[90m';
const FIN = '\x1b[0m';

function imprimir(resultados: Resultado[]): void {
  for (const r of resultados) {
    const ok = !r.violaciones.length && !r.error;
    const marca = ok ? `${VERDE}✓${FIN}` : `${ROJO}✗${FIN}`;
    const sufijo = r.intento > 1 ? ` ${GRIS}(intento ${r.intento})${FIN}` : '';

    console.log(`\n${marca} ${r.caso.id}${sufijo} ${GRIS}${r.ms}ms${FIN}`);
    console.log(`  ${GRIS}${r.caso.descripcion}${FIN}`);

    if (r.error) {
      console.log(`  ${ROJO}error: ${r.error}${FIN}`);
      continue;
    }

    const llamadas = r.turno.toolCalls
      .map(c => `${c.name}(${JSON.stringify(c.arguments)})`)
      .join(' + ');
    console.log(`  ${GRIS}dijo:${FIN} ${unaLinea(r.turno.texto)}`);
    console.log(`  ${GRIS}llamó:${FIN} ${llamadas || `${GRIS}nada${FIN}`}`);

    for (const v of r.violaciones) {
      console.log(`  ${ROJO}✗ [${v.regla}] ${v.detalle}${FIN}`);
    }
  }
}

function resumen(resultados: Resultado[]): void {
  const total = resultados.length;
  const fallados = resultados.filter(r => r.violaciones.length || r.error);

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Modelo: ${llm.modelo}`);
  console.log(
    `Razonamiento: ${process.env.ORBI_REASONING_EFFORT ?? 'low'} | ` +
    `Temperatura: ${process.env.ORBI_TEMPERATURE ?? '0.3'}`,
  );

  // El desglose por regla es lo que hace comparable una corrida con otra: no
  // interesa tanto "pasó/no pasó" como en QUÉ se equivoca este modelo.
  const porRegla = new Map<string, number>();
  for (const r of resultados) {
    for (const v of r.violaciones) porRegla.set(v.regla, (porRegla.get(v.regla) ?? 0) + 1);
  }

  if (porRegla.size) {
    console.log('\nViolaciones por regla:');
    for (const [regla, n] of [...porRegla].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${regla.padEnd(24)} ${n}`);
    }
  }

  const latencias = resultados.filter(r => !r.error).map(r => r.ms).sort((a, b) => a - b);
  if (latencias.length) {
    console.log(`\nLatencia mediana: ${latencias[Math.floor(latencias.length / 2)]}ms`);
  }

  const color = fallados.length ? ROJO : VERDE;
  console.log(`\n${color}${total - fallados.length}/${total} corridas limpias${FIN}\n`);
}

function unaLinea(texto: string, max = 110): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length > max ? `${plano.slice(0, max)}…` : plano;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const filtro = args.find(a => a.startsWith('--caso='))?.slice('--caso='.length);
  const repeticiones = Number(args.find(a => a.startsWith('--repeticiones='))?.slice('--repeticiones='.length)) || 1;

  if (!process.env.GROQ_API_KEY) {
    console.error('Falta GROQ_API_KEY (sale de apps/api/.env). Estas evals llaman a la API de verdad.');
    process.exit(1);
  }

  const casos = filtro ? CASOS.filter(c => c.id.includes(filtro)) : CASOS;
  if (!casos.length) {
    console.error(`Ningún caso matchea "${filtro}".`);
    process.exit(1);
  }

  console.log(`Corriendo ${casos.length} caso(s) x ${repeticiones} con ${llm.modelo}…`);

  const resultados: Resultado[] = [];
  for (let intento = 1; intento <= repeticiones; intento++) {
    // En serie a propósito: el endpoint público tiene rate limit y en paralelo
    // los 429 se leerían como fallas del modelo.
    for (const caso of casos) {
      resultados.push(await correrCaso(caso, intento));
    }
  }

  imprimir(resultados);
  resumen(resultados);

  process.exit(resultados.some(r => r.violaciones.length || r.error) ? 1 : 0);
}

void main();
