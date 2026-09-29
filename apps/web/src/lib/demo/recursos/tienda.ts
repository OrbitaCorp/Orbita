// Escrituras públicas de la tienda demo que se resuelven en el navegador (el
// servidor las rechaza: ver DemoGuard en la API).
import { registrar } from '../interceptor'

// Las visitas de la demo no suman a las métricas de nadie.
registrar({ metodo: 'POST', ruta: /^\/storefront\/[^/]+\/visit$/, lado: 'tienda', responder: async () => ({ ok: true }) })
