# Evals de Orbi (wizard)

Mide si Orbi responde bien, en vez de leer tres respuestas a ojo y decidir por
sensación. Es la herramienta para contestar "¿este cambio de prompt mejoró algo?"
con un número en lugar de una impresión.

```bash
pnpm test:evals                          # los 17 casos
pnpm test:evals -- --caso=ubicacion      # solo los que matcheen
pnpm test:evals -- --repeticiones=3      # cada caso N veces (el modelo no es determinista)
```

Necesita `GROQ_API_KEY` en `apps/api/.env`. **Llama a la API de verdad**: cuesta
(centavos) y tarda unos minutos. Por eso no está en el CI.

## Cómo está armado

| Archivo | Qué es |
|---|---|
| `casos.ts` | Los escenarios: paso, rubro, opciones reales, estado del formulario, historial y mensaje. |
| `reglas.ts` | Qué tiene que cumplir una respuesta. Sin LLM juez: todo determinista. |
| `run.ts` | Arma el prompt con el código real, llama a Groq, aplica las reglas e imprime. |
| `../unit/orbi-evals-reglas.unit-spec.ts` | Testea las reglas. **Esto sí lo corre el CI.** |

El runner usa las piezas de producción — `ContextBuilderService`, `ToolRegistryService`
y `GroqAdapter` — no una copia. Si cambiás un prompt o el gating de una tool, la
eval lo ve sin tocar nada acá.

Cada caso se corre como **un solo turno**: se mide qué dijo el modelo y qué quiso
llamar. No se ejecutan las tools ni se hace el ida y vuelta completo del
controller, porque lo que se está evaluando es la decisión del modelo.

## Las reglas

| Regla | Qué caza |
|---|---|
| `sin-fugas` | JSON, etiquetas, bloques de código o nombres de función en el texto visible. Es `cleanToolLeaks` (OrbiMessages.tsx) convertido en medición: el front tapa esas fugas con nueve regex, así que nadie sabía la tasa real. |
| `keys-que-existen` | Un `selectWizardOption` con un key que no está en las opciones del paso. Es el bug más caro: el usuario hace clic y no pasa nada. |
| `tools-autorizadas` | Una tool que ese paso no habilita. El registry la rechaza en `execute()` y el usuario ve a Orbi fallar sin explicación. |
| `largo-razonable` | Parrafadas. Es un panel angosto al lado de un formulario. |
| `no-contesta-en-silencio` | Llamar una tool sin escribir una palabra: un botón suelto, sin contexto de dónde salió. |

Además cada caso puede declarar expectativas propias (`debe-llamar`,
`keys-exactas`, `cantidad-de-llamadas`, …). Se declaran en `casos.ts` para que el
archivo se lea como una tabla de "situación → qué esperamos" y no como cien
funciones parecidas.

## Comparar modelos y parámetros

El adapter lee modelo, temperatura y razonamiento del entorno, así que la misma
suite sirve de banco de pruebas:

```bash
ORBI_MODEL=openai/gpt-oss-120b pnpm test:evals
ORBI_REASONING_EFFORT=medium pnpm test:evals
ORBI_TEMPERATURE=0.1 pnpm test:evals
```

Lo que importa del reporte no es tanto el "X/17" como el **desglose por regla**:
dice en QUÉ se equivoca cada configuración, que es lo que permite decidir.

## Los casos son sintéticos (por ahora)

Están escritos a mano. La tabla `wizardAiTurn` ya guarda preguntas reales con
`rating`, `toolsUsed` y `stepName`: cuando haya volumen conviene reemplazar buena
parte de esto por casos de tráfico real — sobre todo los que tienen pulgar abajo,
que vienen etiquetados gratis. Las reglas no cambian cuando eso pase.

## Por qué no promptfoo

Sigue siendo la opción natural si esto crece (UI, caché, comparación lado a lado).
Hoy no compensa: es una devDependency pesada y el Dockerfile instala todas las
dependencias en la etapa de build antes de podar con `pnpm prune --prod`, así que
cada deploy del backend pagaría ese peso. Lo valioso de una suite de evals no es
el runner sino los casos y las reglas, y los dos viven en archivos aparte,
portables tal cual el día que se quiera migrar.
