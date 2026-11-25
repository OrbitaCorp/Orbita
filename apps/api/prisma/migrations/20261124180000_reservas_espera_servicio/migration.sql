-- El servicio que eligió quien espera un turno (Turnos). En Turnos la duración
-- y el precio de un turno salen del servicio: sin guardarlo, anotarse en la
-- espera fallaba siempre ("Elegí un servicio.") y, al darle el lugar a alguien,
-- la reserva salía con el precio del recurso (0 en Turnos). Opcional y sin
-- default: Gimnasio y Alquileres no lo usan y nada de lo que ya existe cambia.
ALTER TABLE "reservas_espera" ADD COLUMN "servicio_id" TEXT;
