// Chequeo de las plantillas de Home.
//
// Pegar en la consola del panel, en:
//   /admin/{negocioId}/ventas/avanzado?vista=plantillas
// parado en la GALERÍA (no adentro de una plantilla).
//
// Va de a una (__chequear(0..19), una por plantilla) a propósito: varias
// juntas tardan más de 45s y se cortan por el timeout de CDP. De a tres entra.
//
// Tiene que dar, en escritorio y celular:
//   rotas: 0        ninguna foto rota
//   desborda: false ninguna barra horizontal
//   ocultas: 0      ninguna sección que quede sin revelar
//
// `acciones: false` en Celular es correcto: ahí las acciones de tienda se
// dibujan como íconos (cuenta y bolsa), sin la palabra "Ingresar".
//
// `ocultas` mira la CLASE `pl-on`, no la opacidad calculada. Medir por
// opacidad daba las secciones "ocultas" aunque el reveal hubiera disparado
// bien: si la ventana no está pintando (Browser pane escondido, ventana sin
// foco), Chrome no avanza la transición CSS y getComputedStyle devuelve el 0
// del estado inicial para siempre. La clase es lo que el reveal realmente
// controla, y no depende del compositor.

window.__chequear = async function (i) {
  // Con la pestaña en segundo plano Chrome congela timers e
  // IntersectionObserver: el reveal no dispara y `ocultas` miente.
  if (document.visibilityState !== 'visible') {
    return { error: 'la pestaña está en segundo plano — traela al frente y repetí' }
  }
  const btns = () => [...document.querySelectorAll('button')]

  // El marco (Notebook/Celular) es el ancestro que realmente scrollea.
  const cont = () =>
    [...document.querySelectorAll('div')]
      .filter(d => {
        const o = getComputedStyle(d).overflowY
        return (o === 'auto' || o === 'scroll') && d.scrollHeight > 700
      })
      .sort((a, z) => z.scrollHeight - a.scrollHeight)[0]

  const ver = btns().filter(b => b.textContent.includes('Ver cómo queda'))
  if (!ver[i]) return { error: 'no hay tarjeta ' + i + ' (¿estás en la galería?)' }

  ver[i].click()
  await new Promise(x => setTimeout(x, 900))
  const titulo = document.querySelector('h1').textContent

  const filas = {}
  for (const modo of ['Computadora', 'Celular']) {
    const b = btns().find(x => x.textContent.trim() === modo)
    if (b) b.click()
    await new Promise(x => setTimeout(x, 700))

    const c = cont()
    if (!c) { filas[modo] = 'sin marco'; continue }

    // Scrollear hasta el fondo y esperar más que el respaldo del Reveal
    // (2500ms), para que nada quede sin revelar por una animación pendiente.
    c.scrollTop = c.scrollHeight
    await new Promise(x => setTimeout(x, 2500))

    const imgs = [...c.querySelectorAll('img')]
    filas[modo] = {
      alto: c.scrollHeight,
      desborda: c.scrollWidth > c.clientWidth + 1,
      fotos: imgs.length,
      rotas: imgs.filter(im => im.complete && im.naturalWidth === 0).length,
      ocultas: [...c.querySelectorAll('.pl-reveal')].filter(e => !e.classList.contains('pl-on')).length,
      acciones: c.innerText.includes('Ingresar'),
    }
    c.scrollTop = 0
  }

  const volver = btns().find(b => b.textContent.trim() === 'Plantillas')
  if (volver) volver.click()
  await new Promise(x => setTimeout(x, 700))

  return { [titulo]: filas }
}

// Uso: de a una, o de a dos por llamada.
//   await window.__chequear(0)
//   Object.assign(await window.__chequear(1), await window.__chequear(2))
