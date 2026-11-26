// "Ganancias de Airbnb", en la pantalla de Airbnb de un alojamiento real: el
// dueño elige el archivo que descargó de Airbnb, ve qué trae, dice a qué
// propiedad corresponde cada aviso y lo importa. Con eso las Estadísticas
// cuentan esa plata, esas noches y esos huéspedes.
//
// El archivo se abre acá como texto y se manda al servidor, que es el que lo
// lee (dos veces: para la vista previa y para guardar). Acá no se interpreta
// nada. Si el servidor no lo entiende, dice por qué y no guarda.
import { useRef, useState } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { fechaCorta } from '@/lib/reservas/fechas'
import { Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { cuenta } from '../../datos'
import { hace } from '../../datos/textos'
import type { Ganancias } from '../../datos/origen'
import type { VistaPreviaApi } from '../../datos/origen/alquileresApi'
import { ejecutar, type Avisar } from '../acciones'
import { BotonConfirmar } from '../piezas'
import { DEMASIADO_GRANDE, MAXIMO_BYTES_CSV, totalesTxt, unionesListas, unionesPropuestas, type Elegidas } from './ganancias'

const SIN_ELEGIR = ''
const NO_IMPORTAR = '__no__'
/** Cuántas filas que quedaron afuera se listan; el resto se cuenta. */
const A_LA_VISTA = 5

export default function GananciasAirbnb({ ganancias, propiedades, avisar }: { ganancias: Ganancias; propiedades: { id: string; nombre: string }[]; avisar: Avisar }) {
  const archivo = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const [vista, setVista] = useState<VistaPreviaApi | null>(null)
  const [elegidas, setElegidas] = useState<Elegidas>({})
  const [ocupado, setOcupado] = useState<'leer' | 'importar' | 'borrar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El "ahora" de esta sección, tomado al abrirla: alcanza para decir "hace 3 días".
  const [ahora] = useState(() => Date.now())
  const { resumen } = ganancias
  const uniones = vista ? unionesListas(vista.avisos, elegidas) : undefined
  const paraImportar = vista ? vista.avisos.filter(a => elegidas[a.nombre]).reduce((s, a) => s + a.estadias, 0) : 0

  const cerrar = () => { setTexto(null); setVista(null); setElegidas({}); setError(null) }

  const elegir = async (f: File | undefined) => {
    if (archivo.current) archivo.current.value = '' // para poder volver a elegir el mismo archivo
    if (!f || ocupado) return
    cerrar()
    if (f.size > MAXIMO_BYTES_CSV) { setError(DEMASIADO_GRANDE); return }
    setOcupado('leer')
    try {
      const leido = await f.text()
      const v = await ganancias.vistaPrevia(leido)
      setTexto(leido)
      setVista(v)
      setElegidas(unionesPropuestas(v.avisos, propiedades))
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo leer el archivo. Probá de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  const importar = async () => {
    if (!texto || !uniones || ocupado) return
    setOcupado('importar')
    let hecho = { creadas: 0, actualizadas: 0, sinImportar: 0 }
    const ok = await ejecutar(async () => { hecho = await ganancias.importar(texto, uniones) }, avisar, { real: true })
    setOcupado(null)
    if (!ok) return
    avisar('Ganancias importadas', `${cuenta(hecho.creadas, 'estadía nueva', 'estadías nuevas')}, ${cuenta(hecho.actualizadas, 'actualizada', 'actualizadas')}${hecho.sinImportar ? ` y ${hecho.sinImportar} sin importar` : ''}. Ya cuentan en Estadísticas.`)
    cerrar()
  }

  const borrar = async () => {
    if (ocupado) return
    setOcupado('borrar')
    await ejecutar(() => ganancias.borrar(), avisar, { real: true, texto: 'Se borró lo importado de Airbnb', detalle: 'Las estadísticas vuelven a contar solo las noches del calendario.' })
    setOcupado(null)
  }

  return (
    <Seccion titulo="Ganancias de Airbnb" bajada="El calendario trae las noches, no la plata. Con el archivo de ganancias, las Estadísticas suman lo que cobraste por Airbnb y las estadías de antes de conectar el calendario.">
      <ol className="ala-pasos" style={{ marginTop: 0 }}>
        <li>En Airbnb, andá a <b>Menú → Ingresos</b> (o “Historial de transacciones”).</li>
        <li>Descargá el archivo <b>CSV</b>, con todas las columnas, del período que quieras (hasta un año por archivo).</li>
        <li>Elegilo acá. Antes de guardar vas a ver qué trae.</li>
      </ol>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <input ref={archivo} type="file" accept=".csv,text/csv" hidden onChange={e => void elegir(e.target.files?.[0])} aria-label="Archivo de ganancias de Airbnb" />
        <button type="button" className="rv-btn rv-btn--primario" disabled={ocupado !== null} aria-busy={ocupado === 'leer'} onClick={() => archivo.current?.click()}>
          <FileUp size={15} aria-hidden /> {ocupado === 'leer' ? 'Leyendo…' : vista ? 'Elegir otro archivo' : 'Elegir archivo'}
        </button>
        <span className="rv-ayuda" style={{ margin: 0 }}>
          {resumen.estadias > 0
            ? `Última importación ${hace(resumen.ultimaImportacion ?? undefined, ahora)} · ${cuenta(resumen.estadias, 'estadía', 'estadías')}${resumen.hasta ? ` · hasta el ${fechaCorta(resumen.hasta)}` : ''}`
            : 'Todavía no importaste nada.'}
        </span>
      </div>
      {error && <p className="rv-error" role="alert" style={{ margin: '10px 0 0' }}>{error}</p>}

      {vista && (
        <div className="rv-pila" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          {vista.estadias === 0 ? (
            <Nota tono="aviso"><span>El archivo no trae ninguna estadía para importar.{vista.otrasFilas > 0 ? ` Tiene ${cuenta(vista.otrasFilas, 'fila', 'filas')} de pagos al banco, que no se importan.` : ''}</span></Nota>
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text)' }} role="status">
              <b>{cuenta(vista.estadias, 'estadía', 'estadías')}</b>
              {vista.desde && vista.hasta ? ` del ${fechaCorta(vista.desde)} al ${fechaCorta(vista.hasta)}` : ''} · <span className="rv-num">{totalesTxt(vista.totales)}</span>
              <span className="rv-ayuda" style={{ display: 'block', marginTop: 4 }}>
                Neto de la comisión de Airbnb.{vista.totales.length > 1 ? ' Cada moneda va por separado: no se suman.' : ''}{vista.otrasFilas > 0 ? ` Además hay ${cuenta(vista.otrasFilas, 'fila', 'filas')} de pagos al banco, que no se importan.` : ''}
              </span>
            </p>
          )}

          {vista.descartadas.length > 0 && (
            <Nota tono="aviso">
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{cuenta(vista.descartadas.length, 'fila quedó afuera', 'filas quedaron afuera')}</b>
                {vista.descartadas.slice(0, A_LA_VISTA).map(d => <span key={d.linea} style={{ display: 'block' }}>Fila {d.linea}: {d.motivo}</span>)}
                {vista.descartadas.length > A_LA_VISTA && <span style={{ display: 'block' }}>Y {vista.descartadas.length - A_LA_VISTA} más.</span>}
              </span>
            </Nota>
          )}

          {vista.avisos.map(a => (
            <Selector key={a.nombre} label={`¿Qué propiedad es “${a.nombre}”?`} ayuda={cuenta(a.estadias, 'estadía en el archivo', 'estadías en el archivo')}
              valor={elegidas[a.nombre] === null ? NO_IMPORTAR : elegidas[a.nombre] ?? SIN_ELEGIR}
              onChange={v => setElegidas(e => ({ ...e, [a.nombre]: v === SIN_ELEGIR ? undefined : v === NO_IMPORTAR ? null : v }))}
              opciones={[{ id: SIN_ELEGIR, label: 'Elegí una propiedad' }, ...propiedades.map(p => ({ id: p.id, label: p.nombre })), { id: NO_IMPORTAR, label: 'No es de este negocio: no importar' }]} />
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="rv-btn rv-btn--primario" disabled={!uniones || paraImportar === 0 || ocupado !== null} aria-busy={ocupado === 'importar'} onClick={() => void importar()}>
              <Upload size={15} aria-hidden /> {ocupado === 'importar' ? 'Importando…' : paraImportar > 0 ? `Importar ${cuenta(paraImportar, 'estadía', 'estadías')}` : 'Importar'}
            </button>
            <button type="button" className="rv-btn" disabled={ocupado !== null} onClick={cerrar}>Cancelar</button>
            {vista.estadias > 0 && !uniones && <span className="rv-ayuda" style={{ margin: 0 }}>Decí a qué propiedad corresponde cada aviso.</span>}
          </div>
        </div>
      )}

      {resumen.estadias > 0 && !vista && (
        <div style={{ marginTop: 14 }}>
          {ocupado === 'borrar'
            ? <button type="button" className="rv-btn rv-btn--sm" disabled aria-busy>Borrando…</button>
            : <BotonConfirmar pregunta={`¿Borrar ${resumen.estadias === 1 ? 'la estadía importada' : `las ${resumen.estadias} estadías importadas`} de Airbnb?`} si="Sí, borrar" onConfirmar={() => void borrar()}>Borrar todo lo importado</BotonConfirmar>}
        </div>
      )}
    </Seccion>
  )
}
