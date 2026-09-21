// Funciones utilitarias genéricas usadas en todo el frontend.


// (Fase 4 — Ale) Los hubs del panel muestran un solo Toast al pie y le pasan
// tanto los mensajes de éxito como los de error por el mismo canal (onToast).
// Este helper decide la variante mirando el texto, así un "No se pudo…" sale en
// rojo y no con tilde verde de éxito. Cubre los mensajes de error que produce
// el panel (los "No se pudo/pudieron…") y los de ApiError más comunes.
export function toastEsError(mensaje: string): boolean {
    return /no se pud|no se pudieron|no pod[eé]s|no pueden|^error|falló|fallo|inválid|invalid|supera|no tiene|no se encontr|no quedan|no se pueden|ya está|ya es |debé|debe /i.test(mensaje)
}

// Formatea un número como precio argentino con signo $
// Ej: 124300 → "$124.300"
export function fmtMoney(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-AR')
}

// Deja cualquier teléfono argentino listo para armar un link de wa.me.
// WhatsApp exige el formato completo "549" + código de área + número, y a
// mano casi nadie lo escribe así — reportado: un mismo negocio recibe
// "3757673226", "543757673226" (sin el 9 de celular), "5493757673226" (ya
// completo) o con espacios/guiones ("3757 673226", "3757-673226"), y varios
// de esos casos WhatsApp los rechazaba como "número inválido" al redirigir.
// No toca lo que el usuario escribió ni lo que se guarda en la base (ni acá
// ni en el dueño del negocio ni en el teléfono que carga un cliente en el
// checkout) — se usa solo al armar el link de wa.me, en los dos roles donde
// se redirige a WhatsApp: el storefront (openWpp, contra el WhatsApp del
// negocio) y el panel (PedidoDetalle, contra el teléfono que puso el cliente).
// Los códigos de área argentinos no empiezan con "5", así que un número que
// ya arranca con "54" siempre es el código de país, nunca una casualidad.
// Límite conocido, no cubierto: la forma vieja de larga distancia con "15"
// intercalado ("011-15-1234-5678") necesitaría una tabla de códigos de área
// para saber dónde cortar — no se pidió, no se resuelve acá.
export function normalizarWhatsApp(valor: string): string {
    const digitos = valor.replace(/\D/g, '')
    if (!digitos) return ''
    if (digitos.startsWith('549')) return digitos                     // ya viene completo
    if (digitos.startsWith('54'))  return '549' + digitos.slice(2)    // country code sin el 9 (forma vieja)
    return '549' + digitos.replace(/^0/, '')                          // sin código de país (con o sin el 0 de larga distancia)
}

// Saludo según la hora del día — usado en el header del Dashboard
// 00-05 → "Buenas noches"
// 06-11 → "Buenos días"
// 12-18 → "Buenas tardes"
// 19-23 → "Buenas noches"
export function saludoHora(): string {
    const h = new Date().getHours()
    if (h < 6)  return 'Buenas noches'
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
}

// Fecha larga en español capitalizada
// Ej: "viernes, 22 de mayo"
export function fechaLarga(): string {
    const d     = new Date()
    const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    // Solo la primera letra en mayúscula ("Miércoles, 19 de agosto") — el
    // capitalize por CSS que había antes ponía en mayúscula CADA palabra
    // ("19 De Agosto"), que en español está mal.
    const s = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`
    return s.charAt(0).toUpperCase() + s.slice(1)
}

// Genera un SVG path suavizado (curvas Bezier) a partir de puntos x/y.
// Usado en gráficos de línea custom — hace que la línea sea curva en vez
// de recta entre cada punto.
export function buildSmoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return ''
    const d = [`M ${pts[0].x},${pts[0].y}`]
    for (let i = 0; i < pts.length - 1; i++) {
        const p0  = pts[i], p1 = pts[i + 1]
        // cpx: punto de control en X, a mitad del camino entre los dos puntos
        const cpx = p0.x + (p1.x - p0.x) / 2
        // Curva Bezier cúbica: control point1, control point2, destino
        d.push(`C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`)
    }
    return d.join(' ')
}