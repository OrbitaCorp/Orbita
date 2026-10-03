// Barrel de hooks de la capa de datos de Turnos. Agrupados por paquete del
// contrato (un archivo por área, un hook por operación):
// - nucleo: configuración, servicios, agendas, turnos, agenda y resumen (P1).
// - equipo: clases, clientes, equipo y roles, ganancias (P3).
// - avanzado: funciones de Avanzado y lista de espera (P4).
// - sitio: sitio público, "mi turno" por enlace y cuenta del cliente (P2 y públicos).
export * from './nucleo'
export * from './equipo'
export * from './avanzado'
export * from './sitio'
