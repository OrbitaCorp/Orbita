// Píldora "Cuenta regresiva" de cada fila del listado de descuentos (paquete
// Avanzado, RBT-675). Es el mismo interruptor que hay en el formulario, pero
// desde la tabla: un clic la prende (el reloj y los productos rebajados pasan
// a la portada), otro la apaga. Solo un descuento por negocio la puede tener,
// así que prenderla en uno se la saca al que la tenía — el listado se
// refresca y la píldora encendida se muda de fila.
//
// Cinco estados:
//   - prendida: ámbar, con el reloj. Clic → se apaga.
//   - prendida pero el descuento ya venció: gris y atenuada, "Cuenta regresiva
//     vencida". En la portada ya no se ve nada (el endpoint público la
//     esconde al vencer), así que pintarla ámbar mentiría. Clic → abre el
//     formulario para correr la fecha; al guardar con el interruptor prendido
//     vuelve a la portada sola.
//   - apagada y lista (tiene fecha de fin futura): gris, "Activar cuenta
//     regresiva". Clic → se prende.
//   - apagada pero sin fecha de fin (o ya vencida): gris y atenuada. Clic →
//     abre el formulario para que ponga la fecha; el title explica por qué.
//   - sin el paquete: gris con candado. Clic → suscripción.
// Los descuentos por ticket no la muestran: no se ven en la portada.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, Timer } from 'lucide-react'
import { useAddons } from '../hooks/useAddons'
import { useCountdownDescuento } from '../hooks/useCountdownDescuento'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ApiError } from '@/lib/api'
import type { Descuento } from '../types'

interface Props {
  descuento: Descuento
  onEditar: (id: string) => void
}

export function PildoraCountdown({ descuento, onEditar }: Props) {
  const router = useRouter()
  const { data: addons, isLoading } = useAddons()
  const mutation = useCountdownDescuento()
  const [error, setError] = useState<string | null>(null)

  // El aviso de error se va solo: es un empujón, no un estado permanente.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  if (descuento.alcance === 'ticket') return null

  const bloqueada = !isLoading && !(addons?.advanced ?? false)
  const sinFecha = !descuento.fechaFin
  const vencido = descuento.estado === 'expirado'
  // "Prendida" acá es "prendida Y visible en la portada": si el descuento ya
  // venció la fila sigue apuntándolo en la base, pero la tienda no muestra
  // nada, y la píldora tiene que contar eso.
  const prendidaVencida = descuento.countdown === true && vencido
  const prendida = descuento.countdown === true && !vencido
  const lista = !sinFecha && !vencido
  const ocupada = mutation.isPending

  function irASuscripcion() {
    const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
    const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
    router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
  }

  function onClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (isLoading || ocupada) return
    if (bloqueada) return irASuscripcion()
    if (prendidaVencida || (!prendida && !lista)) return onEditar(descuento.id)
    setError(null)
    mutation.mutate(
      { id: descuento.id, countdown: !prendida },
      { onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo cambiar. Probá de nuevo.') },
    )
  }

  const title = bloqueada
    ? 'La cuenta regresiva es parte del paquete Avanzado. Tocá para ver qué incluye.'
    : prendida
      ? 'En la portada hay un reloj con lo que falta para que venza y sus productos rebajados. Tocá para sacarla.'
      : prendidaVencida
        ? 'El descuento venció y la portada ya no la muestra. Corré la fecha de fin para volver a mostrarla.'
      : sinFecha
        ? 'Para mostrarla necesita una fecha de fin. Tocá para ponerla.'
        : vencido
          ? 'Ya venció: corré la fecha de fin para poder mostrarla.'
          : 'Muestra este descuento en la portada con un reloj hasta que venza. Solo uno a la vez: si otro la tenía, pasa a este.'

  const label = bloqueada
    ? 'Cuenta regresiva'
    : prendida
      ? 'Cuenta regresiva en la portada'
      : prendidaVencida
        ? 'Cuenta regresiva vencida'
        : 'Activar cuenta regresiva'

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0 }}>
      <button
        type="button"
        className="ds-hover"
        onClick={onClick}
        title={title}
        aria-pressed={prendida || prendidaVencida}
        aria-busy={ocupada}
        data-estado={bloqueada ? 'bloqueada' : prendida ? 'prendida' : prendidaVencida ? 'vencida' : lista ? 'lista' : 'sin-fecha'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px 0 7px',
          borderRadius: 999, fontSize: 11, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
          fontFamily: 'inherit', cursor: ocupada ? 'progress' : 'pointer',
          transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease, opacity 150ms ease',
          opacity: ocupada ? 0.6 : !bloqueada && !prendida && !lista ? 0.65 : 1,
          ...(prendida
            ? { color: 'var(--color-warning)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }
            : { color: 'var(--color-muted)', background: 'transparent', border: '1px dashed var(--color-border-strong)' }),
        }}
      >
        {bloqueada
          ? <Lock size={11} strokeWidth={2.2} aria-hidden />
          : <Timer size={12} strokeWidth={2.2} aria-hidden />}
        {label}
      </button>
      {error && (
        <span role="alert" style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--color-warning)', whiteSpace: 'normal' }}>
          {error}
        </span>
      )}
    </span>
  )
}
