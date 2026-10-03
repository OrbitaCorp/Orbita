import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { usoApi } from '../api/uso'
import { CLAVE_DE_USO, mostrarBarra, porcentajeDeUso, textoDeUso, tonoDeUso } from '../estado/uso'
import s from '../orbi.module.css'

/**
 * Cuánto Orbi queda este mes (fase 5): una barra de 3 px bajo el encabezado,
 * desde el 50%. Desde el 80% también lo dice en texto. Se pide al abrir el
 * chat (se monta con él) y otra vez al terminar cada respuesta. Si la API no
 * contesta, no se muestra nada: la barra avisa, no bloquea.
 */
export function BarraDeUso() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: CLAVE_DE_USO, queryFn: usoApi.propio, retry: false })

  const enVivo = useOrbiStore(st => st.isStreaming)
  const antes = useRef(enVivo)
  useEffect(() => {
    if (antes.current && !enVivo) void qc.invalidateQueries({ queryKey: CLAVE_DE_USO })
    antes.current = enVivo
  }, [enVivo, qc])

  if (!data) return null
  const porcentaje = porcentajeDeUso(data)
  if (!mostrarBarra(porcentaje)) return null
  const tono = tonoDeUso(porcentaje)
  const texto = textoDeUso(data)
  // Sin bloqueo se puede pasar del 100%: la barra queda llena y el texto dice el número real.
  const lleno = Math.min(porcentaje, 100)

  return (
    <div className={s.uso} data-tono={tono} title={texto}>
      <div
        className={s.usoBarra}
        role="progressbar"
        aria-label="Uso de Orbi este mes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={lleno}
        aria-valuetext={texto}
      >
        <span style={{ transform: `scaleX(${lleno / 100})` }} />
      </div>
      {tono !== 'normal' && <p className={s.usoTexto}>{texto}</p>}
    </div>
  )
}
