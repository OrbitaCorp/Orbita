import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CSP_REPORT_PATH, TEMA_SCRIPT, armarCspReportOnly, origenDeUrl, resumirReporteCsp, sha256Base64 } from '../csp'

// Hallazgo csp-scripts (auditoría interna 10/09): la web emite una CSP en
// modo Report-Only desde el middleware, con el script inline de tema
// autorizado por hash. Lo que se prueba acá es lo que no puede desviarse
// sin romper la medición: el hash, la forma de la política y el resumen
// que va a los logs.

describe('TEMA_SCRIPT', () => {
  it('es estático: no interpola nada y lee sus parámetros del propio <script>', () => {
    // Un `${` suelto delataría que alguien volvió a interpolar un valor —
    // eso haría que el script (y su hash) cambie por página.
    expect(TEMA_SCRIPT).not.toContain('${')
    expect(TEMA_SCRIPT).toContain('document.currentScript')
    expect(TEMA_SCRIPT).toContain("getAttribute('data-root-domain')")
    expect(TEMA_SCRIPT).toContain("getAttribute('data-color-mode')")
  })
})

describe('sha256Base64', () => {
  it('coincide con node:crypto (mismo formato que pide CSP)', async () => {
    const esperado = createHash('sha256').update(TEMA_SCRIPT, 'utf8').digest('base64')
    expect(await sha256Base64(TEMA_SCRIPT)).toBe(esperado)
    // Vector conocido: sha256("abc") en base64.
    expect(await sha256Base64('abc')).toBe(createHash('sha256').update('abc').digest('base64'))
  })
})

describe('armarCspReportOnly', () => {
  const politica = armarCspReportOnly({ hashTema: 'HASH', apiOrigin: 'https://api.orbita.site' })
  const directiva = (nombre: string) => politica.split('; ').find(d => d.startsWith(`${nombre} `))

  it('autoriza scripts propios y el de tema por hash, sin unsafe-inline ni unsafe-eval', () => {
    expect(directiva('script-src')).toBe("script-src 'self' 'sha256-HASH'")
    expect(directiva('script-src')).not.toContain('unsafe')
  })

  it('deja conectar a la API, Supabase, Nominatim y datos.gob.ar', () => {
    expect(directiva('connect-src')).toBe(
      "connect-src 'self' https://api.orbita.site https://*.supabase.co https://nominatim.openstreetmap.org https://apis.datos.gob.ar",
    )
  })

  it('sin origen de API parseable no inventa uno', () => {
    const sinApi = armarCspReportOnly({ hashTema: 'HASH', apiOrigin: null })
    expect(sinApi).toContain("connect-src 'self' https://*.supabase.co")
  })

  it('imágenes, estilos, fuentes, frames y el receptor de reportes', () => {
    expect(directiva('img-src')).toBe("img-src 'self' data: blob: https:")
    expect(directiva('style-src')).toBe("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
    expect(directiva('font-src')).toBe("font-src 'self' data: https://fonts.gstatic.com")
    expect(directiva('frame-src')).toBe("frame-src 'self'")
    expect(directiva('report-uri')).toBe(`report-uri ${CSP_REPORT_PATH}`)
    expect(CSP_REPORT_PATH).toBe('/api/csp-report')
  })
})

describe('origenDeUrl', () => {
  it('se queda con scheme + host + puerto', () => {
    expect(origenDeUrl('https://api.orbita.site/api/v1')).toBe('https://api.orbita.site')
    expect(origenDeUrl('http://localhost:3000/api/v1')).toBe('http://localhost:3000')
  })

  it('null si no hay URL o no parsea', () => {
    expect(origenDeUrl(undefined)).toBeNull()
    expect(origenDeUrl('no es una url')).toBeNull()
  })
})

describe('resumirReporteCsp', () => {
  it('formato report-uri (application/csp-report), como string crudo', () => {
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://tienda.orbita.site/',
        'violated-directive': 'script-src',
        'effective-directive': 'script-src',
        'blocked-uri': 'https://evil.example/x.js',
        'line-number': 12,
        'disposition': 'report',
      },
    })
    expect(resumirReporteCsp(body)).toEqual([
      'document-uri=https://tienda.orbita.site/ effective-directive=script-src blocked-uri=https://evil.example/x.js line-number=12 disposition=report',
    ])
  })

  it('formato Reporting API (application/reports+json), varios reportes', () => {
    const body = [
      { type: 'csp-violation', body: { documentURL: 'https://orbita.site/login', effectiveDirective: 'connect-src', blockedURL: 'https://a.example' } },
      { type: 'csp-violation', body: { documentURL: 'https://orbita.site/', effectiveDirective: 'img-src', blockedURL: 'http://b.example/i.png' } },
    ]
    expect(resumirReporteCsp(body)).toEqual([
      'document-uri=https://orbita.site/login effective-directive=connect-src blocked-uri=https://a.example',
      'document-uri=https://orbita.site/ effective-directive=img-src blocked-uri=http://b.example/i.png',
    ])
  })

  it('recorta campos largos y la línea entera', () => {
    const largo = 'x'.repeat(5000)
    const [linea] = resumirReporteCsp({ 'csp-report': { 'blocked-uri': largo, 'script-sample': largo, 'source-file': largo, 'document-uri': largo } })
    expect(linea.length).toBeLessThanOrEqual(701)
    expect(linea).toContain(`blocked-uri=${'x'.repeat(200)}…`)
  })

  it('basura o JSON inválido → sin líneas (el endpoint igual responde 204)', () => {
    expect(resumirReporteCsp('{no es json')).toEqual([])
    expect(resumirReporteCsp(42)).toEqual([])
    expect(resumirReporteCsp({ nada: true })).toEqual([])
    expect(resumirReporteCsp(undefined)).toEqual([])
  })
})
