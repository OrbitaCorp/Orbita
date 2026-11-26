# Alquileres: estadísticas de la estadía y ganancias de Airbnb (diseño)

Etapa 5 del plan `docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md`. Baja a tierra
los puntos 7.2 y 7.6 del diseño del 18/11
(`docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md`), que Alan ya aprobó.
Lo que este documento agrega son las decisiones que aquel dejó abiertas. Todas son de Claude, con
la delegación de Alan ("decidí con tus recomendaciones; preguntame solo lo muy crítico").

## Para qué

El dueño chico (cabañas, departamentos) quiere ver en un solo lugar cómo le va: cuánto ocupó,
cuánto le entró y por dónde. Hoy la pantalla "Ingresos" solo cuenta lo que se reservó en Órbita.
Lo de Airbnb llega por el calendario como fechas sin plata ni huésped, y además se pierde: el
`.ics` de Airbnb solo trae lo que viene, así que una estadía que ya pasó desaparece de los
bloqueos en la sincronización siguiente. Sin las ganancias de Airbnb, los números de un dueño que
alquila sobre todo por ahí quedan a la mitad.

## Qué se quiere

- Que el dueño suba el archivo de ganancias que descarga de Airbnb y esa plata, esas noches y
  esos huéspedes entren a sus números.
- Que "Ingresos" pase a ser "Estadísticas" en la estadía: ocupación, ingresos por canal, precio
  promedio por noche, ingreso por noche disponible, estadía promedio y anticipación, por
  propiedad y en total, contra el período anterior.

## Qué no

- No es contabilidad: no hay impuestos, facturas ni conciliación con el banco.
- No se convierte moneda. Lo que Airbnb pagó en dólares se muestra en dólares, aparte.
- No se cargan estadías de Airbnb a mano como reservas (decisión del 18/11).
- No se tocan canchas ni salones: siguen con su pantalla de Ingresos.
- No entra Google Maps ni la seña con Mercado Pago (son otras etapas).
- No se guarda el archivo: se lee, se guarda lo que importa y se descarta.

## Lo que haría de esto un fracaso aunque ande

- Que la plata se cuente dos veces (la misma estadía por el archivo y por una reserva), o que
  importar dos veces el mismo archivo duplique.
- Que importar el archivo de otro período pise lo que ya estaba de una estadía (una cuota en cada
  archivo, o un ajuste que llega al año siguiente).
- Que se sumen pesos con dólares en un mismo total.
- Que un archivo con otro formato se importe "más o menos" sin avisar: si no se entiende, se dice
  qué falta y no se guarda nada.
- Que un número aparezca sin que se sepa de dónde sale (cada uno dice qué cuenta).

## Lo que se sabe del archivo de Airbnb (y lo que no)

Airbnb no documenta el formato. De su ayuda y de anfitriones que lo publicaron:

- Se descarga desde Ingresos (o "Historial de transacciones") como CSV, con columnas que el
  anfitrión puede elegir.
- Un encabezado visto en la comunidad:
  `Date,Type,Confirmation Code,Start Date,Nights,Guest,Listing,Details,Reference,Currency,Amount,Paid Out,Host Fee,Cleaning Fee`.
  Versiones más nuevas suman, entre otras, `Gross Earnings` y `End Date`.
- Hay filas de varios tipos: la reserva (`Reservation`), la transferencia al banco (`Payout`) y
  ajustes. Las de reserva traen código, inicio, noches, huésped, aviso y montos.
- Las fechas vienen como mes/día/año, y hay quejas de formatos mezclados.
- Algunas descargas salen sin encabezado o sin la fecha de inicio.
- **No se sabe:** cómo salen los encabezados con Airbnb en español, ni el separador decimal de un
  anfitrión argentino. Hace falta un archivo real; Alan es quien puede conseguirlo.

De ahí sale la regla de lectura: **por nombre de columna, nunca por posición**, con los nombres
conocidos en inglés y en castellano, y negarse con un mensaje claro cuando falta algo necesario.

## Caminos considerados

**1. El navegador lee el archivo y manda las filas ya armadas.** Vista previa instantánea y sin
subir nada. Pero la lectura quedaría en el front (dos lugares que tienen que entender el
formato si mañana se importa por otra vía) y el servidor tendría que confiar en filas que
cualquiera puede editar antes de mandarlas.

