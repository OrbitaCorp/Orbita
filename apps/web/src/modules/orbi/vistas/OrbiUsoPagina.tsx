import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ErrorDeUso, usoApi, type MiembroConUso } from '../api/uso'
import {
  CLAVE_DE_USO, TOPE_MAXIMO, TOPE_MINIMO, accionesRecientes, etiquetaDeMes, etiquetaDeTope, fechaDeAccion,
  leerTope, puedeFijarTopes, puedeVerElEquipo, textoDeEstado, tonoDeUso, valorDelSelector, type ValorDelSelector,
} from '../estado/uso'
import s from '../orbi.module.css'

const CLAVE_DEL_EQUIPO = [...CLAVE_DE_USO, 'equipo'] as const

/** Barra de 8 px para un porcentaje (el del negocio, arriba de todo). */
function Medidor({ porcentaje, etiqueta }: { porcentaje: number; etiqueta: string }) {
  const lleno = Math.min(porcentaje, 100)
  return (
    <div className={s.medidor} data-tono={tonoDeUso(porcentaje)} role="progressbar" aria-label={etiqueta}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={lleno} aria-valuetext={`${porcentaje}%`}>
      <span style={{ transform: `scaleX(${lleno / 100})` }} />
    </div>
  )
}

/**
 * El tope de una persona (solo el dueño): Sin tope, 25%, 50%, 75% se aplican
 * al elegirlos; "Otro" pide un entero de 10 a 100 y se aplica con el botón.
 * Se monta con `key` por tope: cuando la API devuelve el tope nuevo, arranca
 * de cero con ese valor.
 */
