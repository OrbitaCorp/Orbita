# Alquileres en la API

Lo propio del módulo Alquileres que **no es una reserva**. Las propiedades, las reservas, los
bloqueos y el calendario de Airbnb son del motor compartido (`src/reservas/`, ver su README). Acá
vive lo que el motor no tiene y solo le sirve a Alquileres, en tablas propias y sin tocar las del
motor, igual que Gimnasio (`src/gimnasio/`).

Hoy: **las ganancias de Airbnb**. El dueño de un alojamiento descarga de Airbnb su archivo de
ganancias (CSV) y lo importa desde el panel. Con eso las Estadísticas cuentan esa plata, esas
noches y esos huéspedes. Diseño: `docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md`.

## Por qué hace falta

El calendario `.ics` de Airbnb trae solo fechas: ni el huésped ni el monto. Airbnb no tiene API
abierta. Lo único que el dueño puede sacar con la plata es ese archivo.

## Reglas

- **Una estadía de Airbnb nunca es una reserva del motor.** Sus noches llegan como bloqueo del
  `.ics`; su plata y su huésped, por acá. Así no se cuenta dos veces.
- **El archivo se lee por nombre de columna**, en inglés o en castellano, nunca por posición
  (`dominio/csv-airbnb.ts`, función pura con sus tests). Airbnb no documenta el formato y el
  anfitrión elige qué columnas baja. Si falta una columna necesaria no se lee nada y se dice cuál.
- **Las filas del mismo código de confirmación se suman**: una reserva pagada en partes, o con un
  ajuste o una devolución, es una sola estadía. Si el neto da cero o menos se guarda igual (para
  que un archivo más nuevo corrija a uno viejo) y las Estadísticas no la cuentan.
- **Importar es todo o nada.** Se valida todo antes de escribir y se escribe en una transacción.
- **Una fila por negocio, canal y código.** Importar dos veces el mismo archivo no duplica; uno
  más nuevo corrige los montos y, si cambió la unión, la propiedad.
- **El servidor no recuerda nada entre la vista previa y la importación.** El panel manda el texto
  las dos veces. No se confía en filas armadas por el navegador.
- **El texto del archivo no se guarda** ni se escribe en ningún registro. En auditoría queda
  cuántas estadías entraron, sin nombres.
- **Las monedas no se mezclan.** Cada fila guarda la suya; quien suma (el panel) suma por moneda.
- Todo filtra por negocio (`businessId` del token). Las propiedades se miran por el catálogo del
  motor, que solo devuelve las del negocio.
- Topes: 2 MB de texto y 5.000 filas.

## Rutas del panel (`/api/v1/alquileres`, token de miembro)

| Ruta | Permiso | Qué hace |
|---|---|---|
| `GET ingresos?desde&hasta` | `reservas.view` | Las estadías importadas que tocan el rango (entran hasta `hasta` y salen después de `desde`) y el resumen de todo lo importado: cuántas, cuándo fue la última importación y hasta qué fecha llegan |
| `POST ingresos/airbnb/vista-previa` `{ texto }` | `reservas.config` | Lee el archivo y devuelve cuántas estadías trae, el rango, el total por moneda, las filas que quedan afuera con su motivo y cada aviso con la propiedad que ya tiene unida. No guarda nada |
| `POST ingresos/airbnb/importar` `{ texto, avisos }` | `reservas.config` | Guarda. `avisos` trae, por cada aviso del archivo, `{ nombre, recursoId }`; `recursoId: null` es "no importarlo". Tienen que venir todos. Devuelve `{ creadas, actualizadas, sinImportar }` |
| `DELETE ingresos/airbnb` | `reservas.config` | Borra todo lo importado de Airbnb. Las uniones de avisos se conservan |

Errores, en castellano y listos para mostrar: 400 si el archivo no se entiende (con el motivo), si
falta decidir un aviso o si la propiedad no es un alojamiento; 404 si la propiedad no es del negocio.

## Tablas

- `alquileres_ingresos_externos`: una fila por estadía cobrada afuera.
- `alquileres_avisos_externos`: a qué propiedad corresponde cada aviso de afuera, por su nombre.

Las dos con RLS. Migración `20261126120000_alquileres_ingresos_externos`.

## Lo que falta confirmar

El formato con Airbnb en castellano. Los nombres de columna en castellano de `dominio/csv-airbnb.ts`
son los más probables, no los vistos en un archivo real: cuando llegue el primero, se ajusta esa
lista (y su test). Si un archivo real no se entiende, la importación lo dice y no guarda nada.
