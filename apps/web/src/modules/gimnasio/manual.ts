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
                        { tipo: 'nota', variante: 'dato', texto: 'Clases y Días sin clases ya guardan en el sistema de reservas del negocio. Mientras se conecta el resto, una franja arriba avisa cuando una sección todavía no guarda: lo que se cambie ahí no queda guardado.' },
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
                    pista: 'reservar un lugar a mano, para alguien nuevo o para varias personas',
                    bloques: [
                        { tipo: 'pasos', items: [
                            { titulo: 'Abrí la clase', texto: 'Desde Clases, tocá la clase del día que corresponda.' },
                            { titulo: 'Elegí a la persona', texto: 'En "Anotar", elegí a un alumno o socio de la lista, o "Alguien nuevo…" y cargá su nombre y su celular: con el celular se la reconoce la próxima vez.' },
                            { titulo: 'Elegí cuántos lugares', texto: 'Si viene con amigas o amigos, en "Lugares" elegís cuántos ocupa (hasta los que quedan).' },
                            { titulo: 'Anotala', texto: 'Tocá [[Anotar]]. Aparece en la lista de anotados de esa clase.' },
                        ] },
                        { tipo: 'nota', variante: 'aviso', texto: 'Si a esa persona ya no le quedan clases esa semana o en su pack, el panel lo avisa antes de anotarla: se puede igual, cobrándole la clase aparte.' },
                        { tipo: 'nota', variante: 'dato', texto: 'Si la clase se llenó mientras la mirabas (alguien reservó desde el sitio), el panel avisa que no queda lugar y muestra la clase como está.' },
                    ],
                },
                {
                    id: 'lista-de-espera', titulo: 'La lista de espera',
                    pista: 'clase llena, cómo pasa el que espera',
                    bloques: [
                        { tipo: 'parrafo', texto: 'Con la clase llena, el botón dice [[A la lista de espera]]: la persona queda esperando, en el orden en que llegó, y el panel avisa en qué lugar de la lista quedó.' },
                        { tipo: 'parrafo', texto: 'Cuando alguien libera su lugar, **el primero de la lista pasa solo** y queda anotado; el aviso dice quién pasó. Si aparece un lugar sin que nadie cancele (por ejemplo, le subiste el cupo a la clase), tocá [[Darle el lugar]] al lado de quien quieras.' },
                        { tipo: 'parrafo', texto: 'Para sacar a alguien de la lista, tocá la cruz al lado de su nombre.' },
                    ],
                },
                {
                    id: 'liberar-lugar', titulo: 'Liberar un lugar',
                    pista: 'sacar a alguien de una clase, cancelar su lugar',
                    bloques: [
                        { tipo: 'parrafo', texto: 'En la clase abierta, la cruz al lado de un anotado libera su lugar. Si había gente esperando, el primero de la lista lo toma en el acto.' },
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
                        { tipo: 'nota', variante: 'aviso', texto: 'Lo que ya estaba reservado esos días no se cancela solo: al guardar, el aviso dice cuántas reservas quedaron adentro para que les escribas.' },
                        { tipo: 'parrafo', texto: 'Para volver a abrir esos días, tocá [[Quitar]] al lado del que cargaste. Los que vienen de un calendario externo se quitan desde Calendarios.' },
                    ],
                },
            ],
        },
    ],
}
