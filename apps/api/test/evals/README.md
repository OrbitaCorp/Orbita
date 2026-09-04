# Evals de Orbi

Mide si Orbi contesta bien en el wizard de onboarding. No reemplaza al criterio
humano — reemplaza al *"a mí me pareció que quedó mejor"*, que es con lo que se
venían tocando los prompts hasta ahora.

```bash
cd apps/api
pnpm test:evals                          # todos los casos
pnpm test:evals -- --caso=rubro          # los que matcheen ese texto
pnpm test:evals -- --repeticiones=3      # cada caso N veces
```

Necesita `GROQ_API_KEY` en `apps/api/.env` (ya está ahí si podés correr el
backend). **Llama a la API de verdad**: cuesta plata (centavos) y una tanda
completa tarda unos minutos, sobre todo porque el tier gratuito corta por
tokens-por-minuto y el runner espera y reintenta.

## Qué hay acá

| Archivo | Qué es |
|---|---|
| `reglas.ts` | Las cinco reglas duras. Deterministas, sin ningún LLM juzgando. |
| `casos.ts` | El golden set: situación → qué se espera. |
| `run.ts` | El runner. Arma prompt y tools con los servicios reales. |

Las reglas están cubiertas por `test/unit/orbi-evals.reglas.unit-spec.ts`, que
**sí** corre en CI. Las evals en sí no: llaman a un modelo, no son
deterministas, y un test que falla a veces termina siendo un test que alguien
desactiva.

## Las cinco reglas

1. **sin-fugas** — el texto no tiene llaves, etiquetas, bloques de código ni
   nombres de herramientas. El usuario ve un botón, no una tool call.
2. **keys-que-existen** — todo `key` que se pasa a `selectWizardOption` está
   entre las opciones reales del paso. Un key inventado es un botón que no hace
   nada.
3. **tools-autorizadas** — no se llama una herramienta que ese paso no habilita.
4. **largo-razonable** — es un panel angosto al lado de un formulario, no un
   chat a pantalla completa.
5. **no-contesta-en-silencio** — no aparece un botón sin una línea que explique
   de dónde salió.

La regla 1 es `cleanToolLeaks` dado vuelta. Hoy el front tapa esas fugas con
nueve regex en `OrbiMessages.tsx`: el usuario no las ve, pero tampoco las ve
nadie, así que nunca supimos con qué frecuencia pasan. Acá se cuentan.

## Cómo se mide

El runner **replica el loop del controller**: cuando el modelo llama una tool,
la ejecuta de verdad, le devuelve el resultado y lo deja hablar otra vez. Lo que
se evalúa es el texto acumulado y todas las tool calls de la conversación
completa, o sea lo que termina en pantalla.

Esto no es un detalle. La primera versión medía solo el primer turno, y como con
`gpt-oss-20b` la primera respuesta casi siempre es la tool sola, la regla de
"no contesta en silencio" saltaba en casi todos los casos — fallas que en
pantalla no existen. Una eval que juzga un estado intermedio del pipeline manda
a arreglar prompts que están bien.

## Comparar modelos o configuraciones

El adapter lee estas variables, así que se puede correr la misma tanda contra
otra configuración sin tocar una línea de código:

```bash
ORBI_MODEL=moonshotai/kimi-k2-instruct pnpm test:evals
ORBI_REASONING_EFFORT=medium pnpm test:evals
ORBI_TEMPERATURE=0.1 pnpm test:evals
```

El resumen imprime el desglose **por regla**, que es lo que hace comparables dos
corridas: no interesa tanto cuántas pasaron como en *qué* se equivoca cada
configuración. Un modelo que falla solo en `largo-razonable` está muchísimo
mejor que uno que falla en `keys-que-existen`, aunque el total dé parecido.

Con `--repeticiones` el reporte marca además los casos **inestables**: los que
pasan a veces y a veces no. Un caso que pasa 2 de 3 está peor que uno que falla
siempre — el que falla siempre por lo menos es predecible y se arregla.

## De sintético a real

Los casos de hoy están escritos a mano. El set bueno sale de la tabla
`wizard_ai_turns`, que ya viene guardando preguntas y respuestas reales del
wizard con su `rating` (el pulgar arriba/abajo del panel), el paso, el rubro y
las tools que se dispararon.

El camino, cuando haya volumen:

1. Exportar los turnos con `rating = -1` (pulgar abajo). Son casos de falla ya
   etiquetados por usuarios reales, gratis.
2. Para cada uno, reconstruir el escenario (paso, opciones, formState) y
   agregarlo a `casos.ts` con la expectativa correcta.
3. Sumar una muestra de turnos con pulgar arriba como casos de no-regresión:
   lo que ya funciona tiene que seguir funcionando.

Las reglas de `reglas.ts` no cambian cuando eso pase. Son las mismas para un
caso inventado y para uno real.

## Si esto crece

[promptfoo](https://github.com/promptfoo/promptfoo) da UI, caché y comparación
lado a lado, y es la opción natural el día que esta suite sea más grande. Hoy no
compensa: es una devDependency pesada y el `Dockerfile` del backend instala
todas las dependencias en la etapa de build (recién poda con `pnpm prune --prod`
al final), así que cada deploy pagaría ese peso.

Lo que importa de una suite de evals no es el runner: son los casos y las
reglas. Los dos están en archivos aparte, portables tal cual el día que se
quiera mudar.
