import { Fragment, type ReactNode } from 'react'

// El texto de un mensaje con el formato de WhatsApp: *negrita*, _cursiva_, ~tachado~, `código` y ```bloque```, más los links
// tocables. Orbi (y cualquiera desde la app) escribe así, y WhatsApp lo muestra con estilo, no con los símbolos.
// Todo se arma con elementos de React, nunca con HTML crudo: lo que escribe un cliente no puede inyectar nada.

// Un marcador abre solo pegado a una palabra y cierra pegado a una palabra: "2*3" o "snake_case_x" no se formatean.
const NO_LETRA_ATRAS = '(?<![\\p{L}\\p{N}])'
const NO_LETRA_ADELANTE = '(?![\\p{L}\\p{N}])'
const marca = (c: string) => `${NO_LETRA_ATRAS}${c}(?=\\S)([^${c}\\n]*?\\S)${c}${NO_LETRA_ADELANTE}`
const PATRON = new RegExp(
  [
    '```([\\s\\S]+?)```', // 1: bloque
    '`([^`\\n]+)`', //       2: código en línea
    marca('\\*'), //         3: negrita
    marca('_'), //           4: cursiva
    marca('~'), //           5: tachado
    '(https?:\\/\\/[^\\s<>]+)', // 6: link
  ].join('|'),
  'gu',
)

/** Saca la puntuación que suele venir pegada al final de un link ("...mirá https://x.com/p/1." → sin el punto). */
const SOBRANTE = /[.,;:!?)\]»”’"']+$/

export function formatearWhatsapp(texto: string, clave = 'f'): ReactNode[] {
  const salida: ReactNode[] = []
  let desde = 0
  let n = 0
  for (const m of texto.matchAll(PATRON)) {
    const inicio = m.index ?? 0
    if (inicio > desde) salida.push(texto.slice(desde, inicio))
    const k = `${clave}${n++}`
    if (m[1] !== undefined) salida.push(<code key={k} className="wa-fmt-bloque">{m[1].replace(/^\n/, '')}</code>)
    else if (m[2] !== undefined) salida.push(<code key={k} className="wa-fmt-codigo">{m[2]}</code>)
    else if (m[3] !== undefined) salida.push(<strong key={k}>{formatearWhatsapp(m[3], `${k}-`)}</strong>)
    else if (m[4] !== undefined) salida.push(<em key={k}>{formatearWhatsapp(m[4], `${k}-`)}</em>)
    else if (m[5] !== undefined) salida.push(<s key={k}>{formatearWhatsapp(m[5], `${k}-`)}</s>)
    else if (m[6] !== undefined) {
      const url = m[6].replace(SOBRANTE, '')
      salida.push(<a key={k} className="wa-fmt-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>)
      if (url.length < m[6].length) salida.push(m[6].slice(url.length))
    }
    desde = inicio + m[0].length
  }
  if (desde < texto.length) salida.push(texto.slice(desde))
  return salida
}

export function FormatoWhatsapp({ texto }: { texto: string }) {
  return <Fragment>{formatearWhatsapp(texto)}</Fragment>
}
