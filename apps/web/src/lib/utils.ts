// Funciones utilitarias genéricas usadas en todo el frontend.


// (Fase 4 — Ale) Los hubs del panel muestran un solo Toast al pie y le pasan
// tanto los mensajes de éxito como los de error por el mismo canal (onToast).
// Este helper decide la variante mirando el texto, así un "No se pudo…" sale en
// rojo y no con tilde verde de éxito. Cubre los mensajes de error que produce
// el panel (los "No se pudo/pudieron…") y los de ApiError más comunes.
export function toastEsError(mensaje: string): boolean {
    return /no se pud|no se pudieron|^error|falló|fallo|inválid|invalid|supera|no tiene|no se encontr|no quedan|no se pueden|ya está|ya es |debé|debe /i.test(mensaje)
}

// Formatea un número como precio argentino con signo $
// Ej: 124300 → "$124.300"
export function fmtMoney(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-AR')
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