import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { platformApi, type PriceCampaignRow, type PriceCampaignEstado, type PriceCampaignInput } from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader,
  ModalShell, Field, money, date,
  btnGhost, btnPrimary, inputStyle,
} from './ui'

// Campañas de precio congelado: "los primeros N comercios pagan $X por mes
// durante M meses, después el precio de lista". Lo que se configura acá es lo
// que cobra el alta (subscriptions.service.ts) y lo que muestran la landing y
// el wizard, sin desplegar nada.
//
// Hay dos tipos con el mismo formulario:
//   - Pública: se le aplica sola a todo el que se registra mientras esté
//     prendida y con lugares, y la landing tacha el precio de lista y muestra
//     el contador. Solo puede haber una prendida a la vez.
//   - Con código: cortesía. No se ve en ningún lado; entra quien escribe el
//     código en el último paso del alta.

const TONO_ESTADO: Record<PriceCampaignEstado, 'green' | 'gray' | 'amber' | 'blue'> = {
  ACTIVA: 'green',
  APAGADA: 'gray',
  VENCIDA: 'amber',
  AGOTADA: 'amber',
  PROGRAMADA: 'blue',
}
const LABEL_ESTADO: Record<PriceCampaignEstado, string> = {
  ACTIVA: 'Activa',
  APAGADA: 'Apagada',
  VENCIDA: 'Vencida',
  AGOTADA: 'Sin lugares',
  PROGRAMADA: 'Programada',
}

type Aviso = { variant: ToastVariant; title: string; description?: string }
type Lista = { base: number; avanzado: number; minAmount: number }

const mono: React.CSSProperties = { fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)' }
const tenue: React.CSSProperties = { color: 'var(--color-subtle)' }

export function TabCampanias() {
  const [reloadKey, setReloadKey] = useState(0)
  // 'nueva' abre el formulario vacío; un id, el de esa campaña.
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const { data, error } = useFetch(() => platformApi.priceCampaigns(), [reloadKey])
  const recargar = useCallback(() => setReloadKey((k) => k + 1), [])

  // Los lugares no bajan desde esta pantalla: bajan cuando alguien se registra.
  // Mismo refresco que Descuentos: al volver a la pestaña y cada 30 s, solo
  // con la pestaña visible.
  useEffect(() => {
    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    const timer = setInterval(refrescarSiVisible, 30_000)
    window.addEventListener('focus', refrescarSiVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refrescarSiVisible)
    }
  }, [recargar])

  useEffect(() => {
    if (!aviso || aviso.variant === 'error') return
    const t = setTimeout(() => setAviso(null), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  const campanias = data?.campaigns ?? []
  const editando = abierta && abierta !== 'nueva' ? campanias.find((c) => c.id === abierta) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Campañas de precio"
        subtitle="Precio congelado por unos meses para quienes se registren. Una campaña pública se aplica sola y se muestra en la landing con su contador de lugares; una con código es una cortesía que no se ve en ningún lado."
        action={
          <button onClick={() => setAbierta('nueva')} className="ds-hover" style={btnPrimary}>
            <Plus size={16} strokeWidth={2} /> Nueva campaña
          </button>
        }
      />

      {error ? (
        <ErrorBox msg="No se pudieron cargar las campañas." />
      ) : !data ? (
        <Loader />
      ) : campanias.length === 0 ? (
        <Card>
          <Empty text={`Todavía no hay ninguna campaña: hoy todas las altas pagan el precio de lista (${money(data.list.base)} Base, ${money(data.list.avanzado)} con Avanzado).`} />
        </Card>
      ) : (
        <Card noPad>
          <Table
            head={['Campaña', 'Tipo', 'Base', 'Con Avanzado', 'Meses', 'Lugares', 'Estado', 'Hasta']}
            alignRight={[2, 3, 4, 5]}
            rows={campanias.map((c) => ({
              key: c.id,
              onClick: () => setAbierta(c.id),
              cells: [
                <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.name}</span>,
                c.isPublic
                  ? 'Pública'
                  : <span key="t">Código <span style={{ ...mono, fontWeight: 700, letterSpacing: '0.03em' }}>{c.code}</span></span>,
                <span key="b" style={mono}>{money(c.priceBase)}</span>,
                <span key="a" style={mono}>{money(c.priceAdvanced)}</span>,
                <span key="m" style={mono}>{c.months}</span>,
                <span key="l" style={mono}>
                  {c.usedSlots}
                  <span style={tenue}>{c.maxSlots === null ? ' / sin cupo' : ` / ${c.maxSlots}`}</span>
                </span>,
                <Chip key="e" text={LABEL_ESTADO[c.estado]} tone={TONO_ESTADO[c.estado]} dot />,
                c.endsAt ? date(c.endsAt) : <span key="h" style={tenue}>Sin fecha</span>,
              ],
            }))}
          />
        </Card>
      )}

      {abierta && data && (abierta === 'nueva' || editando) && (
        <ModalCampania
          campania={editando}
          lista={data.list}
          onClose={() => setAbierta(null)}
          onGuardada={(nombre) => {
            setAbierta(null)
            recargar()
            setAviso({ variant: 'success', title: editando ? `Campaña ${nombre} guardada` : `Campaña ${nombre} creada` })
          }}
        />
      )}

      {aviso && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
          <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />
        </div>
      )}
    </div>
  )
}

