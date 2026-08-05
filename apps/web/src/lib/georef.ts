// apps/web/src/lib/georef.ts
//
// Cliente de la API pública Georef (Ministerio del Interior — apis.datos.gob.ar/georef):
// normaliza direcciones argentinas y devuelve provincia/localidad. Gratuita, sin API key,
// CORS abierto (Access-Control-Allow-Origin: *) — se llama directo desde el browser, sin
// pasar por nuestro backend. NO devuelve código postal (ver docs de la API): ese campo del
// form de direcciones sigue siendo manual.
//
// Es un asistente de autocompletado, no una validación: si no encuentra nada o falla, el
// usuario sigue pudiendo cargar la dirección a mano sin que nada lo bloquee.

const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api'

export type GeorefDireccion = {
  nomenclatura: string
  calle: string
  altura: number | null
  provincia: string
  ciudad: string
}

type GeorefApiResponse = {
  direcciones: Array<{
    nomenclatura: string
    calle: { nombre: string | null }
    altura: { valor: number | null } | null
    provincia: { nombre: string | null }
    localidad_censal: { nombre: string | null }
  }>
}

export async function buscarDireccion(
  texto: string,
  opts: { max?: number; signal?: AbortSignal } = {},
): Promise<GeorefDireccion[]> {
  const query = texto.trim()
  if (query.length < 5) return [] // muy corto, no vale la pena pegarle a la API

  try {
    const qs = new URLSearchParams({ direccion: query, max: String(opts.max ?? 5) })
    const res = await fetch(`${GEOREF_BASE}/direcciones?${qs.toString()}`, { signal: opts.signal })
    if (!res.ok) return [] // fallo silencioso: es autocompletado, no bloquea el form

    const data = (await res.json().catch(() => null)) as GeorefApiResponse | null
    if (!data?.direcciones) return []

    return data.direcciones.map((d) => ({
      nomenclatura: d.nomenclatura,
      calle: d.calle.nombre ?? '',
      altura: d.altura?.valor ?? null,
      provincia: d.provincia.nombre ?? '',
      ciudad: d.localidad_censal.nombre ?? '',
    }))
  } catch {
    return [] // fallo silencioso: network error, AbortError, o cualquier otra excepción
  }
}
