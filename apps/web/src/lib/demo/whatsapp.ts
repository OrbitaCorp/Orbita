// Banner de WhatsApp de la tienda demo: en vez de "consultanos por un
// producto" (la demo no tiene a quién consultar), invita a tener la tienda
// propia y escribe al WhatsApp de Órbita. El número viene de
// NEXT_PUBLIC_DEMO_WHATSAPP (formato wa.me: 549 + característica + número);
// sin número, el banner no aparece. Solo cambia este banner: el resto de la
// tienda demo sigue sin WhatsApp, así las consultas de productos o de
// pedidos simulados no le llegan a Órbita.
import type { TextosWpp } from '@/components/storefront/WhatsappBanner'

export const DEMO_WHATSAPP = (process.env.NEXT_PUBLIC_DEMO_WHATSAPP ?? '').replace(/\D/g, '')

export const MENSAJE_WHATSAPP_DEMO = 'Hola! Vi la demo de Órbita y quiero tener mi propia tienda.'

export const TEXTOS_WHATSAPP_DEMO: TextosWpp = {
  badge: 'Demo de Órbita',
  titulo: '¿Te gustó la demo?\n¿Qué esperás para tener tu tienda?',
  texto: 'Todo lo que ves acá lo arma cada negocio desde su panel de Órbita, sin programar. Escribinos y te ayudamos a tener la tuya.',
  boton: 'Quiero mi tienda',
  stats: [],
  chat: [
    'Hola! Vi la demo de Nébula Tech 👀 ¿Puedo tener una tienda así?',
    '¡Claro! Te ayudamos a armarla y después la manejás vos desde tu panel.',
    '¡Genial, arranquemos! 🚀',
  ],
}
