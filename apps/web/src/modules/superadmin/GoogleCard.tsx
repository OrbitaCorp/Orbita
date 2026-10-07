import { useState } from 'react'
import { platformApi, type GoogleResumen, type GoogleSincronizacion } from '@/lib/platform/api'
import { Card, Chip, Empty, Grid, Kpi, Loader, Table, btnGhostSm, date, useFetch } from './ui'

// "Cómo te ve Google" de una tienda (orbita.site/superadmin/negocios/:id): lo que
// Search Console sabe de ella y el botón para verificar su dominio y enviarle el
// sitemap ahora, sin esperar a la corrida de la noche. El detalle de qué hace cada
// cosa está en apps/api/src/search-console/search-console.service.ts.

const VEREDICTOS: Record<string, string> = {
  PASS: 'La portada está en el índice de Google',
  PARTIAL: 'Google la tiene indexada con observaciones',
  NEUTRAL: 'Google la conoce, pero decidió no indexarla',
  FAIL: 'Google no la indexó',
  VERDICT_UNSPECIFIED: 'Google todavía no tiene datos de la portada',
}

const entero = (n: number) => n.toLocaleString('es-AR')
const porcentaje = (n: number) => `${(n * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
const posicion = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

/** Lo que devolvió "Enviar a Google", en una línea por cosa, para que se vea qué pasó. */
function lineasDeSincronizacion(r: GoogleSincronizacion): string[] {
  if (!r.configurado) return ['Search Console no está configurado en este entorno.']
  const lineas = r.dominios.map((d) => {
    if (d.estado === 'verificado') return `${d.domain}: verificado en Google y sitemap enviado.`
    if (d.estado === 'pendiente') return `${d.domain}: pendiente. ${d.mensaje ?? ''}`.trim()
    return `${d.domain}: ${d.estado === 'inactivo' ? 'todavía no está activo.' : 'Search Console no está configurado.'}`
  })
  if (r.subdominio) lineas.push(r.subdominio.ok ? 'Sitemap del subdominio enviado a Google.' : `Sitemap del subdominio: ${r.subdominio.mensaje ?? 'no se pudo enviar.'}`)
  return lineas
}

export function GoogleCard({ businessId }: { businessId: string }) {
  const [recarga, setRecarga] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string[] | null>(null)
  const { data: g, error, loading } = useFetch(() => platformApi.businessSearchConsole(businessId), [businessId, recarga])

  const enviar = async () => {
    setEnviando(true)
    setResultado(null)
    try {
      setResultado(lineasDeSincronizacion(await platformApi.syncBusinessSearchConsole(businessId)))
    } catch {
      setResultado(['No se pudo enviar a Google. Probá de nuevo en un rato.'])
    } finally {
      setEnviando(false)
      setRecarga((k) => k + 1)
    }
  }

  return (
    <Card
      title="Cómo te ve Google"
      subtitle="Search Console: dirección verificada, sitemap y búsquedas de los últimos 28 días"
      action={g?.configurado ? (
        <button onClick={enviar} disabled={enviando} className="ds-hover" style={{ ...btnGhostSm, opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Enviando…' : 'Enviar a Google'}
        </button>
      ) : undefined}
    >
      {loading && !g ? <Loader /> : error || !g ? <Empty text="No se pudo consultar Search Console." /> : <Contenido g={g} resultado={resultado} />}
    </Card>
  )
}

function Contenido({ g, resultado }: { g: GoogleResumen; resultado: string[] | null }) {
  if (!g.configurado) return <Empty text="Search Console no está configurado en este entorno." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {resultado && (
        <div style={{ fontSize: 13, color: 'var(--color-body)', background: 'var(--color-surface)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {resultado.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
        {g.dominioPropio ? (
          <Linea
            etiqueta="Dominio propio"
            valor={<span style={{ fontFamily: '"Geist Mono", monospace' }}>{g.dominioPropio.domain}</span>}
            chip={<Chip text={g.dominioPropio.estado === 'VERIFICADO' ? 'Verificado' : 'Sin verificar'} tone={g.dominioPropio.estado === 'VERIFICADO' ? 'green' : 'amber'} dot />}
            nota={g.dominioPropio.estado === 'VERIFICADO'
              ? (g.dominioPropio.sitemapEnviadoAt ? `Sitemap enviado el ${date(g.dominioPropio.sitemapEnviadoAt)}` : 'Sitemap sin enviar')
              : (g.dominioPropio.error ?? 'Esperando que la portada muestre la etiqueta de verificación')}
          />
        ) : (
          <Linea
            etiqueta="Subdominio"
            valor={<span style={{ fontFamily: '"Geist Mono", monospace' }}>{g.origen?.replace('https://', '') ?? '—'}</span>}
            chip={<Chip text={g.sitemapSubdominioAt ? 'Sitemap enviado' : 'Sitemap sin enviar'} tone={g.sitemapSubdominioAt ? 'green' : 'gray'} dot />}
            nota={g.sitemapSubdominioAt ? `El ${date(g.sitemapSubdominioAt)}` : 'Se envía solo cuando la tienda está publicada y tiene productos'}
          />
        )}
        {g.inicio && (
          <Linea
            etiqueta="Portada"
            valor={VEREDICTOS[g.inicio.veredicto ?? 'VERDICT_UNSPECIFIED'] ?? g.inicio.estado ?? '—'}
            nota={[g.inicio.estado, g.inicio.ultimoRastreo ? `último rastreo ${date(g.inicio.ultimoRastreo)}` : null].filter(Boolean).join(' · ') || undefined}
          />
        )}
      </div>

      {g.aviso && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{g.aviso}</div>}

      {g.rendimiento && g.periodo && (
        <>
          <Grid small>
            <Kpi label="Clics desde Google" value={entero(g.rendimiento.clics)} />
            <Kpi label="Veces que apareció" value={entero(g.rendimiento.impresiones)} />
            <Kpi label="Clics sobre apariciones" value={porcentaje(g.rendimiento.ctr)} />
            <Kpi label="Posición media" value={posicion(g.rendimiento.posicion)} />
          </Grid>
          <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: -10 }}>
            Del {date(g.periodo.desde)} al {date(g.periodo.hasta)}. Google publica los datos con 2 o 3 días de demora, y una tienda nueva puede tardar semanas en recibir clics.
          </div>
        </>
      )}

      {g.consultas.length > 0 && (
        <Table
          head={['Búsqueda', 'Clics', 'Apariciones', 'Posición']}
          alignRight={[1, 2, 3]}
          rows={g.consultas.map((c) => ({ key: c.consulta, cells: [c.consulta, entero(c.clics), entero(c.impresiones), posicion(c.posicion)] }))}
        />
      )}
      {g.paginas.length > 0 && (
        <Table
          head={['Página', 'Clics', 'Apariciones']}
          alignRight={[1, 2]}
          rows={g.paginas.map((p) => ({
            key: p.url,
            cells: [<span key="u" style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12.5 }}>{(g.origen ? p.url.replace(g.origen, '') : p.url) || '/'}</span>, entero(p.clics), entero(p.impresiones)],
          }))}
        />
      )}

      {g.errores.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {g.errores.map((e, i) => <span key={i}>{e}</span>)}
        </div>
      )}
    </div>
  )
}

function Linea({ etiqueta, valor, chip, nota }: { etiqueta: string; valor: React.ReactNode; chip?: React.ReactNode; nota?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ width: 110, color: 'var(--color-muted)', fontSize: 12.5, flexShrink: 0 }}>{etiqueta}</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{valor}</span>
      {chip}
      {nota && <span style={{ color: 'var(--color-muted)', fontSize: 12.5 }}>{nota}</span>}
    </div>
  )
}
