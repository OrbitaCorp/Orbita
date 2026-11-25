import { useMemo, useState } from 'react'
import {
  AtSign, Building2, CalendarClock, Check, Download, Dumbbell, FileText, MapPin,
  MessageCircle, Plus, ScanBarcode, Search, Store, Trash2,
} from 'lucide-react'
import {
  platformApi,
  type ActualizarLeadInput,
  type LeadClasificacion,
  type LeadEstado,
  type LeadRubro,
  type MarketingLead,
} from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import {
  useFetch, Card, Chip, ConfirmModal, Empty, ErrorBox, Field, Grid, Loader, ModalShell,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Superadmin → Marketing → Leads: reemplaza a Prospección.
// Reúne en base de datos compartida (para Mateo, Alan, Mili y Ale) las dos plantillas:
// 1. Tiendas Online (Misiones, con Puerto Iguazú destacado como potencial cliente local).
// 2. Nuevos rubros (Turnos, Alquileres, Gimnasios y POS), con tope de hasta 5 pilotos en Puerto Iguazú
//    (cortesía máx. 3 meses) y el resto marcado como leads de venta cerrada.

type Aviso = { variant: ToastVariant; title: string; description?: string }
type Plantilla = 'TIENDA' | 'NUEVOS_RUBROS'
type RubroNuevo = Exclude<LeadRubro, 'TIENDA'>
type FiltroCanal = 'TODOS' | 'AMBOS' | 'WPP' | 'IG' | 'PRESENCIAL'
type FiltroAvance = 'TODOS' | 'PENDIENTE' | 'CONTACTADO' | 'ACTIVO' | 'CERRADO' | 'DESCARTADO'

const RUBROS_NUEVOS: { id: RubroNuevo; label: string; desc: string; Icon: typeof CalendarClock }[] = [
  { id: 'TURNOS', label: 'Turnos', desc: 'Barberías, peluquerías, estética, salud', Icon: CalendarClock },
  { id: 'ALQUILERES', label: 'Alquileres', desc: 'Canchas, salones de eventos, cabañas/aparts', Icon: Building2 },
  { id: 'GIMNASIO', label: 'Gimnasios', desc: 'Gimnasios, crossfit, pilates, yoga, artes marciales', Icon: Dumbbell },
  { id: 'POS', label: 'POS / Mostrador', desc: 'Minimarkets, ferreterías, dietéticas, vinotecas, pet shops', Icon: ScanBarcode },
]

const ESTADOS: { id: LeadEstado; texto: string }[] = [
  { id: 'NUEVO', texto: 'Nuevo' },
  { id: 'CONTACTADO', texto: 'Contactado' },
  { id: 'RESPONDIO', texto: 'Respondió' },
  { id: 'DEMO', texto: 'Demo' },
  { id: 'PILOTO_ACTIVO', texto: 'Piloto activo' },
  { id: 'CLIENTE', texto: 'Cliente' },
  { id: 'DESCARTADO', texto: 'Descartado' },
  { id: 'NO_CONTACTAR', texto: 'No contactar' },
]

const EQUIPO = ['Mateo', 'Alan', 'Mili', 'Ale'] as const

const esIguazu = (loc: string) =>
  loc.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'puerto iguazu'

function canalDe(lead: MarketingLead): Exclude<FiltroCanal, 'TODOS'> {
  if (lead.whatsappUrl && lead.instagram) return 'AMBOS'
  if (lead.whatsappUrl) return 'WPP'
  if (lead.instagram) return 'IG'
  return 'PRESENCIAL'
}

function etiquetaClasificacion(c: LeadClasificacion, rubro: LeadRubro): { text: string; tone: 'green' | 'blue' | 'gray' } {
  if (c === 'PILOTO') return { text: 'Piloto · Cortesía 3m', tone: 'blue' }
  if (c === 'POTENCIAL_LOCAL') return { text: rubro === 'TIENDA' ? 'Potencial · Iguazú' : 'Posible piloto · Iguazú', tone: 'green' }
  return { text: 'Lead · Venta', tone: 'gray' }
}

function descargarCsv(leads: MarketingLead[], nombreArchivo: string) {
  const esc = (v: string | null | undefined) => {
    const s = (v ?? '').replace(/"/g, '""')
    return /[",;\n]/.test(s) ? `"${s}"` : s
  }
  const headers = [
    'Rubro', 'Subrubro', 'Clasificación', 'Zona', 'Departamento', 'Localidad',
    'Negocio', 'Teléfono', 'WhatsApp', 'Instagram', 'Web / Canal', 'Reseñas',
    'Dirección', 'Contactado', 'Contactado por', 'Estado', 'Responsable', 'Notas',
  ]
  const filas = leads.map((l) => [
    l.rubro, l.subrubro, l.clasificacion, l.zona, l.departamento, l.localidad,
    l.negocio, l.telefono ?? '', l.whatsappUrl ?? '', l.instagram ?? '', l.webActual ?? '',
    l.resenas ?? '', l.direccion ?? '', l.contactado ? 'Sí' : 'No', l.contactadoPor ?? '',
    l.estado, l.asignadoA ?? '', l.notas ?? '',
  ].map(esc).join(','))
  const blob = new Blob(['\uFEFF' + [headers.join(','), ...filas].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

export function PanelLeads({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useFetch(() => platformApi.leadsListar(), [tick])
  const [cambiosLocales, setCambiosLocales] = useState<Record<string, MarketingLead>>({})

  const [plantilla, setPlantilla] = useState<Plantilla>('TIENDA')
  const [rubroNuevo, setRubroNuevo] = useState<RubroNuevo>('TURNOS')
  const [clasificacionFiltro, setClasificacionFiltro] = useState<'TODAS' | LeadClasificacion>('TODAS')
  const [canalFiltro, setCanalFiltro] = useState<FiltroCanal>('TODOS')
  const [avanceFiltro, setAvanceFiltro] = useState<FiltroAvance>('TODOS')
  const [localidadFiltro, setLocalidadFiltro] = useState('TODAS')
  const [responsableFiltro, setResponsableFiltro] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')

  const [creando, setCreando] = useState(false)
  const [editandoNota, setEditandoNota] = useState<MarketingLead | null>(null)
  const [eliminando, setEliminando] = useState<MarketingLead | null>(null)

  const rubroActivo: LeadRubro = plantilla === 'TIENDA' ? 'TIENDA' : rubroNuevo

  const todosLeads = useMemo(() => {
    const base = data?.leads ?? []
    return base.map((l) => cambiosLocales[l.id] ?? l)
  }, [data, cambiosLocales])

  const leadsDelRubro = useMemo(
    () => todosLeads.filter((l) => l.rubro === rubroActivo),
    [todosLeads, rubroActivo],
  )

  const localidadesDisponibles = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of leadsDelRubro) counts.set(l.localidad, (counts.get(l.localidad) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => {
      if (esIguazu(a[0])) return -1
      if (esIguazu(b[0])) return 1
      return b[1] - a[1] || a[0].localeCompare(b[0])
    })
  }, [leadsDelRubro])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const list = leadsDelRubro.filter((l) => {
      if (clasificacionFiltro !== 'TODAS' && l.clasificacion !== clasificacionFiltro) return false
      if (canalFiltro !== 'TODOS' && canalDe(l) !== canalFiltro) return false
      if (localidadFiltro !== 'TODAS' && l.localidad !== localidadFiltro) return false
      if (responsableFiltro === 'SIN_ASIGNAR' && l.asignadoA) return false
      if (responsableFiltro !== 'TODOS' && responsableFiltro !== 'SIN_ASIGNAR' && l.asignadoA !== responsableFiltro) return false
      if (avanceFiltro === 'PENDIENTE' && (l.contactado || l.estado === 'DESCARTADO' || l.estado === 'NO_CONTACTAR')) return false
      if (avanceFiltro === 'CONTACTADO' && !l.contactado) return false
      if (avanceFiltro === 'ACTIVO' && !['RESPONDIO', 'DEMO'].includes(l.estado)) return false
      if (avanceFiltro === 'CERRADO' && !['PILOTO_ACTIVO', 'CLIENTE'].includes(l.estado)) return false
      if (avanceFiltro === 'DESCARTADO' && !['DESCARTADO', 'NO_CONTACTAR'].includes(l.estado)) return false
      if (q) {
        const match = [l.negocio, l.subrubro, l.localidad, l.departamento, l.telefono ?? '', l.instagram ?? '', l.notas ?? '']
          .some((t) => t.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      const rankClasif = (c: LeadClasificacion) => (c === 'PILOTO' ? 0 : c === 'POTENCIAL_LOCAL' ? 1 : 2)
      const rc = rankClasif(a.clasificacion) - rankClasif(b.clasificacion)
      if (rc !== 0) return rc
      if (a.contactado !== b.contactado) return a.contactado ? 1 : -1
      if (esIguazu(a.localidad) !== esIguazu(b.localidad)) return esIguazu(a.localidad) ? -1 : 1
      return a.localidad.localeCompare(b.localidad) || a.negocio.localeCompare(b.negocio)
    })
  }, [leadsDelRubro, clasificacionFiltro, canalFiltro, avanceFiltro, localidadFiltro, responsableFiltro, busqueda])

  const statsRubro = useMemo(() => {
    const total = leadsDelRubro.length
    const contactados = leadsDelRubro.filter((l) => l.contactado).length
    const conWpp = leadsDelRubro.filter((l) => !!l.whatsappUrl).length
    const conIg = leadsDelRubro.filter((l) => !!l.instagram).length
    const pilotos = leadsDelRubro.filter((l) => l.clasificacion === 'PILOTO').length
    const potenciales = leadsDelRubro.filter((l) => l.clasificacion === 'POTENCIAL_LOCAL').length
    return { total, contactados, conWpp, conIg, pilotos, potenciales }
  }, [leadsDelRubro])

  const cambiarPlantilla = (p: Plantilla) => {
    setPlantilla(p)
    setClasificacionFiltro('TODAS')
    setCanalFiltro('TODOS')
    setLocalidadFiltro('TODAS')
  }

  const cambiarRubroNuevo = (r: RubroNuevo) => {
    setRubroNuevo(r)
    setClasificacionFiltro('TODAS')
    setCanalFiltro('TODOS')
    setLocalidadFiltro('TODAS')
  }

  const actualizarLead = async (lead: MarketingLead, cambios: ActualizarLeadInput, mensajeOk?: string) => {
    if (!puedeEditar) return
    const previo = cambiosLocales[lead.id] ?? lead
    const optimista: MarketingLead = {
      ...previo,
      ...cambios,
      estado: cambios.estado ?? (cambios.contactado === true && previo.estado === 'NUEVO' ? 'CONTACTADO' : cambios.contactado === false && previo.estado === 'CONTACTADO' ? 'NUEVO' : previo.estado),
      contactado: cambios.contactado ?? (cambios.estado && ['CONTACTADO', 'RESPONDIO', 'DEMO', 'PILOTO_ACTIVO', 'CLIENTE'].includes(cambios.estado) ? true : cambios.estado === 'NUEVO' ? false : previo.contactado),
    }
    setCambiosLocales((m) => ({ ...m, [lead.id]: optimista }))
    try {
      const guardado = await platformApi.leadsActualizar(lead.id, cambios)
      setCambiosLocales((m) => ({ ...m, [lead.id]: guardado }))
      if (mensajeOk) setAviso({ variant: 'success', title: mensajeOk })
    } catch (e) {
      setCambiosLocales((m) => ({ ...m, [lead.id]: previo }))
      setAviso({
        variant: 'error',
        title: 'No se pudo actualizar el lead',
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  if (loading && !data) return <Card title="Leads"><Loader /></Card>
  if (error || !data) {
    return (
      <ErrorBox
        msg="No se pudieron cargar los leads."
        action={<button type="button" onClick={() => setTick((n) => n + 1)} style={btnGhostSm}>Reintentar</button>}
      />
    )
  }

  const totalTiendas = todosLeads.filter((l) => l.rubro === 'TIENDA').length
  const totalNuevosRubros = todosLeads.filter((l) => l.rubro !== 'TIENDA').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        .ld-tpl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .ld-tpl { display: flex; align-items: flex-start; gap: 12px; padding: 15px 18px; border-radius: 14px; border: 1.5px solid var(--color-border); background: var(--color-bg); text-align: left; cursor: pointer; font-family: inherit; transition: border-color 150ms, background-color 150ms; }
        .ld-tpl:hover { border-color: var(--color-primary); }
        .ld-tpl[aria-pressed="true"] { border-color: var(--color-primary); background: var(--color-primary-bg); }
        .ld-subtabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .ld-subtab { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
        .ld-subtab[aria-pressed="true"] { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); }
        .ld-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .ld-chip-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .ld-chip-btn[aria-pressed="true"] { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); }
        .ld-check { width: 32px; height: 32px; border-radius: 9px; border: 1.5px solid var(--color-border); background: var(--color-bg); color: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 140ms, border-color 140ms, color 140ms; flex-shrink: 0; }
        .ld-check:hover { border-color: #10b981; }
        .ld-check[aria-pressed="true"] { background: #10b981; border-color: #10b981; color: #ffffff; }
        .ld-check:disabled { opacity: 0.55; cursor: not-allowed; }
        .ld-wa { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; background: var(--color-success-bg); color: var(--chip-success-fg); font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }
        .ld-wa:hover { filter: brightness(0.95); }
        .ld-ig { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; background: var(--color-primary-bg); color: var(--chip-primary-fg); font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }
        .ld-ig:hover { filter: brightness(0.95); }
        .ld-select { height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 12.5px; }
        .ld-row-ok { background: color-mix(in srgb, var(--color-success-bg) 38%, transparent); }
        @media (prefers-reduced-motion: reduce) { .ld-tpl, .ld-check { transition: none; } }
      `}</style>

      {/* Selector de Plantilla principal */}
      <div className="ld-tpl-grid" role="group" aria-label="Plantillas de leads">
        <button type="button" className="ld-tpl" aria-pressed={plantilla === 'TIENDA'} onClick={() => cambiarPlantilla('TIENDA')}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Store size={19} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 14.5, color: 'var(--color-text)' }}>Plantilla 1 · Tiendas Online</strong>
              <Chip text={`${totalTiendas}`} tone="blue" />
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.45 }}>
              Tiendas de Misiones con WhatsApp e Instagram. Las de Puerto Iguazú figuran como potenciales clientes locales.
            </span>
          </span>
        </button>

        <button type="button" className="ld-tpl" aria-pressed={plantilla === 'NUEVOS_RUBROS'} onClick={() => cambiarPlantilla('NUEVOS_RUBROS')}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-violet-bg)', color: 'var(--chip-violet-fg)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CalendarClock size={19} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 14.5, color: 'var(--color-text)' }}>Plantilla 2 · Nuevos rubros (Pilotos y Leads)</strong>
              <Chip text={`${totalNuevosRubros}`} tone="violet" />
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.45 }}>
              Turnos, Alquileres, Gimnasios y POS. Hasta 5 pilotos de Puerto Iguazú por rubro (cortesía máx. 3 meses); el resto, leads.
            </span>
          </span>
        </button>
      </div>

      {/* Sub-pestañas para Nuevos Rubros */}
      {plantilla === 'NUEVOS_RUBROS' && (
        <div className="ld-subtabs" role="group" aria-label="Rubros nuevos">
          {RUBROS_NUEVOS.map((r) => {
            const items = todosLeads.filter((l) => l.rubro === r.id)
            const pilotos = items.filter((l) => l.clasificacion === 'PILOTO').length
            const Icon = r.Icon
            const activo = rubroNuevo === r.id
            return (
              <button key={r.id} type="button" className="ld-subtab" aria-pressed={activo} onClick={() => cambiarRubroNuevo(r.id)}>
                <Icon size={15} />
                <span>{r.label}</span>
                <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: activo ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  {items.length}
                </span>
                <Chip text={`${pilotos}/5 pilotos`} tone={pilotos === 0 ? 'gray' : pilotos >= 5 ? 'blue' : 'amber'} />
              </button>
            )
          })}
        </div>
      )}

      {/* KPIs de la vista activa */}
      <Grid small>
        <KpiMini label="Total en esta lista" value={`${statsRubro.total}`} />
        <KpiMini label="Contactados" value={`${statsRubro.contactados} / ${statsRubro.total}`} accent={statsRubro.contactados > 0} />
        <KpiMini label="Con WhatsApp" value={`${statsRubro.conWpp}`} />
        <KpiMini label="Con Instagram" value={`${statsRubro.conIg}`} />
        {plantilla === 'TIENDA' ? (
          <KpiMini label="Potenciales Iguazú" value={`${statsRubro.potenciales}`} accent />
        ) : (
          <KpiMini label="Pilotos Iguazú (máx. 5)" value={`${statsRubro.pilotos} / 5`} accent />
        )}
      </Grid>

      {plantilla === 'NUEVOS_RUBROS' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-text)' }}>Cupo de pilotos en Puerto Iguazú ({RUBROS_NUEVOS.find((r) => r.id === rubroNuevo)?.label}):</strong>{' '}
            {statsRubro.pilotos} de 5 elegidos (cortesía de hasta 3 meses). Elegí entre los posibles pilotos de Iguazú con el botón <b>«Elegir como Piloto»</b>; el resto quedan como <b>Leads (venta cerrada)</b>.
          </div>
          <div style={{ width: 140, height: 8, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.min(100, (statsRubro.pilotos / 5) * 100)}%`, height: '100%', background: 'var(--color-primary)' }} />
          </div>
        </div>
      )}

      {/* Card principal con filtros, acciones y tabla */}
      <Card
        title={plantilla === 'TIENDA' ? 'Tiendas Online — Misiones' : `${RUBROS_NUEVOS.find((r) => r.id === rubroNuevo)?.label} — Misiones`}
        subtitle={plantilla === 'TIENDA'
          ? 'Tildá el check apenas contactes un comercio: se guarda para Mateo, Alan, Mili y Ale.'
          : RUBROS_NUEVOS.find((r) => r.id === rubroNuevo)?.desc}
        action={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => descargarCsv(visibles, `orbita-leads-${rubroActivo.toLowerCase()}.csv`)}
              className="ds-hover"
              style={btnGhostSm}
            >
              <Download size={14} /> Exportar CSV ({visibles.length})
            </button>
            {puedeEditar && (
              <button type="button" onClick={() => setCreando(true)} style={{ ...btnPrimary, height: 32, padding: '0 13px', fontSize: 12.5 }}>
                <Plus size={14} /> Agregar lead
              </button>
            )}
          </div>
        )}
        noPad
      >
        {/* Barra de filtros */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar negocio, rubro, teléfono o @ig…"
                aria-label="Buscar leads"
                style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 36, fontSize: 13 }}
              />
            </div>

            <select aria-label="Filtrar por localidad" value={localidadFiltro} onChange={(e) => setLocalidadFiltro(e.target.value)} className="ld-select" style={{ height: 36 }}>
              <option value="TODAS">Todas las localidades ({leadsDelRubro.length})</option>
              {localidadesDisponibles.map(([loc, n]) => (
                <option key={loc} value={loc}>{loc} ({n})</option>
              ))}
            </select>

            <select aria-label="Filtrar por responsable" value={responsableFiltro} onChange={(e) => setResponsableFiltro(e.target.value)} className="ld-select" style={{ height: 36 }}>
              <option value="TODOS">Todo el equipo</option>
              {EQUIPO.map((p) => <option key={p} value={p}>Responsable: {p}</option>)}
              <option value="SIN_ASIGNAR">Sin asignar</option>
            </select>
          </div>

          <div className="ld-chips">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginRight: 4 }}>Tipo:</span>
            <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'TODAS'} onClick={() => setClasificacionFiltro('TODAS')}>Todos</button>
            {plantilla === 'TIENDA' ? (
              <>
                <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'POTENCIAL_LOCAL'} onClick={() => setClasificacionFiltro('POTENCIAL_LOCAL')}>Potenciales Iguazú ({statsRubro.potenciales})</button>
                <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'LEAD'} onClick={() => setClasificacionFiltro('LEAD')}>Leads resto de Misiones</button>
              </>
            ) : (
              <>
                <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'PILOTO'} onClick={() => setClasificacionFiltro('PILOTO')}>Pilotos elegidos ({statsRubro.pilotos}/5)</button>
                <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'POTENCIAL_LOCAL'} onClick={() => setClasificacionFiltro('POTENCIAL_LOCAL')}>Posibles pilotos Iguazú ({statsRubro.potenciales})</button>
                <button type="button" className="ld-chip-btn" aria-pressed={clasificacionFiltro === 'LEAD'} onClick={() => setClasificacionFiltro('LEAD')}>Leads resto ({statsRubro.total - statsRubro.pilotos - statsRubro.potenciales})</button>
              </>
            )}

            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginLeft: 8, marginRight: 4 }}>Canal:</span>
            {([
              ['TODOS', 'Todos'],
              ['AMBOS', 'WPP + IG'],
              ['WPP', 'Solo WhatsApp'],
              ['IG', 'Solo IG'],
              ['PRESENCIAL', 'Presencial Iguazú'],
            ] as [FiltroCanal, string][]).map(([id, txt]) => (
              <button key={id} type="button" className="ld-chip-btn" aria-pressed={canalFiltro === id} onClick={() => setCanalFiltro(id)}>{txt}</button>
            ))}

            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginLeft: 8, marginRight: 4 }}>Avance:</span>
            {([
              ['TODOS', 'Todos'],
              ['PENDIENTE', 'Sin contactar'],
              ['CONTACTADO', 'Contactados'],
              ['ACTIVO', 'Respondió / Demo'],
              ['CERRADO', 'Piloto / Cliente'],
              ['DESCARTADO', 'Descartados'],
            ] as [FiltroAvance, string][]).map(([id, txt]) => (
              <button key={id} type="button" className="ld-chip-btn" aria-pressed={avanceFiltro === id} onClick={() => setAvanceFiltro(id)}>{txt}</button>
            ))}
          </div>
        </div>

        {/* Tabla responsiva */}
        {visibles.length === 0 ? (
          <Empty text="No hay leads con esos filtros. Probá limpiar la búsqueda o cambiar de localidad." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['OK', 'Negocio y rubro', 'Tipo', 'Localidad', 'Contacto directo', 'Estado', 'Equipo', ''].map((h, i) => (
                    <th key={i} style={{
                      textAlign: i === 0 ? 'center' : 'left',
                      padding: '11px 14px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--color-muted)',
                      background: 'var(--color-surface)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--color-border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => {
                  const badge = etiquetaClasificacion(l.clasificacion, l.rubro)
                  const iguazu = esIguazu(l.localidad)
                  const igClean = l.instagram?.replace(/^@/, '')
                  return (
                    <tr key={l.id} className={l.contactado ? 'ld-row-ok' : undefined} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* Check visual */}
                      <td style={{ padding: '11px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          className="ld-check"
                          aria-pressed={l.contactado}
                          aria-label={l.contactado ? `Desmarcar ${l.negocio} como contactado` : `Marcar ${l.negocio} como contactado`}
                          disabled={!puedeEditar}
                          onClick={() => void actualizarLead(l, { contactado: !l.contactado })}
                        >
                          <Check size={16} strokeWidth={3} />
                        </button>
                        {l.contactado && l.contactadoPor && (
                          <div style={{ fontSize: 10.5, color: 'var(--chip-success-fg)', marginTop: 3, fontWeight: 600 }}>
                            {l.contactadoPor.split(' ')[0]}
                          </div>
                        )}
                      </td>

                      {/* Negocio y subrubro */}
                      <td style={{ padding: '11px 14px', minWidth: 210, verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35 }}>{l.negocio}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                          {l.subrubro}{l.resenas ? ` · ${l.resenas}` : ''}
                        </div>
                        {l.direccion && (
                          <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={11} style={{ flexShrink: 0 }} />
                            <span>{l.direccion}</span>
                          </div>
                        )}
                      </td>

                      {/* Clasificación + swap piloto */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                          <Chip text={badge.text} tone={badge.tone} dot />
                          {plantilla === 'NUEVOS_RUBROS' && iguazu && puedeEditar && (
                            <button
                              type="button"
                              onClick={() => void actualizarLead(
                                l,
                                { clasificacion: l.clasificacion === 'PILOTO' ? 'POTENCIAL_LOCAL' : 'PILOTO' },
                                l.clasificacion === 'PILOTO' ? 'Quitado de Piloto' : 'Elegido como Piloto',
                              )}
                              style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 11.5, fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {l.clasificacion === 'PILOTO' ? 'Quitar de Piloto' : 'Elegir como Piloto'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Localidad */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: iguazu ? 600 : 400, color: 'var(--color-text)' }}>{l.localidad}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{l.departamento}</div>
                      </td>

                      {/* Contacto directo */}
                      <td style={{ padding: '11px 14px', minWidth: 210, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {l.whatsappUrl && (
                            <a href={l.whatsappUrl} target="_blank" rel="noreferrer" className="ld-wa" title={l.telefono ?? 'Abrir WhatsApp'}>
                              <MessageCircle size={13} />
                              <span>{l.telefono ?? 'WhatsApp'}</span>
                            </a>
                          )}
                          {igClean && (
                            <a href={`https://www.instagram.com/${igClean}/`} target="_blank" rel="noreferrer" className="ld-ig">
                              <AtSign size={13} />
                              <span>{l.instagram}</span>
                            </a>
                          )}
                          {!l.whatsappUrl && !igClean && (
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Acercarse al local</span>
                          )}
                        </div>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <select
                          aria-label={`Estado de ${l.negocio}`}
                          value={l.estado}
                          disabled={!puedeEditar}
                          onChange={(e) => void actualizarLead(l, { estado: e.target.value as LeadEstado })}
                          className="ld-select"
                        >
                          {ESTADOS.map((es) => <option key={es.id} value={es.id}>{es.texto}</option>)}
                        </select>
                      </td>

                      {/* Responsable */}
                      <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        <select
                          aria-label={`Responsable de ${l.negocio}`}
                          value={l.asignadoA ?? ''}
                          disabled={!puedeEditar}
                          onChange={(e) => void actualizarLead(l, { asignadoA: e.target.value || null })}
                          className="ld-select"
                        >
                          <option value="">—</option>
                          {EQUIPO.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>

                      {/* Notas / Eliminar */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => setEditandoNota(l)}
                            className="ds-hover"
                            title={l.notas || 'Agregar nota'}
                            aria-label={`Notas de ${l.negocio}`}
                            style={{
                              ...btnGhostSm,
                              height: 30,
                              padding: '0 9px',
                              borderColor: l.notas ? 'var(--color-primary)' : 'var(--color-border)',
                              color: l.notas ? 'var(--color-primary)' : 'var(--color-muted)',
                            }}
                          >
                            <FileText size={13} />
                            {l.notas ? 'Nota' : ''}
                          </button>
                          {puedeEditar && (
                            <button
                              type="button"
                              onClick={() => setEliminando(l)}
                              className="ds-hover"
                              aria-label={`Eliminar ${l.negocio}`}
                              style={{ ...btnGhostSm, height: 30, padding: '0 8px', color: 'var(--color-muted)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creando && (
        <ModalNuevoLead
          rubroInicial={rubroActivo}
          onClose={() => setCreando(false)}
          onCreado={(nuevo) => {
            setCreando(false)
            setCambiosLocales((m) => ({ ...m, [nuevo.id]: nuevo }))
            setTick((n) => n + 1)
            setAviso({ variant: 'success', title: `Lead agregado: ${nuevo.negocio}` })
          }}
        />
      )}

      {editandoNota && (
        <ModalNotaLead
          lead={editandoNota}
          puedeEditar={puedeEditar}
          onClose={() => setEditandoNota(null)}
          onGuardar={async (notas) => {
            await actualizarLead(editandoNota, { notas }, 'Nota guardada')
            setEditandoNota(null)
          }}
        />
      )}

      {eliminando && (
        <ConfirmModal
          title={`Eliminar ${eliminando.negocio}`}
          body="Se borra este lead de la lista compartida del equipo. Si era un piloto, libera el lugar."
          confirmLabel="Eliminar"
          onCancel={() => setEliminando(null)}
          onConfirm={async () => {
            await platformApi.leadsEliminar(eliminando.id)
            setEliminando(null)
            setTick((n) => n + 1)
            setAviso({ variant: 'success', title: 'Lead eliminado' })
          }}
        />
      )}
    </div>
  )
}

function KpiMini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--color-bg)',
      border: `1px solid ${accent ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 12,
      padding: '12px 15px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
        {value}
      </div>
    </div>
  )
}

function ModalNuevoLead({ rubroInicial, onClose, onCreado }: {
  rubroInicial: LeadRubro; onClose: () => void; onCreado: (l: MarketingLead) => void
}) {
  const [rubro, setRubro] = useState<LeadRubro>(rubroInicial)
  const [negocio, setNegocio] = useState('')
  const [subrubro, setSubrubro] = useState('')
  const [localidad, setLocalidad] = useState('Puerto Iguazú')
  const [clasificacion, setClasificacion] = useState<LeadClasificacion>('POTENCIAL_LOCAL')
  const [telefono, setTelefono] = useState('')
  const [instagram, setInstagram] = useState('')
  const [direccion, setDireccion] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const creado = await platformApi.leadsCrear({
        rubro,
        negocio: negocio.trim(),
        subrubro: subrubro.trim(),
        localidad: localidad.trim(),
        clasificacion,
        telefono: telefono.trim() || undefined,
        instagram: instagram.trim() || undefined,
        direccion: direccion.trim() || undefined,
        asignadoA: asignadoA || undefined,
        notas: notas.trim() || undefined,
      })
      onCreado(creado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el lead.')
      setGuardando(false)
    }
  }

  return (
    <ModalShell title="Agregar lead o piloto" onClose={onClose} cerrarAlClickAfuera={false} ancho={520}>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBox msg={error} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Rubro">
            <select
              value={rubro}
              onChange={(e) => {
                const r = e.target.value as LeadRubro
                setRubro(r)
                setClasificacion(esIguazu(localidad) ? 'POTENCIAL_LOCAL' : 'LEAD')
              }}
              style={inputStyle}
            >
              <option value="TIENDA">Tienda Online</option>
              <option value="TURNOS">Turnos</option>
              <option value="ALQUILERES">Alquileres</option>
              <option value="GIMNASIO">Gimnasios</option>
              <option value="POS">POS / Mostrador</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value as LeadClasificacion)} style={inputStyle}>
              {rubro === 'TIENDA' ? (
                <>
                  <option value="POTENCIAL_LOCAL">Potencial · Iguazú</option>
                  <option value="LEAD">Lead · Venta</option>
                </>
              ) : (
                <>
                  <option value="POTENCIAL_LOCAL">Posible piloto · Iguazú</option>
                  <option value="PILOTO">Piloto · Iguazú (máx. 5)</option>
                  <option value="LEAD">Lead · Venta cerrada</option>
                </>
              )}
            </select>
          </Field>
        </div>

        <Field label="Nombre del negocio">
          <input required value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Ej: Barbería Centro" style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Subrubro">
            <input required value={subrubro} onChange={(e) => setSubrubro(e.target.value)} placeholder="Ej: Barbería / Indumentaria" style={inputStyle} />
          </Field>
          <Field label="Localidad">
            <input required value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Puerto Iguazú" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Teléfono / WhatsApp">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="03757 ..." style={inputStyle} />
          </Field>
          <Field label="Instagram">
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Dirección (opcional)">
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Victoria Aguirre…" style={inputStyle} />
          </Field>
          <Field label="Responsable">
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)} style={inputStyle}>
              <option value="">Sin asignar</option>
              {EQUIPO.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ ...inputStyle, height: 'auto', padding: 10 }} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar lead'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalNotaLead({ lead, puedeEditar, onClose, onGuardar }: {
  lead: MarketingLead; puedeEditar: boolean; onClose: () => void; onGuardar: (notas: string) => Promise<void>
}) {
  const [notas, setNotas] = useState(lead.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  return (
    <ModalShell title={`Notas · ${lead.negocio}`} onClose={onClose} ancho={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
          {lead.rubro} · {lead.subrubro} · {lead.localidad}
        </div>
        <textarea
          value={notas}
          disabled={!puedeEditar}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          placeholder="Ej: Hablamos con el dueño, le gustó la demo, volver a escribir el viernes…"
          style={{ ...inputStyle, height: 'auto', padding: 12, lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cerrar</button>
          {puedeEditar && (
            <button
              type="button"
              disabled={guardando}
              onClick={async () => {
                setGuardando(true)
                await onGuardar(notas.trim())
                setGuardando(false)
              }}
              style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
