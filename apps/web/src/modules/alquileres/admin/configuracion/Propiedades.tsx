// Propiedades: cada una con sus datos, cómo se alquila (por noche o por mes),
// sus comodidades, sus fotos y su ubicación. El precio por noche y las
// temporadas (o el precio por mes y el depósito) van en Temporadas y precios;
// las noches o los meses mínimos y los horarios de entrada y salida, en
// Reglas de reserva; las fechas bloqueadas, en Bloqueos.
import { useState } from 'react'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { Area, BarraGuardar, Campo, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { TIPOS, TIPOS_PROPIEDAD, capital, esMensual, palabrasDe, type Modalidad, type Propiedad } from '../../datos'
import { Mapa } from '../../storefront/Sitio'
import type { Vista } from '../navegacion'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

/** Las comodidades que se ofrecen para marcar; las que el dueño ya tenga cargadas se suman. */
const COMODIDADES = ['Wi-Fi', 'Aire acondicionado', 'Calefacción', 'Pileta', 'Parrilla', 'Cocina equipada', 'Cocina', 'Estacionamiento', 'Ropa blanca', 'Ascensor', 'Lavarropas', 'TV', 'Mascotas permitidas', 'Expensas incluidas', 'Amoblado']

/** Lo que trae una propiedad que pasa a alquilarse por mes y no tenía precio por mes: un valor para arrancar. */
const MENSUAL_INICIAL = { precioMes: 400000, minMeses: 1, maxMeses: 12, deposito: 400000 }

export default function Propiedades({ negocio, onGuardar, onIr }: Form & { onIr: (vista: Vista) => void }) {
  const palabras = palabrasDe(negocio)
  const [lista, setLista] = useState<Propiedad[]>(negocio.propiedades)
  const [abierta, setAbierta] = useState(lista[0]?.id ?? '')
  const cambiado = !igual(lista, negocio.propiedades)
  const p = lista.find(x => x.id === abierta)
  const editar = (c: Partial<Propiedad>) => setLista(lista.map(x => (x.id === abierta ? { ...x, ...c } : x)))
  const cambiarModalidad = (m: Modalidad) => p && editar({ modalidad: m, mensual: m === 'mes' ? p.mensual ?? { ...MENSUAL_INICIAL } : p.mensual })
  const agregar = () => {
    const id = idNuevo('c')
    setLista([...lista, { id, nombre: `${capital(palabras.unidad)} nueva`, tipo: 'Casa', modalidad: 'noche', descripcion: '', huespedes: 4, ambientes: 2, camas: 2, banos: 1, comodidades: ['Wi-Fi'], fotos: [negocio.fotoPortada], direccion: negocio.direccion, ciudad: negocio.ciudad, latLng: negocio.latLng, tarifa: { precioNoche: 50000, temporadas: [], finDeSemanaPct: 0, limpieza: 15000, minNoches: 1 }, checkIn: 15 * 60, checkOut: 10 * 60 }])
    setAbierta(id)
  }
  return (
    <PaginaForm rotulo={TIPOS.estadia.label} titulo={capital(palabras.unidades)} bajada="Cada una con sus datos, cómo se alquila, sus comodidades, sus fotos y su ubicación: lo que se ve en su tarjeta del sitio."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={agregar}><Plus size={15} aria-hidden /> Agregar {palabras.unidad}</button>}>
      <div className="rv-seg" role="group" aria-label={capital(palabras.unidad)} style={{ marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
        {lista.map(x => <button key={x.id} type="button" aria-pressed={x.id === abierta} onClick={() => setAbierta(x.id)}>{x.nombre}</button>)}
      </div>
      {p && (
        <div className="rv-pila">
          <Seccion titulo={`${capital(palabras.genero === 'm' ? 'el' : 'la')} ${palabras.unidad}`} bajada="Nombre, tipo, cómo se alquila y una descripción que invite.">
            <div className="rv-pila">
              <div className="rv-grid rv-grid--3">
                <Campo label="Nombre" value={p.nombre} onChange={x => editar({ nombre: x })} />
                <Selector label="Tipo" valor={p.tipo} onChange={x => editar({ tipo: x })} opciones={TIPOS_PROPIEDAD.map(t => ({ id: t, label: t }))} />
                <Selector label="Se alquila" valor={p.modalidad} onChange={cambiarModalidad} opciones={[{ id: 'noche' as const, label: 'Por noche' }, { id: 'mes' as const, label: 'Por mes' }]} ayuda={esMensual(p) ? 'Una fecha y cuántos meses, con depósito.' : 'Entrada y salida, con temporadas.'} />
              </div>
              <Area label="Descripción" value={p.descripcion} onChange={x => editar({ descripcion: x })} maxLength={400} />
              <div className="rv-grid rv-grid--4">
                <Campo label={esMensual(p) ? 'Personas (máximo)' : 'Huéspedes (máximo)'} value={String(p.huespedes)} onChange={x => editar({ huespedes: Math.max(1, num(x)) })} inputMode="numeric" />
                <Campo label="Ambientes" value={String(p.ambientes)} onChange={x => editar({ ambientes: num(x) })} inputMode="numeric" />
                <Campo label="Camas" value={String(p.camas)} onChange={x => editar({ camas: num(x) })} inputMode="numeric" />
                <Campo label="Baños" value={String(p.banos)} onChange={x => editar({ banos: num(x) })} inputMode="numeric" />
              </div>
            </div>
          </Seccion>
          <Seccion titulo="Comodidades" bajada="Las marcadas se ven en la tarjeta y en la ficha del sitio.">
            <div className="alc-dias" role="group" aria-label="Comodidades">
              {[...new Set([...COMODIDADES, ...p.comodidades])].map(c => {
                const on = p.comodidades.includes(c)
                return <button key={c} type="button" className="rv-chip rv-chip--borde" aria-pressed={on} onClick={() => editar({ comodidades: on ? p.comodidades.filter(x => x !== c) : [...p.comodidades, c] })}>{c}</button>
              })}
            </div>
          </Seccion>
          <Seccion titulo="Fotos" bajada="La primera es la de la tarjeta en tu sitio.">
            <div className="alc-fotos">
              {p.fotos.map((f, i) => <img key={`${i}-${f}`} src={f} alt={`Foto ${i + 1} de ${p.nombre}`} loading="lazy" />)}
            </div>
            <p className="ala-pie-nota">En la demo son fotos de ejemplo: no se cargan nuevas.</p>
          </Seccion>
          <Seccion titulo="Ubicación" bajada="Así se ve en tu sitio. En la demo el punto del mapa no se mueve al cambiar la dirección.">
            <div className="rv-dos">
              <Campo label="Dirección" value={p.direccion} onChange={x => editar({ direccion: x })} />
              <Campo label="Ciudad" value={p.ciudad} onChange={x => editar({ ciudad: x })} />
            </div>
            <div style={{ marginTop: 10 }}><Mapa latLng={p.latLng} titulo={p.nombre} /></div>
          </Seccion>
          <Nota><span style={{ flex: 1, minWidth: 0 }}>{esMensual(p) ? `El precio por mes y el depósito de ${p.nombre} están en Temporadas y precios; los meses mínimos y máximos y los horarios de entrada y salida, en Reglas de reserva` : `El precio por noche y las temporadas de ${p.nombre} están en Temporadas y precios; las noches mínimas y los horarios de entrada y salida, en Reglas de reserva`}; las fechas bloqueadas, en Bloqueos.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('temporadas')}>Temporadas y precios <ArrowRight size={14} aria-hidden /></button></Nota>
          {lista.length > 1 && <button type="button" className="rv-btn rv-btn--peligro" style={{ alignSelf: 'flex-start' }} onClick={() => { const resto = lista.filter(x => x.id !== p.id); setLista(resto); setAbierta(resto[0].id) }}><Trash2 size={15} aria-hidden /> Quitar {p.nombre}</button>}
        </div>
      )}
      <BarraGuardar cambiado={cambiado} onDescartar={() => { setLista(negocio.propiedades); setAbierta(negocio.propiedades[0]?.id ?? '') }} onGuardar={() => onGuardar({ propiedades: lista.map(x => ({ ...x, nombre: x.nombre.trim() || capital(palabras.unidad) })) })} />
    </PaginaForm>
  )
}