function SelectorDeTope({ miembro }: { miembro: MiembroConUso }) {
  const qc = useQueryClient()
  const [valor, setValor] = useState<ValorDelSelector>(valorDelSelector(miembro.topePorcentaje))
  const [otro, setOtro] = useState(valorDelSelector(miembro.topePorcentaje) === 'otro' ? String(miembro.topePorcentaje) : '')
  const guardar = useMutation({
    mutationFn: (tope: number | null) => usoApi.fijarTope(miembro.memberId, tope),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_DE_USO }),
    // Si no se guardó, el selector vuelve a mostrar el tope que sigue vigente.
    onError: () => setValor(valorDelSelector(miembro.topePorcentaje)),
  })
  const elegir = (v: ValorDelSelector) => {
    setValor(v)
    guardar.reset()
    if (v === 'otro') return
    const tope = v === 'sin' ? null : Number(v)
    if (tope !== miembro.topePorcentaje) guardar.mutate(tope)
  }
  const escrito = leerTope(otro)
  const puedeAplicar = escrito !== null && escrito !== miembro.topePorcentaje && !guardar.isPending
  const aplicar = () => { if (puedeAplicar) guardar.mutate(escrito) }
  const idError = `orbi-tope-error-${miembro.memberId}`

  return (
    <div className={s.selectorTope}>
      <select
        className={s.foco}
        value={valor}
        disabled={guardar.isPending}
        aria-label={`Tope de ${miembro.nombre}`}
        aria-describedby={guardar.isError ? idError : undefined}
        onChange={e => elegir(e.target.value as ValorDelSelector)}
      >
        <option value="sin">Sin tope</option>
        <option value="25">25%</option>
        <option value="50">50%</option>
        <option value="75">75%</option>
        <option value="otro">Otro (10 a 100)</option>
      </select>
      {valor === 'otro' && (
        <>
          <input
            className={s.foco}
            type="number"
            inputMode="numeric"
            min={TOPE_MINIMO}
            max={TOPE_MAXIMO}
            step={1}
            value={otro}
            disabled={guardar.isPending}
            aria-label={`Tope de ${miembro.nombre}, en %`}
            onChange={e => setOtro(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') aplicar() }}
          />
          <button
            type="button"
            className={`${s.botonChico} ${s.foco}`}
            disabled={!puedeAplicar}
            onClick={aplicar}
          >
            Aplicar
          </button>
        </>
      )}
      <span className={s.estadoTope} aria-live="polite">
        {guardar.isPending ? 'Guardando…' : valor === 'otro' && otro !== '' && escrito === null ? 'Un número entero entre 10 y 100.' : ''}
      </span>
      {guardar.isError && (
        <span id={idError} className={s.errorChico} role="alert">
          {guardar.error instanceof ErrorDeUso ? guardar.error.message : 'No se pudo guardar el tope. Probá de nuevo.'}
        </span>
      )}
    </div>
  )
}

/**
 * "Uso del equipo" (/admin/ventas/orbi?vista=uso): el % del mes del negocio y
 * de cada persona, los topes y lo que Orbi cambió en los últimos 30 días. Para
 * el dueño y los administradores; los topes los cambia solo el dueño. Nunca se
 * muestran créditos ni conversaciones.
 */
export function OrbiUsoPagina({ onVolver }: { onVolver: () => void }) {
  const { user } = useAuth()
  const rol = user?.type === 'member' ? user.role : undefined
  const permitido = puedeVerElEquipo(rol)
  const editaTopes = puedeFijarTopes(rol)
  const consulta = useQuery({ queryKey: CLAVE_DEL_EQUIPO, queryFn: usoApi.equipo, enabled: permitido, retry: false })
  const sinPermiso = (!!user && !permitido) || (consulta.error instanceof ErrorDeUso && consulta.error.status === 403)
  const datos = consulta.data
  const acciones = useMemo(() => (datos ? accionesRecientes(datos.acciones, new Date()) : []), [datos])

  return (
    <div className={s.usoPagina}>
      <div className={s.usoLectura}>
        <button type="button" className={`${s.botonChico} ${s.volver} ${s.foco}`} onClick={onVolver}>
          <ArrowLeft aria-hidden />Volver a la conversación
        </button>

        <header className={s.usoCabeza}>
          <h1>Uso de Orbi</h1>
          {datos && (
            <>
              <p>El negocio usó el <strong className={s.mono}>{datos.negocio.porcentaje}%</strong> de Orbi en {etiquetaDeMes(datos.mes)}.</p>
              <Medidor porcentaje={datos.negocio.porcentaje} etiqueta="Uso de Orbi del negocio este mes" />
            </>
          )}
        </header>

        {sinPermiso ? (
          <p className={s.usoNota}>Esta vista es para el dueño o los administradores</p>
        ) : consulta.isError ? (
          <div className={s.usoNota} role="alert">
            No se pudo cargar el uso de Orbi.{' '}
            <button type="button" className={s.link} onClick={() => void consulta.refetch()}>Reintentar</button>
          </div>
        ) : !datos ? (
          <p className={s.usoNota}>Cargando…</p>
        ) : (
          <>
            <section className={s.usoSeccion} aria-labelledby="orbi-uso-equipo">
              <h2 id="orbi-uso-equipo">Equipo</h2>
              <p className={s.usoNota}>
                Con tope, el % de cada persona se cuenta sobre su parte; sin tope, sobre el cupo de todo el negocio.
                {editaTopes ? ' Con el tope elegís cuánto del cupo del mes puede usar cada persona.' : ' Los topes los cambia el dueño.'}
              </p>
              {datos.miembros.length === 0 ? (
                <p className={s.usoNota}>Todavía no hay personas en el equipo.</p>
              ) : (
                <div className={s.tabla}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col" className={s.num}>Usado</th>
                        <th scope="col">Tope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.miembros.map(m => (
                        <tr key={m.memberId}>
                          <td>{m.nombre}</td>
                          <td className={s.num}>
                            {m.porcentaje}%
                            {tonoDeUso(m.porcentaje) === 'agotado' && <> <span className={s.chip} data-tono="error">Agotado</span></>}
                          </td>
                          <td>
                            {editaTopes
                              ? <SelectorDeTope key={`${m.memberId}-${m.topePorcentaje ?? 'sin'}`} miembro={m} />
                              : etiquetaDeTope(m.topePorcentaje)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={s.usoSeccion} aria-labelledby="orbi-uso-acciones">
              <h2 id="orbi-uso-acciones">Lo que hizo Orbi</h2>
              <p className={s.usoNota}>Los cambios que Orbi aplicó en los últimos 30 días, quién se los pidió y cómo salieron.</p>
              {acciones.length === 0 ? (
                <p className={s.usoNota}>Orbi no hizo cambios en los últimos 30 días.</p>
              ) : (
                <div className={s.tabla}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Miembro</th>
                        <th scope="col">Acción</th>
                        <th scope="col">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acciones.map((a, i) => (
                        <tr key={`${a.fecha ?? 'sin-fecha'}-${i}`}>
                          <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>{fechaDeAccion(a.fecha)}</td>
                          <td>{a.miembro}</td>
                          <td>{a.resumen}</td>
                          <td><span className={s.chip} data-tono={a.estado === 'executed' ? 'ok' : 'error'}>{textoDeEstado(a.estado)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className={`${s.usoNota} ${s.usoPrivado}`}><Lock aria-hidden />No se muestran las conversaciones: cada persona ve solo las suyas.</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
