export const PEDIDOS_KNOWLEDGE = `## Lo que sabés sobre pedidos en un e-commerce

Flujo de estados y qué significa cada uno para el negocio:
- PENDING: el cliente hizo el pedido, el negocio todavía no lo confirmó. Si lleva más de 24h es urgente — el cliente se enfría y puede cancelar.
- CONFIRMED: el negocio aceptó. Siguiente paso: preparar el envío.
- PREPARING: armando el paquete. Si se demora mucho el cliente empieza a preguntar.
- SHIPPED: despachado. El cliente espera la entrega, es buen momento para mandarle el tracking.
- DELIVERED: entregado. Esperando que el cliente confirme que está todo bien.
- COMPLETED: cerrado satisfactoriamente.
- CANCELLED: irreversible. Revisar si hay que reponer stock y/o reembolsar.

Buenas prácticas:
- Confirmar pedidos rápido (idealmente en menos de 2h en horario comercial). Cada hora sin confirmación aumenta la chance de cancelación.
- Notificar al cliente en cada cambio de estado — reduce consultas al chat de "¿dónde está mi pedido?".
- Si hay muchos cancelados, investigar la causa: ¿stock desactualizado? ¿tiempos de envío irreales? ¿precios que cambiaron?

Cancelaciones y devoluciones:
- Cancelar un pedido es irreversible. Siempre confirmar con el usuario antes de hacerlo.
- Ante un problema, ofrecer primero crédito o cambio antes que reembolso — retiene al cliente.
- Las devoluciones generan notas de crédito que se pueden usar en compras futuras.

Pedidos manuales (origen MANUAL):
- Se crean desde el panel para ventas por teléfono, redes sociales o presenciales sin POS.
- Útiles para registrar todo en un solo lugar y mantener las métricas completas.`;
