// Abre una ventana VISIBLE en el login de Órbita para que la PERSONA se loguee.
// (Un agente nunca escribe contraseñas en producción.) Cuando la URL llega al
// panel, la sesión queda guardada en el perfil persistente compartido y la
// ventana se cierra. Correr en segundo plano y avisarle a la persona.
//   node herramientas/login.mjs
import { abrirSesion } from './lib/sesion.mjs'

const LOGIN = process.env.LOGIN_URL ?? 'https://www.orbita.site/login'
const { ctx, page } = await abrirSesion({ headless: false })
await page.goto(LOGIN)
await page.bringToFront()
console.log('Ventana abierta en', LOGIN, '— esperando que la persona entre al panel…')
let ultima = ''
const limite = Date.now() + 40 * 60_000
let url = ''
while (Date.now() < limite && !url) {
  for (const p of ctx.pages()) {
    const u = p.url().replace(/[?#].*/, '')
    if (u !== ultima) { ultima = u; console.log('URL:', u) }
    if (/\/(panel|admin)(\/|$)/.test(new URL(p.url()).pathname + '/')) url = p.url()
  }
  await new Promise(r => setTimeout(r, 1000))
}
if (!url) { console.log('No se detectó el login en 40 minutos.'); await ctx.close(); process.exit(1) }
await new Promise(r => setTimeout(r, 5000))
console.log('Login OK:', ctx.pages().map(p => p.url()).find(u => /orbita\.site/.test(u)) ?? url)
await ctx.close()
