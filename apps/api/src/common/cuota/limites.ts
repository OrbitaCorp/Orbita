// Topes diarios que comparten más de un módulo. Viven acá y no en el
// controller que los usó primero: product.tools.ts (Orbi) importaba el tope
// desde products.controller.ts, y con eso arrastraba el controller entero
// (decoradores, DTOs, interceptores) a las tools solo por una constante.

// Cada ayuda de IA es una llamada paga al modelo, y solo tenía el throttle de
// 20 por minuto: sin tope por día (auditoría interna 10/09, ítem trans.gasto-ia).
// Mismo criterio que los topes de Orbi: contador compartido en Postgres
// (CuotaService), por negocio; las tres ayudas de products.controller.ts y la
// tool de Orbi que genera contenido suman al mismo `ai-assist:<negocio>`.
export const AI_ASSIST_DIA_NEGOCIO = 100;
