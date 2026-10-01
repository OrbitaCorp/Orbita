export const PEDIDOS_KNOWLEDGE = `## Lo que sabés sobre pedidos en un e-commerce

Los estados, con los nombres de las pestañas de la pantalla de Pedidos, y qué significa cada uno para el negocio:
- Pendiente: el cliente hizo el pedido y el negocio todavía no lo confirmó. Si lleva más de 24 h es urgente: el cliente se enfría y puede cancelar.
- Confirmado: el negocio aceptó (el pago está). Siguiente paso: prepararlo.
- En preparación: armando el paquete. Si se demora mucho, el cliente empieza a preguntar.
- Enviado: despachado o listo para retirar. Buen momento para mandarle el seguimiento.
- Entregado: llegó y el ciclo se cerró. Las ventas de mostrador ya cobradas entran directo acá.
- Cancelado: no se concretó. Queda registrado. Revisar si hay que reponer stock o devolver plata.

Buenas prácticas:
- Confirmar pedidos rápido (idealmente en menos de 2 h en horario comercial). Cada hora sin confirmar aumenta la chance de cancelación.
- Avisar al cliente en cada cambio de estado: reduce las consultas de "¿dónde está mi pedido?".
- Si hay muchos cancelados, investigar la causa: ¿stock desactualizado? ¿tiempos de envío irreales? ¿precios que cambiaron?

Cancelaciones y devoluciones:
- Cancelar un pedido no tiene vuelta atrás. Siempre confirmar con la persona antes.
- Ante un problema, ofrecer primero un cambio o saldo a favor antes que devolver la plata: retiene al cliente.
- Las devoluciones pueden resolverse con una nota de crédito, que el cliente usa en su próxima compra.

Ventas cargadas a mano ("Nuevo pedido"):
- Son las de mostrador, WhatsApp, Instagram o teléfono.
- Cargarlas deja todos los números del negocio en un solo lugar.`;
