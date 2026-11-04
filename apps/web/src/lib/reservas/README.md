# lib/reservas: por qué hay código compartido entre Turnos, Alquileres y Gimnasio

## La regla: cada módulo es independiente

Turnos, Alquileres y Gimnasio son módulos separados (decisión de Ale, 26/10/2026): ninguno
importa código de otro. Cada uno tiene sus datos, su sitio público, su panel y sus pasos del alta,
y se puede cambiar, borrar o pasar a otra persona sin tocar a los demás.

Hoy los tres son demos que corren en el navegador, con datos de ejemplo, y lo que la persona cambia
queda guardado en ese navegador (localStorage); el backend compartido ya existe (ver más abajo) y
cada módulo se conecta cuando su responsable lo hace.

## Entonces, ¿por qué se comparte esto?

Porque los tres resuelven las mismas cuentas, y una cuenta escrita tres veces termina dando tres
resultados distintos. Lo que vive acá son reglas de calendario y de plata: no hay pantallas ni datos.

| Archivo | Qué resuelve | Lo usan |
|---|---|---|
| `fechas.ts` | fechas `AAAA-MM-DD` y horas en minutos, sin zona horaria | Turnos, Alquileres, Gimnasio y el kit |
| `solapamiento.ts` | si dos reservas se pisan | Alquileres |
| `disponibilidad.ts` | horarios libres, turnos seguidos y bloques fijos con limpieza | Alquileres |
| `precio.ts` | franjas, extras, seña, saldo y redondeo | Alquileres, Gimnasio y el alta |
| `estadia.ts` | noches, temporadas y mínimo de noches | Alquileres (estadías) |
| `ics.ts` | el archivo `.ics` que leen Google Calendar, Airbnb y Booking | Turnos, Alquileres, Gimnasio |

Dos ejemplos de cuando se armó: el redondeo de precios (45.000 × 1,15 daba $51.700 en vez de
$51.800 por la coma flotante) se arregló una sola vez en `precio.ts` y quedó bien en todos lados; y
Turnos, que armaba su `.ics` a mano en hora local, pasó a usar `ics.ts`, que lo hace en UTC.

Funciona como cualquier librería de npm: los módulos la usan y ella no sabe que existen. Por eso
compartirla no los mezcla.

## Qué puede ir acá y qué no

- **Sí:** funciones puras (entra un dato, sale un resultado), sin React, sin estado, sin leer el
  navegador ni la hora actual (el "hoy" entra como parámetro). Cada una con su test en `__tests__/`.
- **No:** nada que nombre un módulo o un rubro (canchas, socios, turnos), pantallas, datos de
  ejemplo, ni imports de `src/modules/`. Si una regla es de un solo módulo, va en ese módulo.
- La UI compartida vive aparte, en `src/design-system/reservas/` (el kit con prefijo `rv-`: campos,
  calendario, modal, panel). Mismas reglas: no sabe de ningún módulo.

## Cómo se cambia

Un cambio acá le llega a todos los que lo usan: corré `pnpm exec vitest run src/lib/reservas` desde
`apps/web` y probá las pantallas de cada módulo de la tabla.

## Dónde se juntan los módulos (y dónde no)

- **El alta** (`src/modules/onboarding/alta/`) es el único lugar que conoce los cuatro módulos
  (Tienda, Turnos, Alquileres y Gimnasio), en un solo sentido: el alta los importa a ellos, ninguno
  importa el alta. El código de Alquileres y Gimnasio se carga recién cuando alguien elige uno de
  esos módulos, así el alta real de producción no lo baja.
- **Backend:** desde el 03/11/2026 los tres comparten UN motor de reservas en la API
  (`apps/api/src/reservas`, contrato en su README): qué se reserva, cuándo, con qué cupo, en qué
  estado está y las reglas que lo mantienen íntegro aunque dos personas toquen el botón a la vez.
  En la web lo usan por el cliente tipado `src/lib/reservasApi/` (`panel` y `sitio(slug)`), cada uno
  con su `modulo`: sigue sin haber imports entre módulos. Las demos todavía corren con datos del
  navegador hasta que cada responsable conecte su módulo (tareas del plan en Módulos).
- La sección **Módulos** del superadmin sigue sin API: es solo visual. El plan de trabajo y la
  auditoría de los tres viven en `src/modules/superadmin/modulos/` y lo que se marca queda en el
  navegador. Ahí están juntos porque es la gestión del equipo, quién hace qué y para cuándo, no una
  parte de los módulos: ningún módulo lo lee ni lo necesita para andar.
- **eslint** (`apps/web/eslint.config.mjs`) marca como error un import de un módulo a otro, para que
  nadie los mezcle sin darse cuenta.
