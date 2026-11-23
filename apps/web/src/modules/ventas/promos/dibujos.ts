// Piezas de dibujo de las temáticas, como texto SVG. Son funciones puras y sin
// datos del usuario: lo único variable que llega a un <text> pasa por
// `escaparTexto`. Van como texto y no como JSX porque una escena junta decenas
// de figuras y se dibuja también en cada miniatura de la galería.

export const escaparTexto = (s: string) =>
    s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))

export const circ = (x: number | string, y: number | string, r: number, f: string, e = '') =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${e}/>`

export const corazon = (x: number, y: number, s: number, f: string) =>
    `<path transform="translate(${x} ${y}) scale(${s})" fill="${f}" d="M0 13C-9 5-14 1-14-5c0-4 3-7 7-7 3 0 5 2 7 4 2-2 4-4 7-4 4 0 7 3 7 7 0 6-5 10-14 18z"/>`

export function estrella(x: number, y: number, r: number, f: string) {
    let d = ''
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r
        d += (i ? 'L' : 'M') + (x + q * Math.cos(a)).toFixed(1) + ' ' + (y + q * Math.sin(a)).toFixed(1)
    }
    return `<path d="${d}z" fill="${f}"/>`
}

export const copo = (x: number, y: number, r: number, f: string) =>
    `<path stroke="${f}" stroke-width="1.5" stroke-linecap="round" fill="none" d="M${x - r} ${y}H${x + r}M${x - r * 0.5} ${y - r * 0.87}L${x + r * 0.5} ${y + r * 0.87}M${x - r * 0.5} ${y + r * 0.87}L${x + r * 0.5} ${y - r * 0.87}"/>`

export const pino = (x: number, y: number, h: number, f: string) =>
    `<path fill="${f}" d="M${x} ${y - h}l${h * 0.34} ${h * 0.46}h${-h * 0.15}l${h * 0.26} ${h * 0.4}H${x - h * 0.41}l${h * 0.26} ${-h * 0.4}h${-h * 0.15}z"/><rect x="${x - 3}" y="${y - h * 0.15}" width="6" height="${h * 0.15}" fill="#5c3b28"/>`

export const huevo = (x: number, y: number, s: number, f: string, b: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="11" ry="14" fill="${f}"/><path d="M-10.5 -2l3.5 3 3.5-3 3.5 3 3.5-3 3.5 3 3-3" stroke="${b}" stroke-width="2" fill="none"/></g>`

export const calabaza = (x: number, y: number, s: number, f = '#FF8A1F') =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-8" rx="8" ry="11" fill="${f}"/><ellipse cx="8" rx="8" ry="11" fill="${f}"/><ellipse rx="8" ry="12" fill="${f}" stroke="rgba(0,0,0,.2)"/><rect x="-1.5" y="-16" width="3" height="5" fill="#3f6b2b"/></g>`

export const murcielago = (x: number, y: number, s: number, f: string) =>
    `<path transform="translate(${x} ${y}) scale(${s})" fill="${f}" d="M0 3c-2-4-3-5-3-7l1.5 1.5L0-3l1.5-.5L3-5c0 2-1 3-3 8zM-3-1c-4-3-9-3-13 1 3 0 4 2 5 3 1-1 3-1 4 1 1-2 3-2 4-1zM3-1c4-3 9-3 13 1-3 0-4 2-5 3-1-1-3-1-4 1-1-2-3-2-4-1z"/>`

export const globo = (x: number, y: number, s: number, f: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 16q-4 8 1 16" stroke="rgba(0,0,0,.35)" fill="none"/><ellipse rx="12" ry="15" fill="${f}"/><path d="M-3 15h6l-3-3z" fill="${f}"/></g>`

export function flor(x: number, y: number, r: number, f: string, c: string) {
    let o = ''
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 0.4 - Math.PI / 2
        o += circ((x + r * Math.cos(a)).toFixed(1), (y + r * Math.sin(a)).toFixed(1), +(r * 0.72).toFixed(2), f)
    }
    return o + circ(x, y, +(r * 0.55).toFixed(2), c)
}

export const nube = (x: number, y: number, s: number, f: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${f}"><circle cx="-14" r="10"/><circle cy="-6" r="14"/><circle cx="15" r="9"/><rect x="-24" width="48" height="10" rx="5"/></g>`

export function sol(x: number, y: number, r: number, f: string) {
    let o = ''
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6
        o += `<path stroke="${f}" stroke-width="3" stroke-linecap="round" d="M${(x + r * 1.3 * Math.cos(a)).toFixed(1)} ${(y + r * 1.3 * Math.sin(a)).toFixed(1)}L${(x + r * 1.65 * Math.cos(a)).toFixed(1)} ${(y + r * 1.65 * Math.sin(a)).toFixed(1)}"/>`
    }
    return o + circ(x, y, r, f)
}

export function banderines(y: number, cs: string[]) {
    let o = `<path d="M0 ${y}Q200 ${y + 26} 400 ${y}" stroke="rgba(0,0,0,.35)" fill="none"/>`
    for (let i = 0; i < 13; i++) {
        const x = 8 + i * 31, t = x / 400, yy = y + 4 * 26 * t * (1 - t) * 0.5
        o += `<path d="M${x} ${yy.toFixed(1)}h22l-11 20z" fill="${cs[i % cs.length]}"/>`
    }
    return o
}

export function luces(y: number, cs: string[]) {
    let o = `<path d="M0 ${y}Q100 ${y + 26} 200 ${y}T400 ${y}" stroke="#0b1f19" stroke-width="1.5" fill="none"/>`
    for (let i = 0; i < 16; i++) {
        const x = 12 + i * 25, u = (x % 200) / 200, s = x < 200 ? 1 : -1
        o += circ(x, (y + s * 4 * 13 * u * (1 - u) + 5).toFixed(1), 4, cs[i % cs.length])
    }
    return o
}

// Sin Math.random: el dibujo tiene que ser igual en el servidor y en el cliente.
export function papelitos(cs: string[], n = 38) {
    let o = ''
    for (let i = 0; i < n; i++) {
        const x = (i * 83 + 17) % 400, y = (i * 47 + 9) % 175
        o += `<rect x="${x}" y="${y}" width="${4 + (i % 3) * 2}" height="4" rx="1" fill="${cs[i % cs.length]}" transform="rotate(${(i * 37) % 90} ${x} ${y})"/>`
    }
    return o
}

export function fuego(x: number, y: number, r: number, f: string) {
    let o = ''
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6
        o += `<path stroke="${f}" stroke-width="2" stroke-linecap="round" d="M${(x + r * 0.35 * Math.cos(a)).toFixed(1)} ${(y + r * 0.35 * Math.sin(a)).toFixed(1)}L${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}"/>`
        o += circ((x + r * 1.15 * Math.cos(a)).toFixed(1), (y + r * 1.15 * Math.sin(a)).toFixed(1), 1.6, f)
    }
    return o
}

export const corbata = (x: number, y: number, s: number, f: string, b: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-5-16h10l-2 6 5 24-8 8-8-8 5-24z" fill="${f}"/><path d="M-3-10l7 7M-4.5 2l9 9" stroke="${b}" stroke-width="2"/></g>`

export function estrellitas(f: string, n = 20) {
    let o = ''
    for (let i = 0; i < n; i++) o += circ((i * 71 + 13) % 400, (i * 37 + 7) % 150, i % 3 ? 0.9 : 1.5, f, 'opacity=".8"')
    return o
}
