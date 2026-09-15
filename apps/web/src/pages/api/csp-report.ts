import type { NextApiRequest, NextApiResponse } from 'next'
import { resumirReporteCsp } from '@/lib/csp'

// POST /api/csp-report
// Receptor de los reportes de la Content-Security-Policy en modo Report-Only
// (auditoría interna 10/09, hallazgo csp-scripts; la política la emite
// src/middleware.ts). Cada violación queda como UNA línea de console.warn con
// el prefijo "[csp]", que es lo que hay que filtrar en Vercel → Logs para
// revisar la semana de reportes antes de pasar la política a bloqueante.
//
// Deliberadamente no persiste nada ni exige auth: lo manda el navegador del
// visitante sin sesión, sin cookies de auth y sin que la página pueda
// intervenir. Tampoco distingue formatos por Content-Type: acepta
// application/csp-report (report-uri, todos los navegadores) y
// application/reports+json (Reporting API) — resumirReporteCsp reconoce los
// dos. Responde 204 siempre, incluso a basura: devolverle un error a un
// navegador que no lee la respuesta no sirve para nada.
//
// Tope de 8 KB: un reporte real pesa menos de 1 KB; el límite corta a
// cualquiera que quiera usar el endpoint para inflar los logs (Next responde
// 413 solo y no llega al handler). Next no parsea estos Content-Type, así
// que req.body llega como string crudo — el helper lo parsea.
export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } },
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const lineas = resumirReporteCsp(req.body)
  if (lineas.length === 0) {
    console.warn('[csp] reporte ilegible', `content-type=${req.headers['content-type'] ?? '-'}`)
  }
  for (const linea of lineas) console.warn('[csp]', linea)

  return res.status(204).end()
}