**2. El servidor lee el texto del archivo, dos veces (elegido).** El navegador solo abre el
archivo como texto y lo manda. Un pedido devuelve la vista previa; el otro, con el mismo texto y
la unión de avisos con propiedades, guarda. El servidor no recuerda nada entre los dos y no
confía en nada que venga armado. La lectura es una función pura con sus tests, igual que la del
`.ics`. Cuesta mandar el texto dos veces (son pocos KB).

**3. Estadísticas calculadas en el servidor.** Un pedido que devuelve los números ya hechos.
Serviría para períodos largos, pero hoy el panel ya tiene cargado medio año para atrás y medio
para adelante, la pantalla actual calcula ahí, y los períodos que se ofrecen (este mes, el
pasado, tres meses) entran. Se descarta por ahora: sería un segundo lugar con las mismas reglas.

Se va con el 2 para importar y con las cuentas en el panel (una función pura, con tests) para las
estadísticas.

## Cómo queda

### Dónde vive

Es de Alquileres, no del motor compartido: módulo nuevo `apps/api/src/alquileres/`, al lado del
motor, como hizo Gimnasio con `apps/api/src/gimnasio/`. Usa el catálogo del motor para validar que
una propiedad es del negocio; no toca sus tablas ni sus reglas. Mateo y Ale no tienen que cambiar
nada; se les avisa porque hay una migración.

### Dos tablas nuevas (una migración, con RLS)

- `alquileres_ingresos_externos`: una fila por estadía cobrada afuera. `business_id`,
  `recurso_id`, `canal` (hoy solo `airbnb`), `codigo_externo` (el código de confirmación),
  `entrada`, `salida`, `noches`, `huesped`, `monto_bruto`, `comision`, `limpieza`, `monto_neto`,
  `moneda`, `importado_en`. Única por negocio, canal y código. Guarda también `aviso` (de qué
  aviso vino) y `movimientos`: las filas del archivo que la forman, cada una con su clave. Los
  montos son la suma de sus movimientos.
- `alquileres_avisos_externos`: la unión guardada entre el nombre de un aviso de Airbnb y una
  propiedad. `business_id`, `canal`, `nombre_externo`, `recurso_id`. Única por negocio, canal y
  nombre.

### Leer el archivo (función pura)

- Detecta el separador (coma o punto y coma), acepta comillas, saltos de línea dentro de comillas
  y la marca de inicio de archivo.
- Reconoce cada columna por su encabezado, sin importar mayúsculas, acentos ni orden, con una
  lista de nombres por columna en inglés y en castellano.
- Una fila es de una estadía si tiene código de confirmación y fecha de inicio, diga lo que diga
  su tipo: así un ajuste o una devolución de esa reserva se suma a ella. Las demás
  (transferencias al banco) se cuentan y se informan, no se importan.
- Necesarias: código, fecha de inicio, noches (o fecha de fin), aviso, monto y moneda. Si falta
  alguna columna necesaria, no se importa nada y se dice cuál falta.
- Fechas: el orden (mes/día o día/mes) se decide una vez para todo el archivo, mirando todas
  sus columnas de fecha, también la del pago: si alguna tiene un primer número mayor que 12, es
  día/mes; si alguna tiene un segundo número mayor que 12, es mes/día. Si ninguna lo define, un
  archivo con encabezados en castellano se lee día/mes y uno en inglés, mes/día. La vista previa
  muestra el rango de fechas leído para que el dueño lo vea antes de guardar. Una fecha que no se
  entiende deja esa fila afuera, con su motivo.
- Montos: con o sin símbolo, con coma o punto decimal; negativos entre paréntesis o con signo.
- Plata de cada fila: `monto_neto` es lo que le quedó al anfitrión por esa reserva (la columna
  Amount). `comision` es la tarifa de servicio. `monto_bruto` es la columna de ganancias brutas si
  viene; si no, neto más comisión.
- El archivo es un historial de movimientos. Cada fila con código es un **movimiento** de esa
  estadía (el pago, otra cuota, un ajuste, una devolución) y lleva una clave que sale de lo que
  dice la fila: la fecha del pago, el tipo y los montos. La estadía es la suma de sus
  movimientos. Si el neto da cero o menos (una devolución total) se guarda igual y las
  estadísticas no la cuentan: ni su plata ni sus noches.
