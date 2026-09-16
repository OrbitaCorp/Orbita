# Dominios comprados desde el panel — renovación, transferencia y baja

Hallazgo `dominios-comprados-sin-renovacion` de la auditoría interna.

Cuando un dueño compra un dominio desde Configuración → Dominios, el dominio se
registra **en la cuenta de Vercel de OrbitaCorp**, no en una cuenta del cliente:
Órbita cobra por Mercado Pago (precio de Vercel + margen) y recién ahí llama a
`/v1/registrar/domains/{dominio}/buy` con `autoRenew: false`
(`domain-purchase.service.ts`). De ahí salen las tres preguntas que este
documento contesta: quién lo renueva, qué pasa si el dueño se va, y qué pasa si
no lo renueva nadie.

El titular figura con los datos de contacto (WHOIS) que cargó el dueño en el
wizard de compra, así que **el dominio es suyo**, aunque viva en nuestra cuenta
de registrador.

---

## 1. Renovación — manual, a pedido del dueño

Decisión del 15/09/2026: **no hay renovación automática.** `autoRenew` va en
`false` a propósito — sin un mecanismo de recobro, una renovación automática le
cobraría a Órbita un dominio que después habría que perseguir para cobrar.

Cómo funciona:

1. El cron nocturno (`domain-expiry.service.ts`) le manda al dueño un aviso a
   **30 días** y otro a **7 días** del vencimiento. El mail dice explícitamente
   que la renovación **no es automática** y que hay que pedirla.
2. El dueño escribe a soporte pidiendo renovar.
3. Soporte cobra la renovación aparte, al precio del registrador (más el mismo
   margen que la compra), y la ejecuta en el panel de Vercel de OrbitaCorp.
4. Soporte corre el script que corre la fecha en nuestra base — **si no, el
   aviso nocturno sigue avisando con la fecha vieja**:

   ```bash
   cd apps/api
   node --env-file=.env scripts/dominios/registrar-renovacion.cjs --dominio mitienda.com --hasta 2027-10-15        # muestra qué haría
   node --env-file=.env scripts/dominios/registrar-renovacion.cjs --dominio mitienda.com --hasta 2027-10-15 --si   # lo aplica
   ```

   `--hasta` es la fecha que muestra Vercel después de renovar. La alternativa
   es `--anios N`, que suma años calendario **a la fecha que ya figuraba**, no a
   la de hoy: renovar anticipado no pierde los días que quedaban.

El script solo toca `expires_at` de ese dominio y solo si es `PURCHASED`: el
vencimiento de un dominio propio vinculado (`LINKED`) lo maneja su dueño en su
propio registrador, Órbita no tiene nada que renovar ahí.

---

## 2. Transferencia al dueño — cuando se va o cuando la pide

Un dueño puede querer llevarse el dominio a su propia cuenta, sea porque se da
de baja de Órbita o simplemente porque quiere administrarlo él. **Siempre se le
entrega**: es suyo, lo pagó y figura como titular.

Se hace por soporte, a mano: no hay endpoint de transferencia en el panel (ni
lo va a haber mientras sea una operación de a una por mes — es un trámite del
registrador, con plazos del registro, no algo que se pueda automatizar sin
riesgo de dejar un dominio a mitad de camino).

**Procedimiento:**

1. **Verificar quién pide.** El pedido tiene que venir del **owner** del negocio,
   desde el email de la cuenta. Si llega de otro miembro, se le pide al owner
   que lo confirme. Es la única defensa real contra que alguien se lleve el
   dominio de otro.
2. **Avisar qué implica**, por escrito, antes de arrancar:
   - La tienda deja de responder en ese dominio apenas el DNS apunte a otro
     lado; el subdominio `*.orbita.site` sigue funcionando siempre.
   - El registro de transferencia **suma un año** al vencimiento y lo cobra el
     registrador nuevo (regla de ICANN para gTLDs).
   - Los primeros **60 días** después de comprar o de un cambio de titular, el
     registro no deja transferir. Si está dentro de esa ventana, se le da la
     fecha a partir de la cual se puede.
3. **Destrabar el dominio en Vercel** (OrbitaCorp → Domains → el dominio):
   sacar el *transfer lock* y pedir el **código de autorización** (auth code /
   EPP code).
4. **Mandarle el código al dueño**, a la dirección de email del owner de la
   cuenta y a ninguna otra. El código es de un solo uso y alcanza para llevarse
   el dominio: no se pega en un ticket público, en el chat de soporte de la
   tienda ni en Jira.
5. **El dueño inicia la transferencia** en el registrador que elija, con ese
   código. Suele tardar entre 5 y 7 días; el registro le manda un mail de
   confirmación al contacto del WHOIS (que es él).
6. **Cuando la transferencia se completa**, desvincular el dominio de Órbita
   desde Configuración → Dominios → Quitar (o el super admin, si la cuenta ya no
   existe). Eso borra la fila de `custom_domains` y saca el dominio del proyecto
   de Vercel de Órbita, así no queda un vencimiento fantasma avisando por mail.
7. **Queda registrado**: quitar el dominio escribe en `audit_logs`
   (`entityType: 'domain'`), así que la baja se ve en Configuración → Registro
   de actividad.

**Si el dueño no quiere el dominio** al darse de baja, se lo deja vencer: no se
renueva nada y el registro lo libera solo al final del período de gracia. No se
reutiliza ni se revende un dominio con el WHOIS de otra persona.

---

## 3. Si no lo renueva nadie

Vencido el plazo, el registrador lo suspende y después lo libera. Del lado de
Órbita:

- El dominio **no** cambia de estado en nuestra base: el cron solo avisa, y
  pasarlo a `EXPIRED` lo sacaría del CORS de la API (`main.ts` solo acepta los
  `ACTIVE`) aunque en realidad se hubiera renovado y lo que estuviera vieja
  fuera nuestra fecha. Un dominio vencido de verdad deja de resolver solo.
- La tienda vuelve a responder solo por su subdominio de Órbita. **Nadie pierde
  la tienda por un dominio vencido** — es lo único que este diseño tiene que
  garantizar.
- El aviso nocturno no insiste después del vencimiento: los dos mails (30 y 7
  días) son todo lo que manda, y solo al owner.

---

Ver también: `apps/api/src/domains/` (servicios), `apps/api/DEPLOYMENT.md`
§ Actualizar secrets (el token de Vercel), y Configuración → Dominios en el
panel.
