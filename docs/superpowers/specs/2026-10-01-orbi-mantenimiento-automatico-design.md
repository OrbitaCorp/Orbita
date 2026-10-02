# Orbi — Mantenimiento automático y errores con causa

**Fecha:** 2026-10-01
**Estado:** Implementado en la rama `feat/orbi-mantenimiento` (sobre `claude/awesome-cannon-s749lf`), **sin mergear ni desplegar**. Necesita una migración en producción (§7).
**Motivo:** el 2026-10-01 las evals se toparon con `402: prepayment credits are depleted` de Gemini. Si eso pasa en producción, hoy todo Orbi muestra "Error procesando tu mensaje", nadie se entera y cada intento de un cliente es otro error. Se pidió: que cuando falle de forma constante Orbi se ponga en mantenimiento general hasta que un admin lo rehabilite, con alertas por mail a los administradores, y que no aparezca solo "error al procesar".

---

## 1. Qué hace

1. **Clasifica cada falla** de una llamada de Orbi (panel y wizard): saldo agotado, key inválida, modelo inexistente, cuota, caída del proveedor, request inválido, error propio.
2. **Apaga Orbi para todos** (panel y wizard) en dos casos, y **solo un admin lo vuelve a encender** (§3).
3. **Avisa por mail** a todos los admins de plataforma activos al apagarse, y recuerda cada 24 h mientras siga apagado.
4. **Le dice a la persona qué pasa**: un aviso de mantenimiento (503) o "tuvo un problema, probá en unos minutos". Nunca el error crudo del proveedor.
5. **Panel de plataforma**, pestaña "Orbi": estado, motivo, desde cuándo, últimas fallas, "Rehabilitar" y "Poner en mantenimiento". Pastilla en el sidebar cuando está apagado.

## 2. Decisiones

| Decisión | Por qué | Costo si estuviera mal |
|---|---|---|
| **Estado en la base** (fila global), no en memoria | Cloud Run escala a 0 y puede haber varias instancias: un contador en memoria no ve lo que ven las otras | Una lectura por pedido; se cachea 15 s por instancia, así que tras rehabilitar o apagar hay hasta 15 s de desfase |
| **Fail-open**: si la base falla, Orbi sigue | Medir la salud no puede romper lo que mide | Con la base caída no se apaga solo, pero con la base caída el resto del producto tampoco anda |
| **Apagado inmediato** solo para 402 / 401 / 403 / 404-con-texto-de-modelo / key sin configurar | No se arreglan solas ni con reintentos: mientras duren, toda llamada falla igual | Un 403 transitorio de Google (si existiera) apagaría Orbi de más; se rehabilita en un click |
| **Apagado por racha** para el resto (≥5 fallas, ≥2 actores, 10 min, **sin una sola respuesta buena en el medio**) | Una respuesta buena corta la racha: con tráfico, un 1 % de errores no lo apaga nunca. Dos actores: una cuenta rota no apaga a todos | Con poco tráfico una caída parcial (la mitad de los pedidos falla) no lo apaga. Es lo que se pidió ("de manera constante") |
| **Una persona sola** necesita 12 fallas (no 5) | Evita que un negocio con un contexto problemático apague Orbi, pero no deja pasar una caída con un solo usuario activo | — |
| **No se enciende solo** | Pedido explícito. Además evita el ping-pong apaga/enciende | Si el problema se resuelve a las 3 am, Orbi sigue apagado hasta que alguien entre |
| **Rehabilitar = llamada de prueba real** | Reabrir con el proveedor todavía caído es volver a mostrarle el error a los clientes | La prueba cuesta fracciones de centavo y usa el mismo adaptador (con fallback a Groq si está configurado) que el chat |
| **Recordatorio sin cron** | Un Cloud Scheduler más es infraestructura manual. Lo dispara el primer pedido que llegue pasadas 24 h | Si nadie usa Orbi, no hay recordatorio. Con la regla de "nadie lo usa" tampoco hay a quién molestar |
| **Mail a todos los admins activos** (SUPERADMIN y OPERATOR) | Quien recibe el aviso tiene que poder actuar: los dos roles pueden rehabilitar | Más destinatarios que si fuera solo SUPERADMIN |
| **Una tabla de fallas sin texto de personas** (`orbi_provider_failures`) | Alimenta el umbral y el detalle del mail. El `actor` es el `businessId` o una IP hasheada | Se purga a los 30 días (retención de logs) |

## 3. Cuándo se apaga

```
falla de una llamada de Orbi  ──▶  clasificarError()
      │
      ├─ inmediata (402, 401/403, 404 de modelo, key sin configurar)  ──▶  APAGAR
      │
      └─ resto: se guarda en orbi_provider_failures
              contar las fallas desde max(hace 10 min, última respuesta buena)
              ≥ 5 y ≥ 2 actores distintos, o ≥ 12 de uno solo  ──▶  APAGAR
```

- Un 404 con el mensaje **vacío** no es "el modelo no existe": es Google escupiendo en un pico de demanda (ver `llm-errors.ts`). Cuenta como caída, no como apagado inmediato.
- Que el cliente cierre la conexión a mitad de respuesta no es una falla.
- La transición `ACTIVE → MAINTENANCE` es un `updateMany` condicionado: con varias instancias fallando a la vez, **una sola** gana y manda los mails.

