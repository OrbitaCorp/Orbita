# Borrador: cláusulas nuevas para los Términos de Órbita

**Estado: BORRADOR para revisión legal. No está publicado.** Los Términos vigentes
(actualización del 16 de septiembre de 2026) viven en
`apps/web/src/modules/landing/components/ui/LegalModal.tsx` (`LEGAL_CONTENT.terminos`).
Nada de lo de abajo está en el sitio todavía.

## Por qué hace falta

Desde octubre de 2026 las tiendas pueden aparecer en Google y en un directorio público
(`orbita.site/tiendas`), y cualquier visitante puede **denunciar** una tienda desde el pie
(`Denunciar esta tienda`). El equipo de Órbita puede ocultar una tienda de los buscadores y
del directorio sin suspenderla.

Hoy los Términos ya cubren lo esencial:

- **Cláusula 2:** Órbita es un proveedor de tecnología; el Comercio es el único responsable de
  lo que publica y de cumplir la normativa que le aplique.
- **Cláusula 5:** Órbita no resuelve disputas entre el Comercio y sus clientes.
- **Cláusula 10 (último párrafo):** Órbita puede suspender o dar de baja una cuenta ante
  incumplimientos graves, uso fraudulento o incumplimiento reiterado de la normativa de
  defensa del consumidor, "previa notificación cuando sea razonablemente posible".

**Lo que no dicen** (y estas cláusulas agregan):

1. Que la tienda puede aparecer en buscadores y en el directorio de Órbita.
2. Qué contenido está prohibido.
3. Cómo se denuncia y qué puede hacer Órbita mientras revisa una denuncia (incluida una
   medida menos drástica que suspender).

---

## Propuesta A — agregar al final de la cláusula 2 (Naturaleza del servicio)

> • **Visibilidad.** La tienda del Comercio es pública: cualquier persona puede entrar a ella,
> y puede aparecer en los resultados de buscadores (como Google) y en el directorio de tiendas
> de Órbita (orbita.site/tiendas), que muestra el nombre, el logo, la descripción y el enlace de
> la tienda. Órbita puede decidir qué tiendas incluye en ese directorio y retirar una tienda de él,
> o pedirle a los buscadores que no la muestren, en cualquier momento.

## Propuesta B — nueva cláusula (sugerida como "5 bis. Contenido permitido")

> **Contenido permitido.** El Comercio se compromete a no publicar ni ofrecer a través de su
> tienda:
>
> • Productos o servicios cuya venta esté prohibida o restringida por la ley argentina, o para
> los que no cuente con la habilitación que la ley exija.
> • Productos falsificados, o que usen sin autorización marcas, nombres, logos u otros signos
> distintivos de terceros, o que induzcan a error sobre su origen.
> • Publicidad engañosa, o precios, condiciones o disponibilidad que no se correspondan con la
> realidad.
> • Contenido que vulnere derechos de propiedad intelectual de terceros, o datos personales de
> terceros sin su consentimiento.
> • Cualquier otro contenido cuya publicación esté prohibida por la ley.
>
> El Comercio no puede usar un nombre de tienda, dirección (subdominio) o dominio que imite o se
> confunda con la marca de un tercero.

## Propuesta C — nueva cláusula (sugerida como "5 ter. Denuncias y medidas")

> **Denuncias y medidas.** Cualquier persona puede denunciar una tienda desde el enlace
> "Denunciar esta tienda" que figura en su pie de página, o escribiendo a soporte@orbita.site.
> Órbita revisará la denuncia y, si lo considera necesario, podrá pedirle información al Comercio.
>
> Mientras revisa una denuncia, o cuando haya indicios razonables de que el contenido infringe
> estos Términos o la ley, Órbita podrá, según la gravedad del caso y sin necesidad de aviso
> previo cuando sea urgente:
>
> • retirar la tienda del directorio de Órbita y pedir a los buscadores que no la muestren,
> manteniéndola en línea;
> • retirar o desactivar el contenido específico que infrinja;
> • suspender la tienda o dar de baja la cuenta, conforme a la sección 10.
>
> Órbita notificará su decisión al Comercio cuando sea razonablemente posible y le dará la
> oportunidad de responder. Órbita no está obligada a revisar el contenido de las tiendas de
> manera previa o general, ni asume responsabilidad por el contenido que publican los Comercios,
> sin perjuicio de actuar conforme a esta cláusula y a la ley cuando tome conocimiento de una
> infracción.
>
> Cuando un tercero sostenga que el contenido de una tienda vulnera sus derechos (por ejemplo,
> el uso de su marca), puede enviar a soporte@orbita.site: sus datos, la tienda y el contenido
> en cuestión, la descripción del derecho que invoca y una declaración de buena fe.

## Propuesta D — ajuste a la cláusula 10 (Baja de la cuenta)

Agregar a la lista de causas del último párrafo: *"…o publicación de contenido prohibido según
la cláusula 5 bis."* y reemplazar "previa notificación cuando sea razonablemente posible" por
*"previa notificación cuando sea razonablemente posible, salvo que la urgencia o la gravedad del
caso justifique actuar antes"*.

---

## Para quien lo revise

- **Responsabilidad del intermediario.** El borrador sigue la lógica que ya tienen los Términos
  (Órbita como proveedor de tecnología, sin control previo, que actúa al tomar conocimiento). Si
  corresponde un procedimiento de notificación más formal (por ejemplo para reclamos de marcas,
  Ley 22.362) o que la medida requiera orden judicial en ciertos casos, hay que ajustar la
  propuesta C. **No lo evalué jurídicamente.**
- **Política de Privacidad.** Revisar si hay que mencionar que el nombre, logo y descripción de la
  tienda se publican en el directorio, y qué pasa con los datos de quien denuncia (nombre y
  email, que se usan solo para responderle).
- **Cómo se publica.** La cláusula 11 dice que los cambios se notifican "con antelación razonable".
  Al publicar: actualizar la fecha de `LEGAL_CONTENT.terminos`, avisar por mail a los comercios
  activos, y definir desde cuándo rige.

## Lo que el sistema ya hace (para que el texto coincida)

| Qué | Dónde |
|---|---|
| Directorio automático de tiendas | `orbita.site/tiendas`: solo tiendas publicadas, en línea, con al menos 3 productos con foto y precio y de más de 48 h |
| Denunciar una tienda | Link en el pie de toda tienda → llega a la bandeja de soporte del superadmin y por mail a soporte@orbita.site |
| Ocultar de Google y del directorio sin suspender | Superadmin → Negocio → "Ocultar de Google y del directorio" (queda en el log de auditoría con el motivo) |
| Suspender / dar de baja | Superadmin → Negocio → "Suspender negocio" |
| Una denuncia no baja una tienda sola | La decide una persona del equipo |
