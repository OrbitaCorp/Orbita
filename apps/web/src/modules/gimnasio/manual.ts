// El manual de Gimnasio que lee Orbi: lo que hace cada pantalla del panel, con
// los nombres exactos de los botones (entre [[ ]]). Mismo vocabulario que el de
// Tienda (lib/manual), sin importar a Tienda. Lo junta el generador del
// artefacto (modules/orbi/manual/artefacto.ts) y viaja aparte de los temas de
// Tienda: Orbi todavía no lo usa (los módulos no usan Orbi, no se paga IA por
// ellos), pero queda escrito y al día para cuando se decida.
//
// Regla del equipo (.claude/rules/modulos.md § 4): todo cambio de pantalla,
// botón, paso o sección del panel de Gimnasio se corrige acá. El test
// __tests__/manual.test.ts falla si un [[botón]] no existe en el panel.
//
// Cómo se llama a quien viene depende del rubro (Alumnos en un box, Socios en
// un gimnasio, Participantes en un taller): el manual dice "alumno o socio".
import type { ManualDeModulo } from '@/lib/manual/modulos'

export const MANUAL_GIMNASIO: ManualDeModulo = {
    modulo: 'gimnasio',
    nombre: 'Gimnasio',
    capitulos: [
        {
            id: 'panel', titulo: 'El panel de Gimnasio',
            resumen: 'Qué hay en cada sección y qué avisa el panel al entrar.',
            temas: [
                {
                    id: 'secciones', titulo: 'Las secciones del panel',
                    pista: 'dónde está cada cosa del gimnasio',
                    bloques: [
                        { tipo: 'parrafo', texto: 'Todo está en la barra de la izquierda, agrupado en **Hoy**, **Negocio** y **Reservas**, más Calendarios y Configuración.' },
                        { tipo: 'campos', items: [
                            { label: 'Clases', texto: 'Las clases de cada día con quién viene, el check-in y la lista de espera, y la grilla semanal.' },
                            { label: 'Alumnos o socios', texto: 'Cada persona con su plan, cuándo vence y su asistencia.' },
                            { label: 'Ingresos', texto: 'Lo que entró por planes y clases sueltas, mes contra mes.' },
                            { label: 'Equipo', texto: 'Quién da cada actividad y su color en la grilla.' },
                            { label: 'Actividades y salas', texto: 'Lo que se dicta, con su duración y su cupo, y dónde.' },
                            { label: 'Planes y precios', texto: 'Clase de prueba, clase suelta, packs y membresías.' },
                            { label: 'Reglas de reserva', texto: 'Hasta cuántos días antes se reserva y hasta cuándo se cancela.' },
                            { label: 'Días sin clases', texto: 'Feriados, vacaciones o cierres.' },
                            { label: 'Recordatorios y mensajes', texto: 'Los mensajes que les llegan a los alumnos.' },
                            { label: 'Pagos', texto: 'Cómo cobra el negocio.' },
                        ] },
                        { tipo: 'parrafo', texto: 'Arriba a la derecha está la campanita: avisa las clases de hoy con gente esperando lugar, las que ya están completas, los planes que vencen en los próximos días y las clases de la grilla que quedaron sin profe. Cada aviso lleva directo a la clase o a la ficha.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Clases, Alumnos o socios, Planes y precios y Días sin clases ya guardan en el sistema de reservas del negocio. Mientras se conecta el resto, una franja arriba avisa cuando una sección todavía no guarda: lo que se cambie ahí no queda guardado.' },
                    ],
                },
                {
                    id: 'datos-viejos', titulo: 'Si el panel avisa que no pudo actualizar',
                    pista: 'se cortó internet, los datos están viejos, no carga',
                    bloques: [
                        { tipo: 'parrafo', texto: 'El panel se actualiza solo: cada minuto vuelve a leer el día que estás mirando, así lo que alguien reserva desde el sitio aparece sin tocar nada.' },
                        { tipo: 'parrafo', texto: 'Si arriba aparece una franja que dice **No pudimos actualizar los datos**, la última lectura falló (se cortó la conexión o el servidor no contestó) y lo que ves puede estar viejo. Tocá [[Actualizar]] antes de seguir.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Mientras el panel guarda un cambio, la pantalla queda un momento sin poder tocarse: es para que no se anote o se libere algo sobre datos viejos.' },
                    ],
                },
            ],
        },
        {
            id: 'clases', titulo: 'Clases',
            resumen: 'El día: quién viene a cada clase, anotar, la lista de espera y la asistencia.',
            temas: [
                {
                    id: 'clases-del-dia', titulo: 'Las clases del día',
                    pista: 'ver quién viene hoy o otro día',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En Clases, con [[Día]] elegido, arriba está la tira de días: tocás uno para ver sus clases, las flechas pasan de semana y [[Hoy]] vuelve al día de hoy. Un puntito abajo de un día quiere decir que ese día alguien espera lugar.' },
                        { tipo: 'parrafo', texto: 'Cada clase dice su hora, la actividad, el profe, la sala y una barra con los lugares tomados. Al costado puede tener **En curso**, cuántos están **en espera** o, si ya pasó, cuántos **vinieron**. Tocás la clase para abrirla.' },
                        { tipo: 'nota', variante: 'tip', texto: 'Para ver la semana entera como se repite, tocá [[Grilla semanal]].' },
                    ],
                },
                {
                    id: 'anotar', titulo: 'Anotar a alguien en una clase',
                    pista: 'reservar un lugar a mano, para alguien nuevo o para varias personas, con su plan o cobrando aparte',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí la clase', texto: 'Desde Clases, tocá la clase del día que corresponda.' },
                            { titulo: 'Elegí a la persona', texto: 'En "Anotar", elegí a un alumno o socio de la lista, o "Alguien nuevo…" y cargá su nombre y su celular: con el celular se la reconoce la próxima vez. Si dos personas se llaman igual, la lista muestra el celular de cada una.' },
                            { titulo: 'Elegí cuántos lugares', texto: 'Si viene con amigas o amigos, en "Lugares" elegís cuántos ocupa (hasta los que quedan).' },
                            { titulo: 'Mirá cómo paga', texto: 'En "Cómo paga" el panel ya propone lo que corresponde: con su plan, si tiene uno que cubre esa clase (dice cuál y, si es un pack, cuántas clases le quedan); si no, se cobra aparte, con el precio de la clase suelta. Si todavía no usó su clase de prueba, también se puede elegir.' },
                            { titulo: 'Anotala', texto: 'Tocá [[Anotar]]. Aparece en la lista de anotados de esa clase, y el aviso dice cómo quedó su plan o cuánto se le cobra.' },
                        ] },
                        { tipo: 'nota', variante: 'aviso', texto: 'Si tiene un plan y esa clase no se la cubre (venció, no le quedan clases en el pack o ya usó las de esa semana), el panel dice por qué antes de anotarla: se puede igual, cobrándole la clase aparte.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Una membresía cubre un solo lugar por clase: si viene con alguien, anotá a esa persona por separado para que use su plan.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Si la clase se llenó mientras la mirabas (alguien reservó desde el sitio), el panel avisa que no queda lugar y muestra la clase como está.' },
                    ],
                },
                {
                    id: 'como-paga', titulo: 'Cómo paga cada lugar',
                    pista: 'con su plan, se cobra aparte, clase de prueba, sin definir, corregir cómo pagó una clase',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En la lista de anotados de una clase, al lado de cada persona, un botón dice cómo paga ese lugar: **Con su plan**, **Aparte** o **Prueba**.' },
                        { tipo: 'campos', items: [
                            { label: 'Con su plan', texto: 'Se le descuenta una clase del pack, o cuenta entre las de esa semana de su membresía.' },
                            { label: 'Se cobra aparte', texto: 'No toca su plan: se le cobra la clase suelta, una por cada lugar.' },
                            { label: 'Clase de prueba', texto: 'Gratis, una sola vez por persona y para un solo lugar.' },
                        ] },
                        { tipo: 'pasos', items: [
                            { titulo: 'Tocá el botón de su fila', texto: 'El que dice cómo paga hoy ese lugar.' },
                            { titulo: 'Elegí', texto: 'En "Cómo paga" aparecen solo las opciones que esa persona puede usar; si su plan no cubre la clase, abajo dice por qué.' },
                            { titulo: 'Guardá', texto: 'Tocá [[Guardar]]. [[Volver]] cierra sin cambiar nada.' },
                        ] },
                        { tipo: 'parrafo', texto: 'En el sistema de reservas del negocio, si el botón dice [[Sin definir]] falta decirlo: pasa con quien reservó desde el sitio y con quien pasó solo de la lista de espera. Tocalo y elegí cómo paga.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Si un lugar deja de pagarse con el plan, o se libera, la clase que se había descontado del pack le vuelve sola.' },
                    ],
                },
                {
                    id: 'lista-de-espera', titulo: 'La lista de espera',
                    pista: 'clase llena, cómo pasa el que espera',
                    bloques: [
                        { tipo: 'parrafo', texto: 'Con la clase llena, el botón dice [[A la lista de espera]]: la persona queda esperando, en el orden en que llegó, y el panel avisa en qué lugar de la lista quedó.' },
                        { tipo: 'parrafo', texto: 'Cuando alguien libera su lugar, **el primero de la lista pasa solo** y queda anotado; el aviso dice quién pasó. Si aparece un lugar sin que nadie cancele (por ejemplo, le subiste el cupo a la clase), tocá [[Darle el lugar]] al lado de quien quieras.' },
                        { tipo: 'parrafo', texto: 'Para sacar a alguien de la lista, tocá la cruz al lado de su nombre y confirmá con [[Sacar de la lista]]: pierde su lugar en la fila y, si después quiere volver, entra al final. [[Volver]] lo deja como estaba.' },
                        { tipo: 'nota', variante: 'dato', texto: 'En un día marcado sin clases, o en una clase que ya empezó, no se le da el lugar a nadie.' },
                        { tipo: 'nota', variante: 'dato', texto: 'A la lista de espera se entra sin decir cómo paga. En el sistema de reservas del negocio, quien pasa queda con su lugar sin definir: decí cómo paga desde su fila, en la lista de anotados.' },
                    ],
                },
                {
                    id: 'liberar-lugar', titulo: 'Liberar un lugar',
                    pista: 'sacar a alguien de una clase, cancelar su lugar',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí la clase', texto: 'Desde Clases, tocá la clase del día que corresponda.' },
                            { titulo: 'Tocá la cruz', texto: 'Está al lado del nombre de la persona. El panel pregunta antes de hacer nada.' },
                            { titulo: 'Confirmá', texto: 'Tocá [[Liberar el lugar]]. Si había gente esperando, el primero de la lista lo toma en el acto y el aviso dice quién pasó. [[Volver]] cierra sin liberar nada.' },
                        ] },
                        { tipo: 'nota', variante: 'aviso', texto: 'En el sistema de reservas del negocio, liberar un lugar no se puede deshacer: la reserva queda cancelada y, si la persona dejó su email, le llega el aviso. Si fue un error, hay que anotarla de nuevo.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Una clase que ya terminó no libera lugares: ahí se marca la asistencia.' },
                    ],
                },
                {
                    id: 'asistencia', titulo: 'Check-in y faltas',
                    pista: 'marcar presente, quién vino, quién faltó',
                    bloques: [
                        { tipo: 'parrafo', texto: 'Cuando se abre el check-in, al lado de cada anotado aparece [[Check-in]]: lo tocás cuando la persona llega y queda como que **vino**. Cuando la clase terminó, también aparece [[Faltó]] para quien no vino.' },
                        { tipo: 'campos', items: [
                            { label: 'Cuándo se abre el check-in', texto: 'En el sistema de reservas del negocio, cuando empieza la clase. En la vista previa, unos minutos antes (los de Reglas de reserva).' },
                            { label: 'Corregir', texto: 'En el sistema de reservas del negocio, presente y ausente se marcan una vez y quedan así. En la vista previa se puede pasar de uno al otro.' },
                        ] },
                        { tipo: 'parrafo', texto: 'Arriba de la lista, en una clase que ya pasó, se ve cuántos vinieron y cuántos faltaron.' },
                    ],
                },
            ],
        },
        {
            id: 'grilla', titulo: 'La grilla semanal',
            resumen: 'Las clases que se repiten cada semana: crearlas, cambiarlas y quitarlas.',
            temas: [
                {
                    id: 'grilla-semanal', titulo: 'Crear y cambiar las clases de la semana',
                    pista: 'agregar una clase nueva, cambiar el horario, el cupo, el profe o la sala',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En Clases, [[Grilla semanal]] muestra una columna por día con sus clases: hora, actividad, profe, cupo y qué tan llena estuvo en las últimas cuatro semanas.' },
                        { tipo: 'pasos', items: [
                            { titulo: 'Nueva', texto: 'Tocá [[Nueva clase]] arriba, o [[Clase]] al pie del día que quieras.' },
                            { titulo: 'Completala', texto: 'Actividad, día, hora, profe, sala y cupo (cuántos lugares tiene; si se pasa, el resto queda en lista de espera).' },
                            { titulo: 'Guardá', texto: 'Tocá [[Guardar]]: se repite todas las semanas el mismo día y a la misma hora, y se ve en el sitio al instante.' },
                        ] },
                        { tipo: 'parrafo', texto: 'En el sistema de reservas del negocio, si la actividad, el profe o la sala todavía no existen se escriben ahí mismo: en Actividad elegí [[Actividad nueva…]] y poné su nombre y su duración; en Profe, [[Alguien nuevo…]]; en Sala, [[Sala nueva…]]. Quedan en la lista para las próximas clases.' },
                        { tipo: 'nota', variante: 'dato', texto: 'El formulario queda abierto hasta que la clase se guardó. Si el sistema rechaza el cambio (se pisa con otra clase, tiene lugares tomados), lo dice y lo que cargaste no se pierde.' },
                        { tipo: 'parrafo', texto: 'Para cambiar una, tocala en la grilla, cambiá lo que haga falta y tocá [[Guardar]]. Para sacarla, [[Quitar]]. [[Cancelar]] cierra sin guardar.' },
                        { tipo: 'lista', items: [
                            'Dos clases no pueden pisarse en la misma sala, y la clase tiene que caer dentro del horario del negocio.',
                            'El cupo no puede bajar de los lugares que ya están tomados en una fecha que viene: el panel dice qué día.',
                            'Una clase con lugares reservados por delante no cambia de día, de hora ni de duración, y no se quita: primero hay que liberar esos lugares (o esperar a que pasen).',
                        ] },
                    ],
                },
            ],
        },
        {
            id: 'alumnos', titulo: 'Alumnos o socios',
            resumen: 'Quién tiene qué plan, cuándo vence y cuánto viene; sumar a alguien y asignarle, renovarle o quitarle un plan.',
            temas: [
                {
                    id: 'lista-de-alumnos', titulo: 'La lista y los vencimientos',
                    pista: 'ver quién está al día, a quién se le vence el plan, buscar a alguien',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En Alumnos (o Socios, según el rubro) está cada persona con su plan, cuándo vence, lo que le queda y su asistencia de los últimos 30 días. Los que vencen en los próximos 7 días van primero: son a quienes conviene avisarles esta semana.' },
                        { tipo: 'campos', items: [
                            { label: 'Al día', texto: 'Tiene un plan que vale hoy.' },
                            { label: 'Vencen en 7 días', texto: 'Su plan vence esta semana. Si hay alguno, una franja arriba dice quiénes son.' },
                            { label: 'Vencidos', texto: 'El plan venció o al pack no le quedan clases.' },
                            { label: 'Sin plan', texto: 'Vino de prueba, paga la clase suelta o todavía no tiene plan.' },
                        ] },
                        { tipo: 'parrafo', texto: 'Los mismos cuatro grupos están como filtros arriba de la lista, junto a un buscador por nombre o teléfono. Para abrir la ficha de alguien, tocá [[Ver]] en su fila.' },
                        { tipo: 'nota', variante: 'dato', texto: 'En el sistema de reservas del negocio también aparece quien reservó una clase sin ser alumno todavía (por ejemplo, desde el sitio): figura sin plan hasta que se le asigne uno.' },
                    ],
                },
                {
                    id: 'sumar-alumno', titulo: 'Sumar a alguien',
                    pista: 'dar de alta un alumno o socio nuevo, anotar a alguien en el mostrador',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí el formulario', texto: 'En Alumnos (o Socios), con el botón de arriba a la derecha: dice "Sumar" y cómo se llama a quien viene en tu rubro.' },
                            { titulo: 'Cargá sus datos', texto: 'Nombre y apellido, y el celular con código de área. El email es opcional.' },
                            { titulo: 'Elegí el plan', texto: 'Un pack o una membresía, o "Sin plan por ahora" para asignárselo después.' },
                            { titulo: 'Guardá', texto: 'Tocá [[Sumar]]. El aviso dice con qué plan quedó y hasta cuándo vale. [[Cancelar]] cierra sin sumar a nadie.' },
                        ] },
                        { tipo: 'nota', variante: 'dato', texto: 'El formulario queda abierto hasta que se guardó: si algo falla, lo que cargaste no se pierde. Con el celular se la reconoce después, cuando reserva desde el sitio.' },
                    ],
                },
                {
                    id: 'asignar-plan', titulo: 'Asignar, renovar o quitar un plan',
                    pista: 'renovar la membresía, vender un pack, cambiar de plan, sacar un plan cargado por error',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí su ficha', texto: 'En Alumnos (o Socios), tocá [[Ver]] en su fila.' },
                            { titulo: 'Elegí el plan', texto: 'En "Asignar un plan" (o "Renovar o cambiar", si ya tiene uno): un pack o una membresía de los que cargaste en Planes y precios.' },
                            { titulo: 'Guardá', texto: 'Tocá [[Asignar]], o [[Renovar]] si es el mismo plan que ya tiene. El aviso dice hasta cuándo vale.' },
                        ] },
                        { tipo: 'parrafo', texto: 'En el sistema de reservas del negocio, lo que pasa depende de lo que ya tenga:' },
                        { tipo: 'campos', items: [
                            { label: 'Renovar la misma membresía antes de que venza', texto: 'La nueva arranca al día siguiente de que termina la que tiene: no pierde días.' },
                            { label: 'Pasar a otra membresía', texto: 'La nueva arranca hoy y reemplaza a la anterior.' },
                            { label: 'Sumar un pack', texto: 'Convive con lo que tenga. Cuando más de un plan cubre una clase, se usa primero el que vence antes.' },
                        ] },
                        { tipo: 'parrafo', texto: 'Quien tiene más de un plan los ve en su ficha en una lista, cada uno con hasta cuándo vale y lo que le queda.' },
                        { tipo: 'parrafo', texto: 'Para sacar un plan asignado por error, tocá [[Quitar este plan]] (o [[Quitar]] al lado del plan, si tiene varios) y confirmá con [[Quitar el plan]]: deja de valer desde ese momento, y los lugares que ya reservó con ese plan siguen reservados. [[Volver]] cierra sin quitar nada.' },
                        { tipo: 'parrafo', texto: 'Más abajo, la ficha muestra cuánto vino y cuánto faltó en los últimos 30 días y sus últimas clases, cada una con cómo se pagó.' },
                        { tipo: 'nota', variante: 'aviso', texto: 'Asignar o renovar un plan no cobra nada: el cobro se registra aparte.' },
                    ],
                },
            ],
        },
        {
            id: 'planes', titulo: 'Planes y precios',
            resumen: 'La clase de prueba, la clase suelta, los packs y las membresías: cargarlos, cambiarlos y dejar de ofrecerlos.',
            temas: [
                {
                    id: 'planes-y-precios', titulo: 'Cargar y cambiar los planes',
                    pista: 'crear un pack o una membresía, cambiar un precio, dejar de vender un plan',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En Negocio → Planes y precios hay cuatro tipos: la clase de prueba (gratis, una vez por persona), la clase suelta, los packs de clases y las membresías.' },
                        { tipo: 'pasos', items: [
                            { titulo: 'Si todavía no hay ninguno', texto: 'Tocá [[Usar los planes sugeridos]] para arrancar con los que suele tener tu rubro, y cambiales el nombre y el precio.' },
                            { titulo: 'Sumá los que falten', texto: 'Con [[Membresía]] o [[Pack]]. La clase suelta y la de prueba son una de cada una: si falta alguna, aparecen también [[Clase suelta]] y [[Clase de prueba]].' },
                            { titulo: 'Completá cada plan', texto: 'El nombre y el precio. En un pack, cuántas clases trae y por cuántos días vale; en una membresía, cuántas clases por semana (o libre) y la vigencia.' },
                            { titulo: 'Guardá', texto: 'Tocá [[Guardar cambios]] en la barra de abajo. [[Descartar]] vuelve a lo que estaba guardado.' },
                        ] },
                        { tipo: 'campos', items: [
                            { label: 'Se ofrece en el sitio', texto: 'Apagado, un pack o una membresía no se vende más; quien ya lo tiene lo sigue usando hasta que venza. La clase suelta o la de prueba apagadas no aparecen en el sitio, pero desde el panel se sigue pudiendo anotar con ellas.' },
                            { label: 'Quitar un plan', texto: 'Con [[Quitar]] sale de la lista al guardar. Quien ya lo tiene lo sigue usando hasta que venza. La clase de prueba no se quita: se apaga.' },
                            { label: 'Cuántos lo tienen', texto: 'Cada pack y cada membresía dice cuántos alumnos o socios lo tienen hoy.' },
                        ] },
                        { tipo: 'nota', variante: 'dato', texto: 'Cada persona guarda su plan como era cuando se lo asignaron: cambiarle el precio o las clases a un plan vale para los que se asignen desde ahora, no para los que ya están dados.' },
                        { tipo: 'nota', variante: 'aviso', texto: 'Un plan sin nombre no se guarda: la barra de abajo lo avisa.' },
                    ],
                },
            ],
        },
        {
            id: 'dias-sin-clases', titulo: 'Días sin clases',
            resumen: 'Feriados, vacaciones o cierres: esos días no se reserva.',
            temas: [
                {
                    id: 'feriados', titulo: 'Cargar un feriado o unas vacaciones',
                    pista: 'cerrar un día, feriado, vacaciones, mantenimiento',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí la sección', texto: 'Reservas → Días sin clases.' },
                            { titulo: 'Cargá los días', texto: 'Tocá [[Agregar días]], elegí desde y hasta qué día (los dos incluidos) y escribí el motivo: se muestra en el sitio ese día.' },
                            { titulo: 'Guardá', texto: 'Tocá [[Agregar]]. Esos días no se puede reservar y en Clases se ven sin clases.' },
                        ] },
                        { tipo: 'nota', variante: 'aviso', texto: 'Lo que ya estaba reservado esos días no se cancela solo. El formulario avisa cuántas reservas hay antes de guardar y, al guardar, cuántas quedaron adentro.' },
                        { tipo: 'parrafo', texto: 'Después, cada día sin clases que todavía tiene reservas lo dice en su fila ("3 reservas siguen en pie"). Tocá [[Ver el día]] para ir a ese día en Clases: ahí se ven las clases que quedaron con gente, para avisarles y liberar sus lugares.' },
                        { tipo: 'parrafo', texto: 'Para volver a abrir esos días, tocá [[Quitar]] al lado del que cargaste. Los que vienen de un calendario externo se quitan desde Calendarios.' },
                    ],
                },
            ],
        },
        {
            id: 'sitio', titulo: 'El sitio del negocio',
            resumen: 'Lo que ve quien reserva desde el sitio y cómo llega cada reserva al panel.',
            temas: [
                {
                    id: 'reservar-desde-el-sitio', titulo: 'Cómo se reserva desde el sitio',
                    pista: 'qué ve el alumno, reservar online, lugar guardado, lista de espera desde el sitio',
                    bloques: [
                        { tipo: 'parrafo', texto: 'El sitio del negocio muestra las clases que se pueden reservar hoy y en los próximos días, cada una con los lugares que le quedan, los planes que tienen prendido "Se ofrece en el sitio" y el horario. Se reserva sin registrarse.' },
                        { tipo: 'pasos', items: [
                            { titulo: 'Elige la clase', texto: 'El día y la clase. Al tocar "Continuar", su lugar queda guardado unos minutos mientras carga sus datos: nadie se lo lleva en el medio.' },
                            { titulo: 'Carga sus datos', texto: 'Nombre y celular. El email es opcional: sirve para que le llegue la confirmación.' },
                            { titulo: 'Confirma', texto: 'Con "Confirmar reserva" el lugar queda a su nombre y recibe un código. Si tarda más de lo que dura el lugar guardado, tiene que tomarlo de nuevo.' },
                        ] },
                        { tipo: 'campos', items: [
                            { label: 'Cómo se paga', texto: 'En el sitio no se paga ni se elige el plan. El lugar llega al panel **sin definir**: decí cómo paga desde su fila, en la lista de anotados de la clase.' },
                            { label: 'Clase completa', texto: 'Con la lista de espera prendida, la persona se anota ahí desde el sitio y, si alguien libera su lugar, pasa sola. Sin lista de espera, la clase se ve completa y no se puede elegir.' },
                            { label: 'Días sin clases', texto: 'Un día cargado en Días sin clases se ve cerrado en el sitio, con su motivo.' },
                            { label: 'Hasta cuándo se reserva', texto: 'Hasta los días de anticipación de las reglas del negocio (el sitio muestra, como mucho, cinco semanas). Una clase que está por empezar ya no se ofrece.' },
                        ] },
                        { tipo: 'nota', variante: 'dato', texto: 'Tocar dos veces el botón, o reintentar después de un corte de conexión, no reserva dos lugares.' },
                    ],
                },
            ],
        },
    ],
}