// Las fechas se cargan como día (sin hora) y valen en hora de Argentina: la
// campaña arranca al empezar ese día y termina cuando ese día se acaba.
const aDia = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10) : '')
const desdeDia = (dia: string, fin: boolean) => (dia ? `${dia}T${fin ? '23:59:59' : '00:00:00'}-03:00` : null)

function ModalCampania({ campania, lista, onClose, onGuardada }: {
  campania: PriceCampaignRow | null
  lista: Lista
  onClose: () => void
  onGuardada: (nombre: string) => void
}) {
  const [name, setName] = useState(campania?.name ?? '')
  const [publica, setPublica] = useState(campania ? campania.isPublic : true)
  const [code, setCode] = useState(campania?.code ?? '')
  const [priceBase, setPriceBase] = useState(String(campania?.priceBase ?? 10000))
  const [priceAdvanced, setPriceAdvanced] = useState(String(campania?.priceAdvanced ?? 10000))
  const [months, setMonths] = useState(String(campania?.months ?? 3))
  const [sinCupo, setSinCupo] = useState(campania ? campania.maxSlots === null : false)
  const [maxSlots, setMaxSlots] = useState(String(campania?.maxSlots ?? 30))
  const [startsAt, setStartsAt] = useState(aDia(campania?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(aDia(campania?.endsAt ?? null))
  const [isActive, setIsActive] = useState(campania?.isActive ?? false)
  const [note, setNote] = useState(campania?.note ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Lo mismo que valida el backend, avisado mientras se escribe.
  const errorPrecio = (valor: string, deLista: number, plan: string): string => {
    const n = Number(valor)
    if (!valor.trim() || !Number.isFinite(n)) return 'Escribí un precio.'
    if (n < lista.minAmount) return `Mercado Pago no cobra menos de ${money(lista.minAmount)}.`
    if (n >= deLista) return `Tiene que ser menor al precio de lista de ${plan} (${money(deLista)}).`
    return ''
  }
  const errBase = errorPrecio(priceBase, lista.base, 'Base')
  const errAvanzado = errorPrecio(priceAdvanced, lista.avanzado, 'Base + Avanzado')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const m = Number(months)
    const cupo = Number(maxSlots)
    if (name.trim().length < 3) { setError('Ponele un nombre a la campaña.'); return }
    if (!campania && !publica && code.trim().length < 3) { setError('El código tiene que tener al menos 3 caracteres.'); return }
    if (errBase || errAvanzado) { setError(errBase || errAvanzado); return }
    if (!Number.isInteger(m) || m < 1 || m > 12) { setError('Los meses tienen que ser un número entre 1 y 12.'); return }
    if (!sinCupo && (!Number.isInteger(cupo) || cupo < 1)) { setError('El cupo tiene que ser un número mayor a cero, o marcá "Sin cupo".'); return }
    if (startsAt && endsAt && endsAt < startsAt) { setError('La fecha de fin no puede ser anterior a la de inicio.'); return }

    const input: PriceCampaignInput = {
      name: name.trim(),
      priceBase: Number(priceBase),
      priceAdvanced: Number(priceAdvanced),
      months: m,
      maxSlots: sinCupo ? null : cupo,
      startsAt: desdeDia(startsAt, false),
      endsAt: desdeDia(endsAt, true),
      isActive,
      note: note.trim() || null,
    }
    setGuardando(true)
    try {
      if (campania) await platformApi.updatePriceCampaign(campania.id, input)
      else await platformApi.createPriceCampaign({ ...input, code: publica ? null : code.trim() })
      onGuardada(input.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la campaña.')
    } finally {
      setGuardando(false)
    }
  }

  const radio: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 400, color: 'var(--color-body)', cursor: 'pointer', lineHeight: 1.45 }
  const check: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 400, color: 'var(--color-body)', cursor: 'pointer' }

  return (
    <ModalShell title={campania ? campania.name : 'Nueva campaña'} onClose={onClose} cerrarAlClickAfuera={false}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Nombre" hint="Para el equipo. No se muestra en la landing.">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej: Primeros 30 comercios" className="ds-field" style={inputStyle} />
        </Field>

        {campania ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-body)' }}>
            {campania.isPublic
              ? 'Campaña pública: se aplica sola a quien se registra.'
              : <>Campaña con código <strong style={{ ...mono, letterSpacing: '0.03em' }}>{campania.code}</strong>: entra quien lo escribe en el alta.</>}
          </p>
        ) : (
          <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <legend style={{ padding: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>A quién le llega</legend>
            <label style={radio}>
              <input type="radio" name="tipo" checked={publica} onChange={() => setPublica(true)} style={{ marginTop: 3 }} />
              <span><strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>A todos los que se registren.</strong> La landing tacha el precio de lista y muestra los lugares que quedan.</span>
            </label>
            <label style={radio}>
              <input type="radio" name="tipo" checked={!publica} onChange={() => setPublica(false)} style={{ marginTop: 3 }} />
              <span><strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>Solo a quien tenga un código.</strong> Una cortesía: no se anuncia en ningún lado.</span>
            </label>
            {!publica && (
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                maxLength={32}
                placeholder="Código, ej: AMIGOS"
                aria-label="Código de la campaña"
                className="ds-field"
                style={{ ...inputStyle, fontFamily: '"Geist Mono", monospace', letterSpacing: '0.05em' }}
              />
            )}
          </fieldset>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Base, por mes" hint={errBase || `De lista: ${money(lista.base)}`}>
            <input type="number" min={1} value={priceBase} onChange={(e) => setPriceBase(e.target.value)} className="ds-field" style={{ ...inputStyle, ...(errBase ? { borderColor: 'var(--color-error)' } : {}) }} />
          </Field>
          <Field label="Con Avanzado, por mes" hint={errAvanzado || `De lista: ${money(lista.avanzado)}`}>
            <input type="number" min={1} value={priceAdvanced} onChange={(e) => setPriceAdvanced(e.target.value)} className="ds-field" style={{ ...inputStyle, ...(errAvanzado ? { borderColor: 'var(--color-error)' } : {}) }} />
          </Field>
        </div>

        <Field label="Cuántos meses dura" hint="Contando el mes que se paga al registrarse. Después pasan al precio de lista.">
          <input type="number" min={1} max={12} value={months} onChange={(e) => setMonths(e.target.value)} className="ds-field" style={{ ...inputStyle, width: 110 }} />
        </Field>

        <Field label="Cupo de comercios">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="number" min={1} value={maxSlots} disabled={sinCupo} onChange={(e) => setMaxSlots(e.target.value)} className="ds-field" style={{ ...inputStyle, width: 110, opacity: sinCupo ? 0.5 : 1 }} />
            <label style={check}>
              <input type="checkbox" checked={sinCupo} onChange={(e) => setSinCupo(e.target.checked)} />
              Sin cupo
            </label>
            {campania && <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--color-muted)' }}>Ya entraron {campania.usedSlots}</span>}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Desde (opcional)">
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="ds-field" style={inputStyle} />
          </Field>
          <Field label="Hasta (opcional)">
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="ds-field" style={inputStyle} />
          </Field>
        </div>

        <Field label="Para qué es (opcional)" hint="Queda a la vista del equipo.">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="ds-field" style={inputStyle} />
        </Field>

        <div>
          <label style={{ ...check, fontWeight: 600, color: 'var(--color-text)' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Prendida
          </label>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.45 }}>
            {(campania ? campania.isPublic : publica)
              ? 'Al prenderla, la landing y el alta muestran y cobran este precio a todo el que entra. Apagarla no le cambia nada a los que ya se registraron.'
              : 'Al prenderla, el código empieza a funcionar. Apagarla no le cambia nada a los que ya lo usaron.'}
          </p>
        </div>

        {campania && campania.businesses.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Quiénes entraron</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {campania.businesses.map((b) => (
                <li key={b.businessId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: 'var(--color-body)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  <span style={{ flexShrink: 0, color: 'var(--color-muted)' }}>
                    {date(b.createdAt)} · {b.frozenChargesLeft > 0 ? `le quedan ${b.frozenChargesLeft} cobro${b.frozenChargesLeft === 1 ? '' : 's'} congelado${b.frozenChargesLeft === 1 ? '' : 's'}` : 'ya paga lista'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={guardando} className="ds-hover" style={{ ...btnPrimary, ...(guardando ? { opacity: 0.6, cursor: 'default' } : {}) }}>
            {guardando ? 'Guardando…' : campania ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