- Un movimiento de una estadía que no está en el archivo (un ajuste suelto) se suma a la que ya
  esté importada con ese código; si no hay ninguna, no se guarda.
- Topes: 2 MB de texto y 5.000 filas. Más que eso se rechaza.

### Importar (dos pasos, el servidor no recuerda nada entre uno y otro)

1. **Vista previa.** El panel manda el texto. Vuelve: cuántas estadías se leyeron, el rango de
   fechas, el total por moneda, las filas que quedaron afuera con su motivo, y la lista de avisos
   con la propiedad que ya tienen unida, si la tienen.
2. **Guardar.** El panel manda el mismo texto y, por cada aviso, una propiedad o "no importar".
   Se guarda la unión y, por cada estadía, **se juntan sus movimientos con los que ya tenía, por
   su clave**. Importar dos veces el mismo archivo no duplica. Importar el de otro período suma
   lo que trae de nuevo sin pisar lo anterior, en cualquier orden. Airbnb da el historial por
   período, y una estadía puede quedar repartida en dos archivos. Si cambia la unión de un aviso,
   sus estadías de archivos anteriores se mudan con ella.

   Lo que esto no resuelve: una fila que Airbnb cambie de un archivo a otro (el mismo pago con
   otro monto) se contaría como dos movimientos. En el historial de lo ya pagado no debería pasar;
   si pasa, se borra lo importado y se vuelve a importar.

Solo quien puede configurar reservas importa o borra. Quien puede ver reservas ve lo importado.
Hay un "Borrar todo lo importado de Airbnb", con confirmación, por si se subió un archivo
equivocado. Las uniones de avisos se conservan.

### Las noches de Airbnb que ya pasaron se conservan

Hoy cada sincronización borra todos los bloqueos del calendario y crea los que trae el archivo,
y Airbnb deja de publicar una estadía cuando termina: al día siguiente de la salida, esas noches
desaparecen. Con eso la ocupación bajaría sola entre una importación y la siguiente.

Cambio en la sincronización (`apps/api/src/reservas/calendarios/`, que es del motor pero solo
corre en alojamientos con Airbnb conectado): al reemplazar, se borran los bloqueos del calendario
**que todavía no terminaron** y los que vuelven a venir en el archivo. Los que ya terminaron y
Airbnb dejó de publicar quedan como historia. Desconectar el calendario los sigue borrando
todos, como ahora.

Así la ocupación de Airbnb se sostiene desde el día en que se conectó el calendario. El archivo
de ganancias suma la plata, el huésped y lo anterior a esa conexión.

### Que nada se cuente dos veces

Las noches ocupadas de una propiedad son un **conjunto de noches**: las de sus reservas
confirmadas o realizadas, las de los bloqueos de Airbnb que allá son una reserva, y las de las
estadías importadas con neto mayor que cero. Una noche que aparece por dos lados cuenta una vez.

La plata no se superpone por diseño: una estadía de Airbnb nunca es una reserva de Órbita. Si una
estadía importada pisa noches de una reserva propia confirmada de la misma propiedad, es un cruce
real (una doble reserva o un archivo unido a la propiedad equivocada): la pantalla lo avisa con
el código y las fechas, y no descuenta nada sola.

### Estadísticas (solo estadía; el menú dice "Estadísticas" en lugar de "Ingresos")

Por período (este mes, mes pasado, últimos tres meses) y contra el período anterior del mismo
largo. Sin datos antes, no se inventa un porcentaje (regla que ya cumple la pantalla).

**Todo se mide por noches, y sobre el mismo tramo: del inicio del período hasta hoy.** La plata
de una estadía se reparte entre sus noches, así una que cruza el borde del período aporta solo
la parte que le toca. Sin esto, el tercer día del mes el ingreso por noche disponible saldría
inflado (toda la plata del mes sobre tres noches).

- **Ocupación:** noches ocupadas ÷ noches disponibles, total y por propiedad. No son disponibles
  las noches que bloqueó el dueño ni las que cerró a mano en Airbnb, salvo que estén ocupadas.
- **Ingresos:** la plata de las noches del tramo. Reservas propias confirmadas o realizadas (su
  total) más lo importado de Airbnb (neto de comisión), separado por canal: directo, sitio,
  Airbnb.