## 4. Qué ve la persona

| Situación | Panel | Alta de negocios (wizard) |
|---|---|---|
| Orbi apagado | 503 antes de abrir el stream, `error: 'ORBI_MAINTENANCE'`: "Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo. Mientras tanto, el Manual del panel sigue disponible." | Igual, y "Podés seguir completando los pasos sin su ayuda." |
| Una falla suelta | Evento SSE `error` con `code: 'ORBI_PROVIDER_DOWN'` u `'ORBI_ERROR'` y "Orbi tuvo un problema para responder. Probá de nuevo en unos minutos." | Ídem |

El chequeo va **antes de la cuota diaria**: un mensaje que no se va a atender no gasta el cupo. El front ya mostraba `message` de las respuestas no-OK, así que no cambió el chat. (El filtro global de excepciones reescribe el cuerpo como `{ error, statusCode, message }`; por eso el código viaja en `error`, no en `code`.)

## 5. Piezas

| Archivo | Qué es |
|---|---|
| `apps/api/src/orbi/salud/clasificar-error.ts` | Clasificador puro: desenvuelve el JSON-dentro-de-JSON del SDK de Gemini, saca claves del detalle, decide `inmediata` |
| `apps/api/src/orbi/salud/orbi-salud.service.ts` | Estado (cache 15 s), registro de fallas y respuestas buenas, umbrales, activar / sondear / rehabilitar, mails y recordatorio |
| `apps/api/src/orbi/salud/orbi-salud.module.ts` | Módulo propio: lo usan `OrbiModule` (chat) y `PlatformModule` (admin) sin importarse entre sí |
| `apps/api/src/orbi/orbi.controller.ts` | Chequeo previo, `registrarOk` y `registrarFalla` en `chat` y `chat/wizard` |
| `apps/api/src/platform/orbi-salud.controller.ts` | `GET /platform/orbi/estado`, `POST /platform/orbi/rehabilitar`, `POST /platform/orbi/mantenimiento` (ambos roles de admin; se registra en `platform_admin_logs`) |
| `apps/api/src/mail/templates/orbi-mantenimiento.hbs` + `sendOrbiMantenimiento` | Mail de plataforma (branding de Órbita), con previsualización en la pestaña Emails |
| `apps/api/prisma/migrations/20261001170000_orbi_mantenimiento/` | Tablas `orbi_service_state` y `orbi_provider_failures`, con RLS |
| `apps/api/src/internal-cron/retencion-logs.service.ts` | Purga de `orbi_provider_failures` a los 30 días (`ORBI_PROVIDER_FAILURES_RETENTION_DAYS`) |
| `apps/web/src/modules/superadmin/Orbi.tsx` | Pestaña "Orbi" del superadmin |
| `apps/api/test/unit/orbi-salud.unit-spec.ts` | 23 tests: clasificador, umbrales, carrera entre instancias, rehabilitar con sonda, recordatorio, fail-open |

## 6. Lo que NO cubre (a propósito)

- **La IA de productos** ("Redactar con Orbi", `ProductAiService`) y los textos de Orbi fuera del chat usan el mismo proveedor pero **no** pasan por este circuito: si Gemini cae, ahí sigue el error de siempre. Sumarla es meterle `registrarFalla` / `registrarOk` en el mismo lugar.
- **Confirmar o cancelar una acción** ya propuesta (`/orbi/confirm`, `/orbi/reject`) no usa el modelo y sigue funcionando en mantenimiento: no hay razón para trabar a alguien que ya tiene una tarjeta en pantalla.
- **Una caída parcial** (parte de los pedidos falla) no apaga Orbi. Hoy el fallback a Groq, si `GROQ_API_KEY` está configurada, absorbe 429/5xx antes de llegar acá.
- **Alertas por otro canal** (Slack, push). Solo mail.

## 7. Cómo llevarlo a producción (lo hace una persona, en este orden)

1. Merge a `main` con CI verde.
2. **Migración en producción** (aditiva, solo tablas nuevas: `./deploy/prisma-prod.sh migrate deploy` y `migrate status`). Hasta que no esté aplicada, el servicio **no rompe**: toda lectura/escritura de salud es best-effort y cae a "activo", pero el log va a mostrar `No se pudo leer el estado de Orbi`. `deploy.sh` exige la migración aplicada antes de desplegar.
3. `./deploy/deploy.sh` (la API; el web sale solo por Vercel).
4. Probarlo: en la pestaña Orbi, "Poner en mantenimiento", ver el mail, abrir Orbi en un negocio (tiene que mostrar el aviso) y "Rehabilitar".
5. **Rollback:** código, mover el tráfico a la revisión anterior. Las tablas nuevas se pueden dejar. Si Orbi quedó apagado en la base y el código viejo no sabe leerlo, no pasa nada: el código viejo no mira esa fila.

## 8. Verificación hecha y pendiente

- Hecho: typecheck API y web; tests unitarios de salud (23), de retención, de RLS y del controller; web 271.
- **No hecho:** la migración **no se aplicó ni en dev** (la sesión no tenía acceso a la base); el e2e contra Postgres; ver la pestaña en un navegador; el mail real por Resend. Todo eso es de quien lo despliegue.
