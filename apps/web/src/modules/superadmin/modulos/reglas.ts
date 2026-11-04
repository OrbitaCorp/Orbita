// Cómo se trabaja en el ciclo 2 de los módulos (super admin → Módulos).
//
// Pedido de Ale (04/11/2026): "cada uno decide su módulo como piense, entonces
// cada uno sabe y debe ser profesional; esto debe tener un alcance; metele todo
// para que se sepa todo y que cada uno vaya construyendo, y que sea libre a
// todo cambio o mejora que ellos quieran". Y para Turnos: "tener mucho cuidado
// porque por ahí no se comparte panel con algunos subrubros, entonces el
// sidebar tiene más o menos cosas".
//
// Es contenido escrito a mano, como el plan: la pantalla lo muestra en la lista
// de módulos y dentro de cada módulo (Modulos.tsx, <ComoSeTrabaja>), con el
// aviso propio del módulo arriba de todo.

import type { ConPlan } from './plan'

export interface Regla {
  titulo: string
  texto: string
}

export const COMO_SE_TRABAJA: Regla[] = [
  {
    titulo: 'Cada uno es dueño de su módulo',
    texto: 'Mateo de Turnos, Alan de Alquileres, Ale de Gimnasio. Lo que pasa adentro de tu módulo lo decidís vos, como creas mejor: pantallas, flujo, datos, nombres, orden. Se espera trabajo profesional: con criterio, probado en los tres anchos y registrado.',
  },
  {
    titulo: 'El plan es una guía, no una jaula',
    texto: 'Las tareas marcan el camino del ciclo (conectar al motor de reservas, el alta real, la QA, la propuesta para salir de Próximamente) y el ritmo de una por día. Sos libre de cambiar, agregar, sacar o mejorar lo que quieras de tu módulo. Si cambiás el plan, dejalo en una entrada de Auditoría para que los demás lo sepan.',
  },
  {
    titulo: 'Las decisiones de tu módulo son tuyas',
    texto: 'En Auditoría, cada decisión abierta dice en simple qué hay que decidir, hasta dónde llega (su alcance) y una propuesta. Escribí tu respuesta en la tarjeta, copiala con el botón y pegala en tu sesión de Claude: queda registrada como decisión tomada, con su porqué. Lo que toca plata, producción de Tienda o a los tres módulos a la vez lo decide Ale.',
  },
  {
    titulo: 'Lo compartido se avisa',
    texto: 'Las cuatro carpetas de "Lo compartido" les cambian a los tres. Antes de tocarlas, avisá a los otros dos; después, los tests de la carpeta y una mirada a los otros módulos. Lo que es de un solo módulo va en su carpeta, nunca en lo compartido.',
  },
  {
    titulo: 'Todo queda en Auditoría',
    texto: 'Cada tarea hecha tiene su entrada: qué se hizo, quién, cuándo, archivos tocados y capturas. Lo que se decide, también. Así cualquiera entiende el módulo sin preguntar, y el cierre del ciclo se arma solo.',
  },
]

/** El aviso propio de cada módulo: lo que hay que tener presente antes de tocar. */
export const AVISOS_MODULO: Record<ConPlan, string> = {
  turnos: 'Cuidado con los rubros: Turnos tiene 23 rubros en dos modos de agenda. En "por profesional" (barbería, peluquería, consultorios, clases, uñas, tatuajes…) el panel muestra Equipo, roles y personas; en "por sala o cabina" (clínica, estética, spa, depilación, electro) muestra Espacios y no Equipo, y algunos rubros atienden a domicilio. El sidebar no es el mismo para todos: cada sección nueva tiene que decir en qué modo aparece, y ninguna puede quedar vacía en un rubro. La tarea del 06/11 lo deja escrito.',
  alquileres: 'Tres modos que no se mezclan: canchas (por hora, una o varias seguidas), salones (por bloque, uno o varios salones con paquetes) y estadías (por noche o por mes). Cada sección del panel y del sitio tiene que saber en qué modo está, y Qué hay libre responde distinto en cada uno. Lo que el motor no cubre (paquetes, temporadas, por mes) se define con Ale la primera semana.',
  gimnasio: 'Las clases son reservas (cupo, sesiones, lista de espera) y van al motor compartido; los planes, los pases y los alumnos no son reservas: son del módulo, y dónde viven se decide el 16/11 antes de conectarlos. Lo transversal (Módulos, alta única, cobro, recordatorios, cierre) está en este plan con el prefijo "Transversal".',
}