- **Precio promedio por noche:** ingresos ÷ noches vendidas.
- **Ingreso por noche disponible:** ingresos ÷ noches disponibles.
- **Estadía promedio** (noches) y **anticipación promedio** (días entre que se reservó y la
  entrada; solo reservas propias, que son las que tienen fecha de reserva). Cuentan las estadías
  con alguna noche en el tramo, por su largo entero.
- **Lo que viene:** si el período no terminó, las noches ya reservadas de hoy al fin del período
  y su plata, aparte ("Ya reservado para lo que queda del mes: $ 320.000 en 8 noches").
- **Por propiedad:** ocupación, ingresos y precio promedio de cada una.
- **Por cobrar** y **Llegadas y salidas**: quedan como están.

**Moneda:** los totales en pesos suman solo pesos. Lo importado en otra moneda se muestra aparte,
con su moneda ("USD 1.240 de Airbnb"), y no entra en el precio promedio ni en el ingreso por
noche disponible; sus noches sí cuentan para la ocupación. Cuando pasa, la pantalla lo dice.

**Lo de Airbnb que no tiene su plata:** si en el período hay noches que Airbnb tiene reservadas
en el calendario y que no están en las ganancias importadas, la pantalla dice cuántas son ("Hay
3 noches de Airbnb sin su plata") y ofrece importar.

**Una propiedad pausada o borrada** que tiene estadías en el período entra igual, con su plata y
sus noches juntas, como una fila aparte. Sus noches disponibles son las que vendió.

Cada número lleva una línea que dice qué cuenta.

### Pantallas

- **Airbnb** (la que ya existe): una sección nueva, "Ganancias de Airbnb". Explica en tres pasos
  cómo bajar el archivo, tiene el botón para elegirlo, muestra la vista previa (con un selector de
  propiedad por cada aviso) y el botón de importar. Abajo, cuándo fue la última importación,
  cuántas estadías hay y hasta qué fecha llegan.
- **Estadísticas:** lo de arriba, con el estilo de la pantalla actual (las mismas tarjetas de
  números y barras del kit). Si no hay nada importado y hay un calendario de Airbnb conectado,
  una nota invita a importar las ganancias y lleva a la pantalla de Airbnb.
- **Un bloqueo de Airbnb** con una estadía importada de las mismas fechas y propiedad muestra el
  huésped y lo cobrado en su ficha informativa.

La demo sigue andando: su pantalla de Estadísticas usa las mismas cuentas, con dos estadías de
Airbnb de ejemplo en la cabaña que ya tiene un calendario conectado. La demo no tiene la sección
de importar (su pantalla de calendarios es otra, simulada).

## Límites

- Motor compartido: lo único que cambia es qué bloqueos borra la sincronización de un
  calendario de Airbnb (arriba). Nada más. Los tests de Turnos y Gimnasio tienen que seguir en
  verde.
- El panel trae medio año para atrás, por fecha de entrada. Una estadía propia que entró antes de
  esa ventana y sigue adentro del trimestre anterior no aporta sus noches a la comparación. Es un
  caso raro (estadías de más de una semana, seis meses atrás) y se acepta.
- Toda consulta filtra por negocio; las tablas nuevas llevan RLS (hay tests que lo exigen).
- El nombre del huésped es un dato personal: no sale del panel ni aparece en nada público.
- La máquina de Alan: una suite pesada por vez, con dos workers.
- Reglas del repo para módulos: `ui-ux-pro-max` antes de tocar pantallas, 390/768/1280, claro y
  oscuro, entrada en la Auditoría. El manual de Alquileres para Orbi todavía no existe (es tarea
  del 21/12): no entra acá.

## Lo que queda para quien lo construye

- Los nombres exactos de archivos, rutas y funciones, siguiendo cómo está armado Gimnasio.
- La lista inicial de nombres de columna en castellano (se ajusta con el primer archivo real).
- El detalle visual de la vista previa y de las tarjetas, dentro del kit.

## Lo que no se puede verificar sin Alan

Un archivo real de ganancias de un anfitrión argentino. Sin él, la lectura se prueba con archivos
armados según lo publicado y puede necesitar un ajuste cuando llegue el primero de verdad. No
bloquea construir: si el archivo real no se entiende, la importación lo dice y no guarda nada.
