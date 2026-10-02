// El logo que se sube en el alta se guarda achicado: un cuadrado de 256 px,
// recortado al centro. Así entra en el almacenamiento del navegador (que es
// donde vive la demo) y se ve nítido en el círculo del sitio, que nunca pasa
// de 120 px.
export function achicarLogo(archivo: File, lado = 256): Promise<string> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const lienzo = document.createElement('canvas')
      lienzo.width = lado
      lienzo.height = lado
      const ctx = lienzo.getContext('2d')
      if (!ctx) { mal(new Error('sin canvas')); return }
      // Un SVG sin medidas propias llega con ancho y alto en cero: se dibuja entero.
      const corte = Math.min(img.naturalWidth, img.naturalHeight)
      if (corte > 0) ctx.drawImage(img, (img.naturalWidth - corte) / 2, (img.naturalHeight - corte) / 2, corte, corte, 0, 0, lado, lado)
      else ctx.drawImage(img, 0, 0, lado, lado)
      // WebP conserva la transparencia y pesa poco; el navegador que no lo sepa escribir devuelve PNG.
      ok(lienzo.toDataURL('image/webp', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('no es una imagen')) }
    img.src = url
  })
}

// Una foto de portada subida desde el panel: se achica a 1280 px de ancho para
// que entre en el almacenamiento del navegador y la vea también el sitio.
export function achicarFoto(archivo: File, ancho = 1280): Promise<string> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const k = Math.min(1, ancho / Math.max(1, img.naturalWidth))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.max(1, Math.round(img.naturalWidth * k))
      lienzo.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = lienzo.getContext('2d')
      if (!ctx) { mal(new Error('sin canvas')); return }
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      ok(lienzo.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('no es una imagen')) }
    img.src = url
  })
}
