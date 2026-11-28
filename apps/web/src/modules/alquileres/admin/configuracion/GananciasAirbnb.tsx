// "Ganancias de Airbnb", una sección del menú de un alojamiento real (al lado
// de Estadísticas): el dueño elige el archivo que descargó de Airbnb, ve qué
// trae, dice a qué propiedad corresponde cada aviso y lo importa. Con eso las
// Estadísticas cuentan esa plata, esas noches y esos huéspedes.
//
// Nació como el tercer bloque de la pantalla Airbnb, debajo de los
// calendarios, y ahí no se encontraba: quien busca "ganancias" no baja hasta
// el fondo de la pantalla del calendario. Desde Airbnb y desde Estadísticas
// hay un atajo ("Importar ganancias").
//
// El archivo se abre acá como texto y se manda al servidor, que es el que lo
// lee (dos veces: para la vista previa y para guardar). Acá no se interpreta
// nada. Si el servidor no lo entiende, dice por qué y no guarda.
import { useRef, useState } from 'react'
import { BarChart3, FileUp, Upload } from 'lucide-react'
import { fechaCorta } from '@/lib/reservas/fechas'
import { Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { TIPOS, cuenta, palabrasDe, type NegocioAlquiler } from '../../datos'
import { hace } from '../../datos/textos'
import type { Ganancias } from '../../datos/origen'
import type { VistaPreviaApi } from '../../datos/origen/alquileresApi'
import { ejecutar, type Avisar } from '../acciones'
import { BotonConfirmar } from '../piezas'
import { PaginaForm } from './comun'
import { DEMASIADO_GRANDE, MAXIMO_BYTES_CSV, decodificar, totalesTxt, unionesListas, unionesPropuestas, type Elegidas } from './ganancias'

const BAJADA = 'El calendario de Airbnb trae las noches, no la plata. Con el archivo de ganancias, las Estadísticas suman lo que cobraste por Airbnb y las estadías de antes de conectar el calendario.'

const SIN_ELEGIR = ''
const NO_IMPORTAR = '__no__'
/** Lo que se dice de las filas que no son de una estadía (los pagos al banco). */
const otras = (n: number) => (n === 1 ? 'Hay 1 fila que no es de una estadía (un pago al banco), y no se importa.' : `Hay ${n} filas que no son de una estadía (pagos al banco), y no se importan.`)
/** Cuántas filas que quedaron afuera se listan; el resto se cuenta. */
const A_LA_VISTA = 5

interface P {
  negocio: NegocioAlquiler
  ganancias: Ganancias
  avisar: Avisar
  /** A Estadísticas, que es donde se ve lo importado. */
  onVerEstadisticas: () => void
  /** A Propiedades: sin ninguna cargada no hay a qué unir un aviso. */
  onIrAPropiedades: () => void
}

export default function GananciasAirbnb({ negocio, ganancias, avisar, onVerEstadisticas, onIrAPropiedades }: P) {
  const propiedades = negocio.propiedades.map(p => ({ id: p.id, nombre: p.nombre }))
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
  // Un archivo puede traer solo ajustes de estadías ya importadas (otro período): también hay algo para guardar.
  const hayAlgo = paraImportar > 0 || (vista?.ajustes ?? 0) > 0

  const cerrar = () => { setTexto(null); setVista(null); setElegidas({}); setError(null) }

  const elegir = async (f: File | undefined) => {
    if (archivo.current) archivo.current.value = '' // para poder volver a elegir el mismo archivo
    if (!f || ocupado) return
    cerrar()
    if (f.size > MAXIMO_BYTES_CSV) { setError(DEMASIADO_GRANDE); return }
    setOcupado('leer')
    try {
      const leido = decodificar(new Uint8Array(await f.arrayBuffer()))
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

  if (propiedades.length === 0) {
    return (
      <PaginaForm rotulo={TIPOS.estadia.label} titulo="Ganancias de Airbnb" bajada={BAJADA}>
        <Nota tono="info">
          <span style={{ flex: 1, minWidth: 0 }}>Primero cargá una {palabrasDe(negocio).unidad}: al importar, cada aviso de Airbnb se une con una de las tuyas.</span>
          <button type="button" className="rv-btn rv-btn--sm" onClick={onIrAPropiedades}>Ir a {palabrasDe(negocio).unidades}</button>
        </Nota>
      </PaginaForm>
    )
  }

  return (
    <PaginaForm rotulo={TIPOS.estadia.label} titulo="Ganancias de Airbnb" bajada={BAJADA}>
      <div className="rv-pila">
        {resumen.estadias > 0 && (
          <Seccion titulo="Lo que ya importaste"
            bajada={`${cuenta(resumen.estadias, 'estadía', 'estadías')}${resumen.hasta ? ` · hasta el ${fechaCorta(resumen.hasta)}` : ''} · última importación ${hace(resumen.ultimaImportacion ?? undefined, ahora)}. Ya cuentan en Estadísticas.`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="rv-btn rv-btn--sm" onClick={onVerEstadisticas}><BarChart3 size={14} aria-hidden /> Ver en Estadísticas</button>
              {/* Con un archivo abierto no se borra: primero se importa o se cancela. */}
              {!vista && (ocupado === 'borrar'
                ? <button type="button" className="rv-btn rv-btn--sm" disabled aria-busy>Borrando…</button>
                : <BotonConfirmar pregunta={`¿Borrar ${resumen.estadias === 1 ? 'la estadía importada' : `las ${resumen.estadias} estadías importadas`} de Airbnb?`} si="Sí, borrar" onConfirmar={() => void borrar()}>Borrar todo lo importado</BotonConfirmar>)}
            </div>
          </Seccion>
        )}

        <Seccion titulo={resumen.estadias > 0 ? 'Importar otro archivo' : 'Importar el archivo'}
          bajada={resumen.estadias > 0 ? 'Otro período, o el mismo de nuevo: lo que ya estaba no se duplica, y lo nuevo se suma.' : 'Es el archivo de ingresos que descargás de Airbnb. No se guarda nada hasta que lo confirmes.'}>
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
            {resumen.estadias === 0 && <span className="rv-ayuda" style={{ margin: 0 }}>Todavía no importaste nada.</span>}
          </div>
          {error && <p className="rv-error" role="alert" style={{ margin: '10px 0 0' }}>{error}</p>}

          {vista && (
            <div className="rv-pila" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              {vista.estadias === 0 && vista.ajustes === 0 ? (
                <Nota tono="aviso"><span>El archivo no trae ninguna estadía para importar.{vista.otrasFilas > 0 ? ` ${otras(vista.otrasFilas)}` : ''}</span></Nota>
              ) : vista.estadias === 0 ? (
                <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text)' }} role="status">
                  <b>{cuenta(vista.ajustes, 'ajuste', 'ajustes')}</b> de estadías que ya importaste: {vista.ajustes === 1 ? 'se suma' : 'se suman'} a lo que cobraste por ellas.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text)' }} role="status">
                  <b>{cuenta(vista.estadias, 'estadía', 'estadías')}</b>
                  {vista.desde && vista.hasta ? ` del ${fechaCorta(vista.desde)} al ${fechaCorta(vista.hasta)}` : ''} · <span className="rv-num">{totalesTxt(vista.totales)}</span>
                  <span className="rv-ayuda" style={{ display: 'block', marginTop: 4 }}>
                    Neto de la comisión de Airbnb.{vista.totales.length > 1 ? ' Cada moneda va por separado: no se suman.' : ''}{vista.ajustes > 0 ? ` Además, ${cuenta(vista.ajustes, 'ajuste', 'ajustes')} de estadías que ya importaste.` : ''}{vista.otrasFilas > 0 ? ` ${otras(vista.otrasFilas)}` : ''}
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
                <button type="button" className="rv-btn rv-btn--primario" disabled={!uniones || !hayAlgo || ocupado !== null} aria-busy={ocupado === 'importar'} onClick={() => void importar()}>
                  <Upload size={15} aria-hidden /> {ocupado === 'importar' ? 'Importando…' : paraImportar > 0 ? `Importar ${cuenta(paraImportar, 'estadía', 'estadías')}` : vista.ajustes > 0 ? `Sumar ${cuenta(vista.ajustes, 'ajuste', 'ajustes')}` : 'Importar'}
                </button>
                <button type="button" className="rv-btn" disabled={ocupado !== null} onClick={cerrar}>Cancelar</button>
                {vista.estadias > 0 && !uniones && <span className="rv-ayuda" style={{ margin: 0 }}>Decí a qué propiedad corresponde cada aviso.</span>}
              </div>
            </div>
          )}
        </Seccion>

        <Nota tono="info">
          <span>De Airbnb entran la plata, las noches y el nombre de cada huésped. El archivo no se guarda: se lee y se descarta.</span>
        </Nota>
      </div>
    </PaginaForm>
  )
}
